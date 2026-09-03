import { dbGetAll, dbPut } from "./idb";
import type { GraphEdge, GraphNode } from "../types";

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
  try {
    const res = await fetch("/api/sync");
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
};

export async function executeSync(): Promise<SyncResult> {
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

    const lastSyncedAt = getLastSyncedAt() ?? 0;

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

    const data = (await res.json()) as {
      ok: boolean;
      error?: string;
      syncedAt?: number;
      pulledNodes?: GraphNode[];
      pulledEdges?: GraphEdge[];
    };

    if (!res.ok || !data.ok) {
      return {
        ok: false,
        message: data.error ?? "Failed to sync with Turso.",
        pulledNodes: [],
        pulledEdges: [],
      };
    }

    const pulledNodes = data.pulledNodes ?? [];
    const pulledEdges = data.pulledEdges ?? [];

    if (pulledNodes.length > 0) {
      await dbPut("nodes", pulledNodes);
    }
    if (pulledEdges.length > 0) {
      await dbPut("edges", pulledEdges);
    }

    if (data.syncedAt) {
      localStorage.setItem(LAST_SYNCED_STORAGE, String(data.syncedAt));
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
  } catch (err) {
    return {
      ok: false,
      message: `Network/sync error: ${String(err)}`,
      pulledNodes: [],
      pulledEdges: [],
    };
  }
}
