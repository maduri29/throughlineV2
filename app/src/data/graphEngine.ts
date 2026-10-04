// GraphEngine: Headless state machine and persistence seam for Throughline graphs.
// Encapsulates normalized in-memory maps, operational undo/redo op-log (ADR-0003),
// and hybrid debounced autosave flush (ADR-0004).

import { demoGraph } from "../demo";
import { uuidv7 } from "./uuid";
import { splitSceneChunks } from "./fountain";
import { deleteFile } from "./files";
import { buildEnvelope, downloadEnvelope, parseEnvelope } from "./envelope";
import { dbDelete, dbGet, dbGetAll, dbPut, dbTransaction, metaGet, metaSet } from "./idb";
import { projectDeletionIds } from "./library";
import { scopeToProject } from "./scopes";
import { applyBatch, invertBatch, isLegal, type HistoryEntry, type NodeMaps, type Op } from "./ops";
import type { EdgeType, GraphEdge, GraphNode, NodeType } from "../types";

type SaveStatus = "booting" | "saved" | "saving" | "dirty" | "error";

export interface GraphEngineState {
  status: SaveStatus;
  projects: GraphNode[];
  projectId: string | null;
  nodes: Record<string, GraphNode>;
  edges: Record<string, GraphEdge>;
  canUndo: boolean;
  canRedo: boolean;
  bootError: string | null;
  seeds: GraphNode[];
  references: GraphNode[];
}

export interface GraphStorageAdapter {
  getAllNodes(): Promise<GraphNode[]>;
  getAllEdges(): Promise<GraphEdge[]>;
  putNodes(nodes: GraphNode[]): Promise<void>;
  putEdges(edges: GraphEdge[]): Promise<void>;
  deleteNodes(ids: string[]): Promise<void>;
  deleteEdges(ids: string[]): Promise<void>;
  getHistory(projectId: string): Promise<{ entries: HistoryEntry[]; redo: HistoryEntry[] } | null>;
  putHistory(projectId: string, entries: HistoryEntry[], redo: HistoryEntry[]): Promise<void>;
  deleteHistory(projectId: string): Promise<void>;
  getMeta<T>(key: string): Promise<T | null>;
  setMeta<T>(key: string, value: T): Promise<void>;
  deleteProjectTransaction(nodeIds: string[], edgeIds: string[], projectId: string): Promise<void>;
}

const defaultIdbStorageAdapter: GraphStorageAdapter = {
  getAllNodes: () => dbGetAll<GraphNode>("nodes"),
  getAllEdges: () => dbGetAll<GraphEdge>("edges"),
  putNodes: (nodes) => dbPut("nodes", nodes),
  putEdges: (edges) => dbPut("edges", edges),
  deleteNodes: (ids) => dbDelete("nodes", ids),
  deleteEdges: (ids) => dbDelete("edges", ids),
  getHistory: async (projectId) => {
    try {
      const mine = await dbGet<{
        projectId: string;
        entries: HistoryEntry[];
        redo: HistoryEntry[];
      }>("history", projectId);
      return mine ? { entries: mine.entries, redo: mine.redo } : null;
    } catch {
      return null;
    }
  },
  putHistory: (projectId, entries, redo) => dbPut("history", [{ projectId, entries, redo }]),
  deleteHistory: (projectId) => dbDelete("history", [projectId]),
  getMeta: async (key) => (await metaGet(key)) ?? null,
  setMeta: (key, value) => metaSet(key, value),
  deleteProjectTransaction: async (nodeIds, edgeIds, projectId) => {
    await dbTransaction(["nodes", "edges", "history", "meta"], (tx) => {
      for (const nodeId of nodeIds) tx.objectStore("nodes").delete(nodeId);
      for (const edgeId of edgeIds) tx.objectStore("edges").delete(edgeId);
      tx.objectStore("history").delete(projectId);
      tx.objectStore("meta").put({ key: "lastProjectId", value: null });
    });
  },
};

export class MemoryGraphStorageAdapter implements GraphStorageAdapter {
  nodes = new Map<string, GraphNode>();
  edges = new Map<string, GraphEdge>();
  meta = new Map<string, unknown>();
  history = new Map<string, { entries: HistoryEntry[]; redo: HistoryEntry[] }>();

  async getAllNodes(): Promise<GraphNode[]> {
    return Array.from(this.nodes.values());
  }
  async getAllEdges(): Promise<GraphEdge[]> {
    return Array.from(this.edges.values());
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
  async getHistory(
    projectId: string,
  ): Promise<{ entries: HistoryEntry[]; redo: HistoryEntry[] } | null> {
    return this.history.get(projectId) ?? null;
  }
  async putHistory(
    projectId: string,
    entries: HistoryEntry[],
    redo: HistoryEntry[],
  ): Promise<void> {
    this.history.set(projectId, { entries, redo });
  }
  async deleteHistory(projectId: string): Promise<void> {
    this.history.delete(projectId);
  }
  async getMeta<T>(key: string): Promise<T | null> {
    return (this.meta.get(key) as T) ?? null;
  }
  async setMeta<T>(key: string, value: T): Promise<void> {
    this.meta.set(key, value);
  }
  async deleteProjectTransaction(
    nodeIds: string[],
    edgeIds: string[],
    projectId: string,
  ): Promise<void> {
    for (const id of nodeIds) this.nodes.delete(id);
    for (const id of edgeIds) this.edges.delete(id);
    this.history.delete(projectId);
    this.meta.set("lastProjectId", null);
  }
}

const HISTORY_CAP = 200;
const FLUSH_MS = 800;

function cloneMaps(s: GraphEngineState, touchesNodes = true, touchesEdges = true): NodeMaps {
  return {
    nodes: touchesNodes ? { ...s.nodes } : s.nodes,
    edges: touchesEdges ? { ...s.edges } : s.edges,
  };
}

function opsTouch(ops: Op[]): { touchesNodes: boolean; touchesEdges: boolean } {
  let touchesNodes = false;
  let touchesEdges = false;
  for (const op of ops) {
    if (op.t === "addNode" || op.t === "patchNode") {
      touchesNodes = true;
    } else if (op.t === "addEdge" || op.t === "patchEdge" || op.t === "deleteEdge") {
      touchesEdges = true;
    } else if (op.t === "deleteNodes") {
      if (op.nodes.length > 0) touchesNodes = true;
      if (op.edges.length > 0) touchesEdges = true;
    }
  }
  return { touchesNodes, touchesEdges };
}

function collectIds(ops: Op[]): { nodeIds: string[]; edgeIds: string[] } {
  const nodeIds: string[] = [];
  const edgeIds: string[] = [];
  for (const op of ops) {
    if (op.t === "addNode") nodeIds.push(op.node.id);
    else if (op.t === "patchNode") nodeIds.push(op.id);
    else if (op.t === "deleteNodes") {
      nodeIds.push(...op.nodes.map((n) => n.id));
      edgeIds.push(...op.edges.map((e) => e.id));
    } else if (op.t === "patchEdge") edgeIds.push(op.id);
    else edgeIds.push(op.edge.id);
  }
  return { nodeIds, edgeIds };
}

export class GraphEngine {
  private storage: GraphStorageAdapter;
  private state: GraphEngineState;
  private listeners = new Set<(state: GraphEngineState) => void>();

  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];
  private deletingProject = false;
  private dirtyNodes = new Set<string>();
  private dirtyEdges = new Set<string>();
  private deadNodes = new Set<string>();
  private deadEdges = new Set<string>();
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private historyTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(storage: GraphStorageAdapter = defaultIdbStorageAdapter) {
    this.storage = storage;
    this.state = {
      status: "booting",
      projects: [],
      projectId: null,
      nodes: {},
      edges: {},
      canUndo: false,
      canRedo: false,
      bootError: null,
      seeds: [],
      references: [],
    };
  }

  public getState(): GraphEngineState {
    return this.state;
  }

  public isDeletingProject(): boolean {
    return this.deletingProject;
  }

  public subscribe(listener: (state: GraphEngineState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(partial: Partial<GraphEngineState>): void {
    this.state = { ...this.state, ...partial };
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  private markDirty(ops: Op[]): void {
    const { nodeIds, edgeIds } = collectIds(ops);
    for (const id of nodeIds) {
      this.dirtyNodes.add(id);
      this.deadNodes.delete(id);
    }
    for (const id of edgeIds) {
      this.dirtyEdges.add(id);
      this.deadEdges.delete(id);
    }
  }

  public async flush(): Promise<void> {
    if (this.state.status === "booting") return;
    const hasWork =
      this.dirtyNodes.size > 0 ||
      this.dirtyEdges.size > 0 ||
      this.deadNodes.size > 0 ||
      this.deadEdges.size > 0;
    if (!hasWork) return;

    this.emit({ status: "saving" });
    try {
      const nodeRecs = [...this.dirtyNodes]
        .map((id) => this.state.nodes[id])
        .filter((n): n is GraphNode => Boolean(n));
      const edgeRecs = [...this.dirtyEdges]
        .map((id) => this.state.edges[id])
        .filter((e): e is GraphEdge => Boolean(e));

      await this.storage.putNodes(nodeRecs);
      await this.storage.putEdges(edgeRecs);
      await this.storage.deleteNodes([...this.deadNodes]);
      await this.storage.deleteEdges([...this.deadEdges]);

      this.dirtyNodes.clear();
      this.dirtyEdges.clear();
      this.deadNodes.clear();
      this.deadEdges.clear();
      this.emit({ status: "saved" });
    } catch {
      this.emit({ status: "error" });
    }
  }

  private scheduleFlush(): void {
    this.emit({ status: "dirty" });
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      void this.flush();
    }, FLUSH_MS);
  }

  private persistHistory(projectId: string | null): void {
    if (!projectId) return;
    if (this.historyTimer) clearTimeout(this.historyTimer);
    this.historyTimer = setTimeout(() => {
      this.historyTimer = null;
      void this.storage.putHistory(projectId, this.undoStack.slice(), this.redoStack.slice());
    }, 400);
  }

  private async loadHistory(projectId: string): Promise<void> {
    this.undoStack = [];
    this.redoStack = [];
    try {
      const mine = await this.storage.getHistory(projectId);
      if (mine) {
        this.undoStack = mine.entries.slice(-HISTORY_CAP);
        this.redoStack = mine.redo.slice(-HISTORY_CAP);
      }
    } catch {
      /* corrupt history tail is discarded per ADR-0003 */
    }
  }

  public commit(label: string, forward: Op[]): void {
    const inverse = invertBatch(forward);
    const current = this.state;
    const { touchesNodes, touchesEdges } = opsTouch(forward);
    const m = cloneMaps(current, touchesNodes, touchesEdges);
    applyBatch(m, forward);

    this.undoStack.push({ at: Date.now(), label, forward, inverse });
    if (this.undoStack.length > HISTORY_CAP) this.undoStack.shift();
    this.redoStack = [];
    this.markDirty(forward);
    this.persistHistory(current.projectId);
    this.scheduleFlush();

    const touchesProject =
      touchesNodes &&
      forward.some((op) => {
        if (op.t === "addNode") return op.node.type === "project";
        if (op.t === "patchNode") return current.nodes[op.id]?.type === "project";
        if (op.t === "deleteNodes") return op.nodes.some((n) => n.type === "project");
        return false;
      });

    const nextProjects = touchesProject
      ? Object.values(m.nodes).filter((n) => n.type === "project")
      : current.projects;

    this.emit({
      nodes: m.nodes,
      edges: m.edges,
      projects: nextProjects,
      canUndo: true,
      canRedo: false,
    });
  }

  public async boot(): Promise<void> {
    this.emit({ status: "booting" });
    try {
      const nodesArr = await this.storage.getAllNodes();
      const edgesArr = await this.storage.getAllEdges();

      const allNodes: Record<string, GraphNode> = {};
      for (const n of nodesArr) allNodes[n.id] = n;
      const allEdges: Record<string, GraphEdge> = {};
      for (const e of edgesArr) allEdges[e.id] = e;

      const projects = Object.values(allNodes).filter((n) => n.type === "project");
      const seeds = Object.values(allNodes).filter((n) => n.type === "seed" && !n.parentId);
      const references = Object.values(allNodes).filter((n) => n.type === "reference");
      const lastId = await this.storage.getMeta<string>("lastProjectId");
      const project = projects.find((p) => p.id === lastId) ?? projects[0] ?? null;

      if (project) {
        await this.storage.setMeta("lastProjectId", project.id);
        await this.loadHistory(project.id);
      }

      const scoped = project
        ? scopeToProject(allNodes, allEdges, project.id)
        : { nodes: {}, edges: {} };

      this.emit({
        nodes: scoped.nodes,
        edges: scoped.edges,
        projects,
        projectId: project?.id ?? null,
        status: "saved",
        canUndo: this.undoStack.length > 0,
        canRedo: this.redoStack.length > 0,
        seeds,
        references,
      });
    } catch (err) {
      this.emit({ status: "error", bootError: String(err) });
    }
  }

  public async forceSave(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
  }

  public async switchProject(id: string): Promise<void> {
    if (this.state.projectId === id) return;
    await this.forceSave();
    try {
      const [nodesArr, edgesArr] = await Promise.all([
        this.storage.getAllNodes(),
        this.storage.getAllEdges(),
      ]);
      const allNodes: Record<string, GraphNode> = {};
      for (const n of nodesArr) allNodes[n.id] = n;
      const allEdges: Record<string, GraphEdge> = {};
      for (const e of edgesArr) allEdges[e.id] = e;
      const scoped = scopeToProject(allNodes, allEdges, id);
      await this.storage.setMeta("lastProjectId", id);
      await this.loadHistory(id);
      this.emit({
        nodes: scoped.nodes,
        edges: scoped.edges,
        projectId: id,
        canUndo: this.undoStack.length > 0,
        canRedo: this.redoStack.length > 0,
        status: "saved",
      });
    } catch {
      this.emit({ status: "error" });
    }
  }

  public async deleteProject(id: string): Promise<void> {
    if (this.deletingProject) {
      throw new Error("Project deletion is already in progress.");
    }
    this.deletingProject = true;
    try {
      await this.forceSave();
      if (this.state.status === "error") {
        throw new Error("Could not save current edits. Retry saving before deleting.");
      }
      const [allNodes, allEdges] = await Promise.all([
        this.storage.getAllNodes(),
        this.storage.getAllEdges(),
      ]);
      const ids = projectDeletionIds(allNodes, id);
      if (!ids.size) return;
      const edgeIds = allEdges
        .filter((edge) => ids.has(edge.from) || ids.has(edge.to))
        .map((edge) => edge.id);

      await this.storage.deleteProjectTransaction([...ids], edgeIds, id);

      if (this.state.projectId === id) {
        this.undoStack = [];
        this.redoStack = [];
        this.emit({
          nodes: {},
          edges: {},
          projectId: null,
          canUndo: false,
          canRedo: false,
          status: "saved",
        });
      }
      this.emit({
        projects: this.state.projects.filter((project) => project.id !== id),
        edges: Object.fromEntries(
          Object.entries(this.state.edges).filter(([edgeId]) => !edgeIds.includes(edgeId)),
        ),
      });
    } finally {
      this.deletingProject = false;
    }
  }

  public async reloadScoped(): Promise<void> {
    const [nodesArr, edgesArr] = await Promise.all([
      this.storage.getAllNodes(),
      this.storage.getAllEdges(),
    ]);
    const allNodes: Record<string, GraphNode> = {};
    for (const n of nodesArr) allNodes[n.id] = n;
    const allEdges: Record<string, GraphEdge> = {};
    for (const e of edgesArr) allEdges[e.id] = e;

    const projects = Object.values(allNodes).filter((n) => n.type === "project");
    const seeds = Object.values(allNodes).filter((n) => n.type === "seed" && !n.parentId);
    const curProjectId = this.state.projectId;
    const scoped = curProjectId
      ? scopeToProject(allNodes, allEdges, curProjectId)
      : { nodes: {}, edges: {} };

    this.emit({
      nodes: scoped.nodes,
      edges: scoped.edges,
      projects,
      seeds,
    });
  }

  public async createProject(title: string): Promise<string> {
    const node: GraphNode = { id: uuidv7(), type: "project", title };
    await this.storage.putNodes([node]);
    this.emit({ projects: [...this.state.projects, node] });
    await this.switchProject(node.id);
    return node.id;
  }

  public async openSample(): Promise<string | null> {
    const seeded = demoGraph();
    await this.storage.putNodes(seeded.nodes);
    await this.storage.putEdges(seeded.edges);
    const added = seeded.nodes.filter((n) => n.type === "project");
    this.emit({ projects: [...this.state.projects, ...added] });
    const first = added[0];
    if (first) await this.switchProject(first.id);
    return first?.id ?? null;
  }

  public exportProject(): void {
    const s = this.state;
    const project = s.projectId ? s.nodes[s.projectId] : undefined;
    if (!project) return;
    downloadEnvelope(buildEnvelope(project, s.nodes, s.edges));
  }

  public async importProject(text: string): Promise<string | null> {
    const parsed = parseEnvelope(text);
    if (!parsed.ok) return parsed.error;

    const { project, nodes, edges } = parsed.envelope;
    const newProjectId = uuidv7();
    const remap = new Map<string, string>([[project.id, newProjectId]]);
    for (const n of nodes) remap.set(n.id, uuidv7());

    const container: GraphNode = { ...project, id: newProjectId };
    const rebuilt: GraphNode[] = [container];
    for (const n of nodes) {
      const copy: GraphNode = { ...n, id: remap.get(n.id) as string };
      if (n.parentId) copy.parentId = remap.get(n.parentId) ?? newProjectId;
      if (n.order)
        copy.order = n.order.map((id) => remap.get(id)).filter((x): x is string => Boolean(x));
      rebuilt.push(copy);
    }
    if (container.order) {
      container.order = container.order
        .map((id) => remap.get(id))
        .filter((x): x is string => Boolean(x));
    }
    const rebuiltEdges: GraphEdge[] = edges.map((e) => ({
      ...e,
      id: uuidv7(),
      from: remap.get(e.from) as string,
      to: remap.get(e.to) as string,
    }));

    try {
      await this.storage.putNodes(rebuilt);
      await this.storage.putEdges(rebuiltEdges);
    } catch {
      return "Could not write the imported project to local storage.";
    }
    this.emit({ projects: [...this.state.projects, container] });
    await this.switchProject(newProjectId);
    return null;
  }

  public async addReference(
    title: string,
    projectId: string | null,
    extra?: Partial<GraphNode>,
  ): Promise<string> {
    const node: GraphNode = {
      ...extra,
      id: uuidv7(),
      type: "reference",
      title,
      ...(projectId ? { parentId: projectId } : {}),
    };
    try {
      await this.storage.putNodes([node]);
    } catch (err) {
      throw new Error(`Could not save to this browser's storage — ${String(err)}`);
    }
    this.emit({ references: [...this.state.references, node] });
    return node.id;
  }

  public async patchReference(id: string, patch: Partial<GraphNode>): Promise<void> {
    const cur = this.state.references.find((r) => r.id === id);
    if (!cur) return;
    const next: GraphNode = { ...cur, ...patch, id: cur.id, type: "reference" };
    await this.storage.putNodes([next]);
    this.emit({ references: this.state.references.map((r) => (r.id === id ? next : r)) });
  }

  public async deleteReference(id: string): Promise<void> {
    const cur = this.state.references.find((r) => r.id === id);
    for (const a of cur?.attachments ?? []) await deleteFile(a.id);
    await this.storage.deleteNodes([id]);
    this.emit({ references: this.state.references.filter((r) => r.id !== id) });
  }

  public async addSeed(title: string): Promise<string> {
    const node: GraphNode = { id: uuidv7(), type: "seed", title };
    await this.storage.putNodes([node]);
    this.emit({ seeds: [...this.state.seeds, node] });
    return node.id;
  }

  public async patchSeed(id: string, patch: Partial<GraphNode>): Promise<void> {
    const cur = this.state.seeds.find((s) => s.id === id);
    if (!cur) return;
    const next: GraphNode = { ...cur, ...patch, id: cur.id, type: "seed" };
    await this.storage.putNodes([next]);
    this.emit({ seeds: this.state.seeds.map((s) => (s.id === id ? next : s)) });
  }

  public async deleteSeed(id: string): Promise<void> {
    await this.storage.deleteNodes([id]);
    this.emit({ seeds: this.state.seeds.filter((s) => s.id !== id) });
  }

  public async growSeed(id: string): Promise<string | null> {
    const seed = this.state.seeds.find((s) => s.id === id);
    if (!seed) return null;
    const project: GraphNode = {
      id: uuidv7(),
      type: "project",
      title: seed.title,
      ...(seed.synopsis ? { synopsis: seed.synopsis } : {}),
    };
    const edge: GraphEdge = {
      id: uuidv7(),
      type: "grew_into",
      from: seed.id,
      to: project.id,
    };
    await this.storage.putNodes([project]);
    await this.storage.putEdges([edge]);
    this.emit({ projects: [...this.state.projects, project] });
    await this.switchProject(project.id);
    return project.id;
  }

  public addNode(partial: Pick<GraphNode, "type" | "title"> & Partial<GraphNode>): string {
    const node: GraphNode = { ...partial, id: partial.id ?? uuidv7() };
    this.commit(`Add ${partial.type} “${partial.title}”`, [{ t: "addNode", node }]);
    return node.id;
  }

  public addNodeOfType(type: Exclude<NodeType, "project">, requestedTitle?: string): string {
    const s = this.state;
    const title = requestedTitle?.trim() || `New ${type}`;
    if (type === "episode") {
      if (!s.projectId || !s.nodes[s.projectId]) return "";
      const project = s.nodes[s.projectId] as GraphNode;
      const node: GraphNode = { id: uuidv7(), type, title, parentId: project.id };
      const edge: GraphEdge = { id: uuidv7(), type: "contains", from: project.id, to: node.id };
      this.commit("Add episode", [
        { t: "addNode", node },
        { t: "addEdge", edge },
        {
          t: "patchNode",
          id: project.id,
          patch: { order: [...(project.order ?? []), node.id] },
          prev: { order: project.order },
        },
      ]);
      return node.id;
    }
    const owned = type === "character" || type === "location" || type === "theme";
    const node: GraphNode = {
      id: uuidv7(),
      type,
      title,
      synopsis: "",
      ...(owned && s.projectId && s.nodes[s.projectId] ? { parentId: s.projectId } : {}),
    };
    this.commit(`Add ${type}`, [{ t: "addNode", node }]);
    return node.id;
  }

  public importFountain(text: string): number {
    const s = this.state;
    if (!s.projectId) return 0;
    const project = s.nodes[s.projectId];
    if (!project || project.type !== "project") return 0;
    const chunks = splitSceneChunks(text);
    if (chunks.length === 0) return 0;
    const forward: Op[] = [];
    const newIds: string[] = [];
    for (const c of chunks) {
      const node: GraphNode = {
        id: uuidv7(),
        type: "scene",
        title: c.location ? (c.tod ? `${c.location} - ${c.tod}` : c.location) : "Imported scene",
        parentId: project.id,
        synopsis: "",
        storyTime: { storyDay: null, tod: c.tod, eraLabel: null },
        fountain: c.body,
        intExt: c.intExt,
      };
      newIds.push(node.id);
      forward.push(
        { t: "addNode", node },
        { t: "addEdge", edge: { id: uuidv7(), type: "contains", from: project.id, to: node.id } },
      );
    }
    forward.push({
      t: "patchNode",
      id: project.id,
      patch: { order: [...(project.order ?? []), ...newIds] },
      prev: { order: project.order },
    });
    this.commit(`Import ${chunks.length} scenes`, forward);
    return chunks.length;
  }

  public patchNode(id: string, patch: Partial<GraphNode>): void {
    const cur = this.state.nodes[id];
    if (!cur) return;
    const prev: Partial<GraphNode> = {};
    for (const k of Object.keys(patch) as (keyof GraphNode)[]) {
      prev[k] = cur[k] as never;
    }
    this.commit("Edit", [{ t: "patchNode", id, patch, prev }]);
  }

  public scheduleScenes(plan: Array<{ id: string; day: number | null }>): void {
    const { nodes } = this.state;
    const forward: Op[] = [];
    for (const { id, day } of plan) {
      const cur = nodes[id];
      if (!cur || cur.type !== "scene") continue;
      const st = cur.storyTime ?? { storyDay: null, tod: null, eraLabel: null };
      if (st.storyDay === day) continue;
      forward.push({
        t: "patchNode",
        id,
        patch: { storyTime: { ...st, storyDay: day } },
        prev: { storyTime: cur.storyTime },
      });
    }
    if (forward.length === 0) return;
    this.commit(`Schedule ${forward.length} scenes`, forward);
  }

  public deleteNodes(ids: string[]): void {
    const s = this.state;
    const validIds = ids.filter((id) => Boolean(s.nodes[id]));
    if (validIds.length === 0) return;
    const forward: Op[] = [];
    const parents = new Set(
      validIds.map((id) => s.nodes[id]?.parentId).filter((p): p is string => Boolean(p)),
    );
    for (const pid of parents) {
      const p = s.nodes[pid];
      if (p?.order) {
        forward.push({
          t: "patchNode",
          id: p.id,
          patch: { order: p.order.filter((x) => !validIds.includes(x)) },
          prev: { order: p.order },
        });
      }
    }
    const doomed = validIds.map((id) => s.nodes[id]).filter((n): n is GraphNode => Boolean(n));
    const touching = Object.values(s.edges).filter(
      (e) => validIds.includes(e.from) || validIds.includes(e.to),
    );
    forward.push({ t: "deleteNodes", nodes: doomed, edges: touching });
    this.commit(validIds.length > 1 ? `Delete ${validIds.length} nodes` : "Delete", forward);
  }

  public connect(from: string, to: string, type: EdgeType, label?: string): boolean {
    const s = this.state;
    const a = s.nodes[from];
    const b = s.nodes[to];
    if (!a || !b || from === to || !isLegal(a.type, b.type, type)) return false;
    const edge: GraphEdge = label
      ? { id: uuidv7(), type, from, to, label }
      : { id: uuidv7(), type, from, to };
    this.commit(`Connect ${type}`, [{ t: "addEdge", edge }]);
    return true;
  }

  public patchEdge(id: string, patch: Partial<GraphEdge>): void {
    const cur = this.state.edges[id];
    if (!cur) return;
    const prev: Partial<GraphEdge> = {};
    for (const k of Object.keys(patch) as (keyof GraphEdge)[]) {
      prev[k] = cur[k] as never;
    }
    this.commit("Edit connection", [{ t: "patchEdge", id, patch, prev }]);
  }

  public deleteEdge(id: string): void {
    const edge = this.state.edges[id];
    if (!edge) return;
    this.commit("Remove connection", [{ t: "deleteEdge", edge }]);
  }

  public setOrder(containerId: string, order: string[]): void {
    const cur = this.state.nodes[containerId];
    if (!cur) return;
    this.commit("Reorder scenes", [
      { t: "patchNode", id: containerId, patch: { order }, prev: { order: cur.order } },
    ]);
  }

  public moveScene(sceneId: string, containerId: string, beforeId?: string): void {
    const s = this.state;
    const scene = s.nodes[sceneId];
    const target = s.nodes[containerId];
    if (
      !scene ||
      scene.type !== "scene" ||
      !target ||
      !["project", "episode"].includes(target.type) ||
      beforeId === sceneId
    )
      return;
    if (containerId !== s.projectId && target.parentId !== s.projectId) return;

    const ops: Op[] = [];
    for (const container of Object.values(s.nodes)) {
      if (!container.order?.includes(sceneId) || container.id === containerId) continue;
      ops.push({
        t: "patchNode",
        id: container.id,
        patch: { order: container.order.filter((id) => id !== sceneId) },
        prev: { order: container.order },
      });
    }
    const order = (target.order ?? []).filter((id) => id !== sceneId);
    const index = beforeId ? order.indexOf(beforeId) : -1;
    order.splice(index < 0 ? order.length : index, 0, sceneId);
    ops.push({ t: "patchNode", id: containerId, patch: { order }, prev: { order: target.order } });

    if (scene.parentId !== containerId) {
      ops.push({
        t: "patchNode",
        id: sceneId,
        patch: { parentId: containerId },
        prev: { parentId: scene.parentId },
      });
      for (const edge of Object.values(s.edges)) {
        if (edge.type === "contains" && edge.to === sceneId) ops.push({ t: "deleteEdge", edge });
      }
      ops.push({
        t: "addEdge",
        edge: { id: uuidv7(), type: "contains", from: containerId, to: sceneId },
      });
    }
    this.commit("Move scene", ops);
  }

  public addScene(parentId: string, opts?: { flashback?: boolean }): string {
    const parent = this.state.nodes[parentId];
    if (!parent) return "";
    const flashback = opts?.flashback === true;
    const node: GraphNode = {
      id: uuidv7(),
      type: "scene",
      title: flashback ? "New flashback" : "New scene",
      parentId,
      synopsis: "",
      storyTime: {
        storyDay: flashback ? -1 : null,
        tod: flashback ? "Night" : null,
        eraLabel: null,
      },
    };
    const edge: GraphEdge = { id: uuidv7(), type: "contains", from: parentId, to: node.id };
    const forward: Op[] = [
      { t: "addNode", node },
      { t: "addEdge", edge },
      {
        t: "patchNode",
        id: parent.id,
        patch: { order: [...(parent.order ?? []), node.id] },
        prev: { order: parent.order },
      },
    ];
    this.commit(flashback ? "Add flashback" : "Add scene", forward);
    return node.id;
  }

  public undo(): void {
    const entry = this.undoStack[this.undoStack.length - 1];
    if (!entry) return;
    this.undoStack.pop();
    const current = this.state;
    const { touchesNodes, touchesEdges } = opsTouch(entry.inverse);
    const m = cloneMaps(current, touchesNodes, touchesEdges);
    applyBatch(m, entry.inverse);
    this.redoStack.push(entry);
    this.markDirty(entry.forward);
    this.markDirty(entry.inverse);
    this.persistHistory(current.projectId);
    this.scheduleFlush();

    const touchesProject =
      touchesNodes &&
      entry.inverse.some((op) => {
        if (op.t === "addNode") return op.node.type === "project";
        if (op.t === "patchNode") return current.nodes[op.id]?.type === "project";
        if (op.t === "deleteNodes") return op.nodes.some((n) => n.type === "project");
        return false;
      });

    this.emit({
      nodes: m.nodes,
      edges: m.edges,
      projects: touchesProject
        ? Object.values(m.nodes).filter((n) => n.type === "project")
        : current.projects,
      canUndo: this.undoStack.length > 0,
      canRedo: true,
    });
  }

  public redo(): void {
    const entry = this.redoStack[this.redoStack.length - 1];
    if (!entry) return;
    this.redoStack.pop();
    const current = this.state;
    const { touchesNodes, touchesEdges } = opsTouch(entry.forward);
    const m = cloneMaps(current, touchesNodes, touchesEdges);
    applyBatch(m, entry.forward);
    this.undoStack.push(entry);
    this.markDirty(entry.forward);
    this.persistHistory(current.projectId);
    this.scheduleFlush();

    const touchesProject =
      touchesNodes &&
      entry.forward.some((op) => {
        if (op.t === "addNode") return op.node.type === "project";
        if (op.t === "patchNode") return current.nodes[op.id]?.type === "project";
        if (op.t === "deleteNodes") return op.nodes.some((n) => n.type === "project");
        return false;
      });

    this.emit({
      nodes: m.nodes,
      edges: m.edges,
      projects: touchesProject
        ? Object.values(m.nodes).filter((n) => n.type === "project")
        : current.projects,
      canUndo: true,
      canRedo: this.redoStack.length > 0,
    });
  }
}
