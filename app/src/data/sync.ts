import { Effect, Schedule } from "effect";
import type { GraphEdge, GraphNode } from "../types";
import { parseRevisions } from "./boneyard/validation";
import { accountStorageKey, getWorkspaceAccount } from "./account";
import { authenticatedFetch } from "../lib/auth-client";
import { getSyncStorage, type SyncStorageAdapter } from "./syncStorage";

import {
  changedRecords,
  recordKey,
  sameContent,
  type CloudRecord,
  type CloudConflict,
} from "./sync-protocol";

function getSyncConflictsEffect(
  storage: SyncStorageAdapter = getSyncStorage(),
): Effect.Effect<CloudConflict[], unknown> {
  return Effect.gen(function* () {
    const conflicts = yield* Effect.tryPromise(() => storage.getConflicts());
    return yield* Effect.all(
      conflicts.map((record) =>
        Effect.tryPromise(async () => ({
          ...record,
          local: await storage.getNodeOrEdge(record.kind, record.id),
        })),
      ),
      { concurrency: "unbounded" },
    );
  });
}

export function getSyncConflicts(
  storage: SyncStorageAdapter = getSyncStorage(),
): Promise<CloudConflict[]> {
  return Effect.runPromise(getSyncConflictsEffect(storage));
}

export async function resolveSyncConflicts(
  choice: "local" | "cloud",
  storage: SyncStorageAdapter = getSyncStorage(),
): Promise<void> {
  const conflicts = await getSyncConflicts(storage);
  const baseline = await storage.getBaseline();
  const records = new Map(baseline.map((r) => [recordKey(r), r]));
  await storage.saveBackup(`cloud-conflict-backup-${Date.now()}`, conflicts);
  for (const conflict of conflicts) {
    records.set(recordKey(conflict), {
      kind: conflict.kind,
      id: conflict.id,
      data: conflict.data,
      version: conflict.version,
    });
  }
  if (choice === "cloud") {
    const nodesToPut: GraphNode[] = [];
    const edgesToPut: GraphEdge[] = [];
    const nodesToDelete: string[] = [];
    const edgesToDelete: string[] = [];

    for (const conflict of conflicts) {
      if (conflict.data === null) {
        if (conflict.kind === "nodes") nodesToDelete.push(conflict.id);
        else edgesToDelete.push(conflict.id);
      } else {
        if (conflict.kind === "nodes") nodesToPut.push(conflict.data as GraphNode);
        else edgesToPut.push(conflict.data as GraphEdge);
      }
    }

    await Promise.all([
      storage.putNodes(nodesToPut),
      storage.putEdges(edgesToPut),
      storage.deleteNodes(nodesToDelete),
      storage.deleteEdges(edgesToDelete),
    ]);
  }
  await storage.setBaseline([...records.values()]);
  await storage.setConflicts([]);
}

const SYNC_KEY_STORAGE = "throughline.sync_key";
const LAST_SYNCED_STORAGE = "throughline.last_synced_at";

export function getSyncKey(): string {
  const uid = getWorkspaceAccount();
  if (uid) return `user:${uid}`;
  if (typeof window === "undefined") return "";
  return localStorage.getItem(SYNC_KEY_STORAGE) ?? "";
}

export function setSyncKey(key: string): void {
  if (getWorkspaceAccount()) return;
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
  const raw = localStorage.getItem(accountStorageKey(LAST_SYNCED_STORAGE));
  if (!raw) return null;
  const num = Number(raw);
  return Number.isFinite(num) ? num : null;
}

export async function checkTursoConfigured(): Promise<boolean> {
  try {
    const res = await authenticatedFetch("/api/sync");
    if (!res.ok) return false;
    const data = (await res.json()) as { configured?: boolean };
    return data.configured === true;
  } catch {
    return false;
  }
}

export type SyncResult = {
  ok: boolean;
  message: string;
  pulledNodes: GraphNode[];
  pulledEdges: GraphEdge[];
  deleted?: boolean;
};

function executeSyncEffect(
  beforeApply?: () => Promise<void>,
  storage: SyncStorageAdapter = getSyncStorage(),
): Effect.Effect<SyncResult, never> {
  return Effect.gen(function* () {
    const syncKey = getSyncKey();
    if (!syncKey) {
      return {
        ok: false,
        message: "Set a Sync Key to enable cloud sync.",
        pulledNodes: [],
        pulledEdges: [],
      };
    }

    const [localNodes, localEdges, baseline] = yield* Effect.all(
      [
        Effect.tryPromise(() => storage.getNodes()),
        Effect.tryPromise(() => storage.getEdges()),
        Effect.tryPromise(() => storage.getBaseline()),
      ],
      { concurrency: "unbounded" },
    );

    const changes = changedRecords(localNodes, localEdges, baseline);
    const retrySchedule = Schedule.exponential(100).pipe(Schedule.intersect(Schedule.recurs(2)));

    const res = yield* Effect.tryPromise(() =>
      authenticatedFetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ protocol: 2, changes }),
      }),
    ).pipe(Effect.retry(retrySchedule));

    const data = (yield* Effect.tryPromise(() => res.json())) as {
      ok: boolean;
      protocol?: number;
      error?: string;
      syncedAt?: number;
      records?: CloudRecord[];
      conflicts?: CloudConflict[];
    };

    if (res.status === 409 && data.conflicts) {
      const serverConflicts = data.conflicts;
      yield* Effect.tryPromise(() => storage.setConflicts(serverConflicts));
    }

    if (!res.ok || !data.ok || data.protocol !== 2 || !Array.isArray(data.records)) {
      return {
        ok: false,
        message: data.error ?? "The server needs the latest sync update.",
        pulledNodes: [],
        pulledEdges: [],
      };
    }

    const sent = new Map<string, GraphNode | GraphEdge>([
      ...localNodes.map((n) => [`nodes:${n.id}`, n] as const),
      ...localEdges.map((e) => [`edges:${e.id}`, e] as const),
    ]);

    if (beforeApply) {
      yield* Effect.tryPromise(() => beforeApply());
    }

    const [liveNodes, liveEdges] = yield* Effect.all(
      [Effect.tryPromise(() => storage.getNodes()), Effect.tryPromise(() => storage.getEdges())],
      { concurrency: "unbounded" },
    );

    const live = new Map<string, GraphNode | GraphEdge>([
      ...liveNodes.map((n) => [`nodes:${n.id}`, n] as const),
      ...liveEdges.map((e) => [`edges:${e.id}`, e] as const),
    ]);

    const pulledNodes: GraphNode[] = [];
    const pulledEdges: GraphEdge[] = [];
    let deleted = false;
    const conflicts: CloudConflict[] = [];
    const nextBaseline = new Map(baseline.map((r) => [recordKey(r), r]));

    const nodesToPut: GraphNode[] = [];
    const edgesToPut: GraphEdge[] = [];
    const nodesToDelete: string[] = [];
    const edgesToDelete: string[] = [];

    for (const record of data.records) {
      const key = recordKey(record);
      const before = sent.get(key) ?? null;
      const current = live.get(key) ?? null;
      // Preserve edits made while the network request was in flight.
      if (!sameContent(before, current) && !sameContent(before, record.data)) {
        conflicts.push({ ...record, local: current });
        continue;
      }
      nextBaseline.set(key, record);
      if (!sameContent(before, current) || sameContent(current, record.data)) continue;

      if (record.data === null) {
        if (record.kind === "nodes") nodesToDelete.push(record.id);
        else edgesToDelete.push(record.id);
        deleted = true;
      } else {
        if (record.kind === "nodes") {
          const node = record.data as GraphNode;
          nodesToPut.push(node);
          pulledNodes.push(node);
        } else {
          const edge = record.data as GraphEdge;
          edgesToPut.push(edge);
          pulledEdges.push(edge);
        }
      }
    }

    yield* Effect.all(
      [
        Effect.tryPromise(() => storage.putNodes(nodesToPut)),
        Effect.tryPromise(() => storage.putEdges(edgesToPut)),
        Effect.tryPromise(() => storage.deleteNodes(nodesToDelete)),
        Effect.tryPromise(() => storage.deleteEdges(edgesToDelete)),
        Effect.tryPromise(() => storage.setBaseline([...nextBaseline.values()])),
        Effect.tryPromise(() => storage.setConflicts(conflicts)),
      ],
      { concurrency: "unbounded" },
    );

    const boneyardSyncEffect = Effect.gen(function* () {
      const revisions = yield* Effect.tryPromise(() => storage.getBoneyardRevisions());
      const ideaResponse = yield* Effect.tryPromise(() =>
        authenticatedFetch("/api/boneyard-sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ syncKey, revisions }),
        }),
      );
      const ideaData = (yield* Effect.tryPromise(() => ideaResponse.json())) as {
        ok?: boolean;
        boneyardProtocol?: number;
        revisions?: unknown;
        error?: string;
      };
      if (!ideaResponse.ok || !ideaData.ok || ideaData.boneyardProtocol !== 1) {
        return yield* Effect.fail(
          new Error(
            ideaData.error ?? "Update the server to sync Boneyard history. Local ideas are safe.",
          ),
        );
      }
      yield* Effect.tryPromise(() =>
        storage.mergeBoneyardRevisions(parseRevisions(ideaData.revisions)),
      );
    });

    const boneyardEither = yield* Effect.either(boneyardSyncEffect);
    if (boneyardEither._tag === "Left") {
      return {
        ok: false,
        message:
          "Writing synced, but Boneyard sync could not complete. Your local ideas are preserved. Try again.",
        pulledNodes,
        pulledEdges,
        deleted,
      };
    }

    if (data.syncedAt) {
      localStorage.setItem(accountStorageKey(LAST_SYNCED_STORAGE), String(data.syncedAt));
    }

    return {
      ok: conflicts.length === 0,
      deleted,
      message: conflicts.length
        ? "Edits changed during sync. Both versions are preserved; resolve them in your profile."
        : pulledNodes.length > 0 || pulledEdges.length > 0
          ? `Synced: received ${pulledNodes.length} update(s) from cloud.`
          : "In sync with cloud.",
      pulledNodes,
      pulledEdges,
    };
  }).pipe(
    Effect.catchAll((err) =>
      Effect.succeed<SyncResult>({
        ok: false,
        message: `Network/sync error: ${String(err)}`,
        pulledNodes: [],
        pulledEdges: [],
      }),
    ),
  );
}

export async function executeSync(
  beforeApply?: () => Promise<void>,
  storage: SyncStorageAdapter = getSyncStorage(),
): Promise<SyncResult> {
  return Effect.runPromise(executeSyncEffect(beforeApply, storage));
}
