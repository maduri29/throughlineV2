import { dbGetAll, dbGet, dbPut, dbDelete, metaGet, metaSet } from "./idb";
import type { GraphEdge, GraphNode } from "../types";
import type { Revision } from "./boneyard/types";
import { parseRevisions } from "./boneyard/validation";
import { accountStorageKey, getWorkspaceAccount } from "./account";
import { authenticatedFetch } from "../lib/auth-client";

import {
  changedRecords,
  recordKey,
  sameContent,
  type CloudRecord,
  type CloudConflict,
} from "./sync-protocol";

const BASELINE_KEY = "cloud-baseline-v2";
const CONFLICT_KEY = "cloud-conflicts-v2";

export async function getSyncConflicts(): Promise<CloudConflict[]> {
  const conflicts = (await metaGet<CloudConflict[]>(CONFLICT_KEY)) ?? [];
  return await Promise.all(
    conflicts.map(async (record) => ({
      ...record,
      local: (await dbGet<GraphNode | GraphEdge>(record.kind, record.id)) ?? null,
    })),
  );
}

export async function resolveSyncConflicts(choice: "local" | "cloud"): Promise<void> {
  const conflicts = await getSyncConflicts();
  const baseline = (await metaGet<CloudRecord[]>(BASELINE_KEY)) ?? [];
  const records = new Map(baseline.map((r) => [recordKey(r), r]));
  await metaSet(`cloud-conflict-backup-${Date.now()}`, conflicts);
  for (const conflict of conflicts) {
    records.set(recordKey(conflict), {
      kind: conflict.kind,
      id: conflict.id,
      data: conflict.data,
      version: conflict.version,
    });
    if (choice === "cloud") {
      if (conflict.data === null) await dbDelete(conflict.kind, [conflict.id]);
      else await dbPut(conflict.kind, [conflict.data]);
    }
  }
  await metaSet(BASELINE_KEY, [...records.values()]);
  await metaSet(CONFLICT_KEY, []);
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

export async function executeSync(beforeApply?: () => Promise<void>): Promise<SyncResult> {
  const syncKey = getSyncKey();
  if (!syncKey) {
    return {
      ok: false,
      message: "Set a Sync Key to enable cloud sync.",
      pulledNodes: [],
      pulledEdges: [],
    };
  }

  try {
    const [localNodes, localEdges] = await Promise.all([
      dbGetAll<GraphNode>("nodes"),
      dbGetAll<GraphEdge>("edges"),
    ]);

    const baseline = (await metaGet<CloudRecord[]>(BASELINE_KEY)) ?? [];
    const changes = changedRecords(localNodes, localEdges, baseline);
    const res = await authenticatedFetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ protocol: 2, changes }),
    });
    const data = (await res.json()) as {
      ok: boolean;
      protocol?: number;
      error?: string;
      syncedAt?: number;
      records?: CloudRecord[];
      conflicts?: CloudConflict[];
    };
    if (res.status === 409 && data.conflicts) await metaSet(CONFLICT_KEY, data.conflicts);
    if (!res.ok || !data.ok || data.protocol !== 2 || !Array.isArray(data.records))
      return {
        ok: false,
        message: data.error ?? "The server needs the latest sync update.",
        pulledNodes: [],
        pulledEdges: [],
      };

    const sent = new Map<string, GraphNode | GraphEdge>([
      ...localNodes.map((n) => [`nodes:${n.id}`, n] as const),
      ...localEdges.map((e) => [`edges:${e.id}`, e] as const),
    ]);
    await beforeApply?.();
    const [liveNodes, liveEdges] = await Promise.all([
      dbGetAll<GraphNode>("nodes"),
      dbGetAll<GraphEdge>("edges"),
    ]);
    const live = new Map<string, GraphNode | GraphEdge>([
      ...liveNodes.map((n) => [`nodes:${n.id}`, n] as const),
      ...liveEdges.map((e) => [`edges:${e.id}`, e] as const),
    ]);
    const pulledNodes: GraphNode[] = [];
    const pulledEdges: GraphEdge[] = [];
    let deleted = false;
    const conflicts: CloudConflict[] = [];
    const nextBaseline = new Map(baseline.map((r) => [recordKey(r), r]));
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
        await dbDelete(record.kind, [record.id]);
        deleted = true;
      } else {
        await dbPut(record.kind, [record.data]);
        if (record.kind === "nodes") pulledNodes.push(record.data as GraphNode);
        else pulledEdges.push(record.data as GraphEdge);
      }
    }
    await metaSet(BASELINE_KEY, [...nextBaseline.values()]);
    await metaSet(CONFLICT_KEY, conflicts);
    try {
      // Independent, immutable Boneyard history cannot use graph replacement semantics.
      const revisions = await dbGetAll<Revision>("boneyard");
      const ideaResponse = await authenticatedFetch("/api/boneyard-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ syncKey, revisions }),
      });
      const ideaData = (await ideaResponse.json()) as {
        ok?: boolean;
        boneyardProtocol?: number;
        revisions?: unknown;
        error?: string;
      };
      if (!ideaResponse.ok || !ideaData.ok || ideaData.boneyardProtocol !== 1)
        throw new Error(
          ideaData.error ?? "Update the server to sync Boneyard history. Local ideas are safe.",
        );
      const { mergeRevisions } = await import("./boneyard/repository");
      await mergeRevisions(parseRevisions(ideaData.revisions));
    } catch {
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
  } catch (err) {
    return {
      ok: false,
      message: `Network/sync error: ${String(err)}`,
      pulledNodes: [],
      pulledEdges: [],
    };
  }
}
