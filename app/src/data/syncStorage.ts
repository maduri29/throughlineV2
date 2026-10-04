import type { GraphEdge, GraphNode } from "../types";
import { dbDelete, dbGet, dbGetAll, dbPut, metaGet, metaSet } from "./idb";
import type { Revision } from "./boneyard/types";
import type { CloudConflict, CloudRecord } from "./sync-protocol";

const BASELINE_KEY = "cloud-baseline-v2";
const CONFLICT_KEY = "cloud-conflicts-v2";

/**
 * Storage seam (Feathers/Ousterhout) decoupling cloud-sync reconciliation
 * from browser IndexedDB primitives.
 */
export interface SyncStorageAdapter {
  getBaseline(): Promise<CloudRecord[]>;
  setBaseline(records: CloudRecord[]): Promise<void>;
  getConflicts(): Promise<CloudConflict[]>;
  setConflicts(conflicts: CloudConflict[]): Promise<void>;
  saveBackup(key: string, data: unknown): Promise<void>;
  getNodes(): Promise<GraphNode[]>;
  getEdges(): Promise<GraphEdge[]>;
  getNodeOrEdge(kind: "nodes" | "edges", id: string): Promise<GraphNode | GraphEdge | null>;
  putNodes(nodes: GraphNode[]): Promise<void>;
  putEdges(edges: GraphEdge[]): Promise<void>;
  deleteNodes(ids: string[]): Promise<void>;
  deleteEdges(ids: string[]): Promise<void>;
  getBoneyardRevisions(): Promise<Revision[]>;
  mergeBoneyardRevisions(revisions: Revision[]): Promise<void>;
}

class IdbSyncStorageAdapter implements SyncStorageAdapter {
  async getBaseline(): Promise<CloudRecord[]> {
    return (await metaGet<CloudRecord[]>(BASELINE_KEY)) ?? [];
  }

  async setBaseline(records: CloudRecord[]): Promise<void> {
    await metaSet(BASELINE_KEY, records);
  }

  async getConflicts(): Promise<CloudConflict[]> {
    return (await metaGet<CloudConflict[]>(CONFLICT_KEY)) ?? [];
  }

  async setConflicts(conflicts: CloudConflict[]): Promise<void> {
    await metaSet(CONFLICT_KEY, conflicts);
  }

  async saveBackup(key: string, data: unknown): Promise<void> {
    await metaSet(key, data);
  }

  async getNodes(): Promise<GraphNode[]> {
    return dbGetAll<GraphNode>("nodes");
  }

  async getEdges(): Promise<GraphEdge[]> {
    return dbGetAll<GraphEdge>("edges");
  }

  async getNodeOrEdge(kind: "nodes" | "edges", id: string): Promise<GraphNode | GraphEdge | null> {
    const res = await dbGet<GraphNode | GraphEdge>(kind, id);
    return res ?? null;
  }

  async putNodes(nodes: GraphNode[]): Promise<void> {
    if (nodes.length > 0) await dbPut("nodes", nodes);
  }

  async putEdges(edges: GraphEdge[]): Promise<void> {
    if (edges.length > 0) await dbPut("edges", edges);
  }

  async deleteNodes(ids: string[]): Promise<void> {
    if (ids.length > 0) await dbDelete("nodes", ids);
  }

  async deleteEdges(ids: string[]): Promise<void> {
    if (ids.length > 0) await dbDelete("edges", ids);
  }

  async getBoneyardRevisions(): Promise<Revision[]> {
    return dbGetAll<Revision>("boneyard");
  }

  async mergeBoneyardRevisions(revisions: Revision[]): Promise<void> {
    const { mergeRevisions } = await import("./boneyard/repository");
    await mergeRevisions(revisions);
  }
}

export class MemorySyncStorageAdapter implements SyncStorageAdapter {
  private nodes = new Map<string, GraphNode>();
  private edges = new Map<string, GraphEdge>();
  private baseline: CloudRecord[] = [];
  private conflicts: CloudConflict[] = [];
  private backups = new Map<string, unknown>();
  private revisions: Revision[] = [];

  constructor(initial?: {
    nodes?: GraphNode[];
    edges?: GraphEdge[];
    baseline?: CloudRecord[];
    conflicts?: CloudConflict[];
    revisions?: Revision[];
  }) {
    if (initial?.nodes) {
      for (const n of initial.nodes) this.nodes.set(n.id, n);
    }
    if (initial?.edges) {
      for (const e of initial.edges) this.edges.set(e.id, e);
    }
    if (initial?.baseline) {
      this.baseline = [...initial.baseline];
    }
    if (initial?.conflicts) {
      this.conflicts = [...initial.conflicts];
    }
    if (initial?.revisions) {
      this.revisions = [...initial.revisions];
    }
  }

  async getBaseline(): Promise<CloudRecord[]> {
    return [...this.baseline];
  }

  async setBaseline(records: CloudRecord[]): Promise<void> {
    this.baseline = [...records];
  }

  async getConflicts(): Promise<CloudConflict[]> {
    return [...this.conflicts];
  }

  async setConflicts(conflicts: CloudConflict[]): Promise<void> {
    this.conflicts = [...conflicts];
  }

  async saveBackup(key: string, data: unknown): Promise<void> {
    this.backups.set(key, data);
  }

  async getNodes(): Promise<GraphNode[]> {
    return [...this.nodes.values()];
  }

  async getEdges(): Promise<GraphEdge[]> {
    return [...this.edges.values()];
  }

  async getNodeOrEdge(kind: "nodes" | "edges", id: string): Promise<GraphNode | GraphEdge | null> {
    if (kind === "nodes") return this.nodes.get(id) ?? null;
    return this.edges.get(id) ?? null;
  }

  async putNodes(nodes: GraphNode[]): Promise<void> {
    for (const n of nodes) this.nodes.set(n.id, n);
  }

  async putEdges(edges: GraphEdge[]): Promise<void> {
    for (const e of edges) this.edges.set(e.id, e);
  }

  async deleteNodes(ids: string[]): Promise<void> {
    for (const id of ids) this.nodes.delete(id);
  }

  async deleteEdges(ids: string[]): Promise<void> {
    for (const id of ids) this.edges.delete(id);
  }

  async getBoneyardRevisions(): Promise<Revision[]> {
    return [...this.revisions];
  }

  async mergeBoneyardRevisions(revisions: Revision[]): Promise<void> {
    this.revisions.push(...revisions);
  }
}

let activeSyncStorage: SyncStorageAdapter = new IdbSyncStorageAdapter();

export function getSyncStorage(): SyncStorageAdapter {
  return activeSyncStorage;
}
