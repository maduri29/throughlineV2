import { Effect, Schedule, Schema, Duration } from "effect";
import { dbGetAll, dbPut } from "./idb";
import type { GraphEdge, GraphNode } from "../types";
import type { Revision } from "./boneyard/types";
import { parseRevisions } from "./boneyard/validation";

const SYNC_KEY_STORAGE = "throughline.sync_key";
const LAST_SYNCED_STORAGE = "throughline.last_synced_at";

export function getSyncKey(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(SYNC_KEY_STORAGE) ?? "";
}

export function setSyncKey(key: string): void {
  if (typeof window === "undefined") return;
  if (!key.trim()) {
    localStorage.removeItem(SYNC_KEY_STORAGE);
    localStorage.removeItem(LAST_SYNCED_STORAGE);
  } else {
    localStorage.setItem(SYNC_KEY_STORAGE, key.trim());
  }
}

export function getLastSyncedAt(): number | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(LAST_SYNCED_STORAGE);
  if (!raw) return null;
  const num = Number(raw);
  return Number.isFinite(num) ? num : null;
}

export async function checkTursoConfigured(): Promise<boolean> {
  const checkEffect = Effect.tryPromise({
    try: async () => {
      const res = await fetch("/api/sync");
      if (!res.ok) return false;
      const data = (await res.json()) as { configured?: boolean };
      return data.configured === true;
    },
    catch: () => false,
  });

  return Effect.runPromise(checkEffect);
}

export type SyncResult = {
  ok: boolean;
  message: string;
  pulledNodes: GraphNode[];
  pulledEdges: GraphEdge[];
};

/* --------------------------- Effect Typed Errors -------------------------- */

export class SyncKeyMissingError extends Error {
  readonly _tag = "SyncKeyMissingError";
  constructor() {
    super("Set a Sync Key to enable cloud sync.");
  }
}

export class SyncNetworkError extends Error {
  readonly _tag = "SyncNetworkError";
  constructor(public readonly originalError: unknown) {
    super(`Network/sync error: ${String(originalError)}`);
  }
}

export class SyncServerError extends Error {
  readonly _tag = "SyncServerError";
  constructor(message: string) {
    super(message);
  }
}

/* --------------------------- API Response Schemas ------------------------- */

const SyncApiResponseSchema = Schema.Struct({
  ok: Schema.Boolean,
  error: Schema.optional(Schema.String),
  syncedAt: Schema.optional(Schema.Number),
  pulledNodes: Schema.optional(Schema.Array(Schema.Unknown)),
  pulledEdges: Schema.optional(Schema.Array(Schema.Unknown)),
});

const BoneyardApiResponseSchema = Schema.Struct({
  ok: Schema.optional(Schema.Boolean),
  boneyardProtocol: Schema.optional(Schema.Number),
  revisions: Schema.optional(Schema.Unknown),
  error: Schema.optional(Schema.String),
});

/** Retry policy for transient network drops: retry twice with exponential backoff */
const retryPolicy = Schedule.exponential(Duration.millis(150)).pipe(
  Schedule.compose(Schedule.recurs(2)),
);

/**
 * Effect-native execution of cross-device sync.
 * Provides automatic retries on transient network failures,
 * schema validation of cloud payloads, and typed failure channels.
 */
export function executeSyncEffect(): Effect.Effect<
  SyncResult,
  SyncKeyMissingError | SyncNetworkError | SyncServerError
> {
  return Effect.gen(function* () {
    const syncKey = getSyncKey();
    if (!syncKey) {
      return yield* Effect.fail(new SyncKeyMissingError());
    }

    const lastSyncedAt = getLastSyncedAt() ?? 0;

    // 1. Read local state from IndexedDB
    const [localNodes, localEdges] = yield* Effect.tryPromise({
      try: () => Promise.all([dbGetAll<GraphNode>("nodes"), dbGetAll<GraphEdge>("edges")]),
      catch: (err) => new SyncNetworkError(err),
    });

    // 2. Push graph nodes and edges to Turso with retry
    const fetchSync = Effect.tryPromise({
      try: async () => {
        const res = await fetch("/api/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            syncKey,
            lastSyncedAt,
            pushNodes: localNodes,
            pushEdges: localEdges,
          }),
        });
        const json = await res.json();
        return { status: res.status, ok: res.ok, json };
      },
      catch: (err) => new SyncNetworkError(err),
    });

    const syncResponse = yield* fetchSync.pipe(Effect.retry(retryPolicy));

    const decodedSync = yield* Schema.decodeUnknown(SyncApiResponseSchema)(syncResponse.json).pipe(
      Effect.mapError((err) => new SyncServerError(`Invalid server sync response: ${err.message}`)),
    );

    if (!syncResponse.ok || !decodedSync.ok) {
      return yield* Effect.fail(
        new SyncServerError(decodedSync.error ?? "Failed to sync with Turso."),
      );
    }

    const pulledNodes = (decodedSync.pulledNodes ?? []) as GraphNode[];
    const pulledEdges = (decodedSync.pulledEdges ?? []) as GraphEdge[];

    if (pulledNodes.length > 0) {
      yield* Effect.tryPromise({
        try: () => dbPut("nodes", pulledNodes),
        catch: (err) => new SyncNetworkError(err),
      });
    }
    if (pulledEdges.length > 0) {
      yield* Effect.tryPromise({
        try: () => dbPut("edges", pulledEdges),
        catch: (err) => new SyncNetworkError(err),
      });
    }

    // 3. Push and pull Boneyard history
    const revisions = yield* Effect.tryPromise({
      try: () => dbGetAll<Revision>("boneyard"),
      catch: (err) => new SyncNetworkError(err),
    });

    const fetchBoneyard = Effect.tryPromise({
      try: async () => {
        const res = await fetch("/api/boneyard-sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ syncKey, revisions }),
        });
        const json = await res.json();
        return { status: res.status, ok: res.ok, json };
      },
      catch: (err) => new SyncNetworkError(err),
    });

    const boneyardResponse = yield* fetchBoneyard.pipe(Effect.retry(retryPolicy));

    const decodedBoneyard = yield* Schema.decodeUnknown(BoneyardApiResponseSchema)(
      boneyardResponse.json,
    ).pipe(
      Effect.mapError((err) => new SyncServerError(`Invalid boneyard response: ${err.message}`)),
    );

    if (!boneyardResponse.ok || !decodedBoneyard.ok || decodedBoneyard.boneyardProtocol !== 1) {
      return yield* Effect.fail(
        new SyncServerError(
          decodedBoneyard.error ??
            "Update the server to sync Boneyard history. Local ideas are safe.",
        ),
      );
    }

    const { mergeRevisions } = yield* Effect.tryPromise({
      try: () => import("./boneyard/repository"),
      catch: (err) => new SyncNetworkError(err),
    });

    yield* Effect.tryPromise({
      try: () => mergeRevisions(parseRevisions(decodedBoneyard.revisions)),
      catch: (err) => new SyncNetworkError(err),
    });

    if (decodedSync.syncedAt) {
      localStorage.setItem(LAST_SYNCED_STORAGE, String(decodedSync.syncedAt));
    }

    return {
      ok: true,
      message:
        pulledNodes.length > 0 || pulledEdges.length > 0
          ? `Synced: received ${pulledNodes.length} update(s) from cloud.`
          : "In sync with cloud.",
      pulledNodes,
      pulledEdges,
    };
  });
}

/**
 * Public execution wrapper returning a promise-based SyncResult.
 */
export async function executeSync(): Promise<SyncResult> {
  return Effect.runPromise(
    executeSyncEffect().pipe(
      Effect.catchAll((err) =>
        Effect.succeed<SyncResult>({
          ok: false,
          message: err.message,
          pulledNodes: [],
          pulledEdges: [],
        }),
      ),
    ),
  );
}
