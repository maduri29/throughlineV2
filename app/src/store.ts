// Throughline state: normalized in-memory maps over IndexedDB (ADR-0001) with a
// full persisted undo/redo op-log (ADR-0003) and hybrid autosave (ADR-0004).
import { create } from "zustand";
import { demoGraph, uuidv7 } from "./demo";
import { dbDelete, dbGetAll, dbPut, metaGet, metaSet } from "./data/idb";
import {
  applyBatch,
  invertBatch,
  isLegal,
  type HistoryEntry,
  type NodeMaps,
  type Op,
} from "./data/ops";
import type { EdgeType, GraphEdge, GraphNode } from "./types";

export type SaveState = "booting" | "saved" | "saving" | "dirty" | "error";

type State = {
  status: SaveState;
  projects: GraphNode[];
  projectId: string | null;
  nodes: Record<string, GraphNode>;
  edges: Record<string, GraphEdge>;
  selection: string[];
  canUndo: boolean;
  canRedo: boolean;
  bootError: string | null;
};

type Actions = {
  boot: () => Promise<void>;
  select: (ids: string[]) => void;
  addNode: (partial: Pick<GraphNode, "type" | "title"> & Partial<GraphNode>) => string;
  patchNode: (id: string, patch: Partial<GraphNode>) => void;
  deleteSelection: () => void;
  connect: (from: string, to: string, type: EdgeType, label?: string) => boolean;
  patchEdge: (id: string, patch: Partial<GraphEdge>) => void;
  deleteEdge: (id: string) => void;
  setOrder: (containerId: string, order: string[]) => void;
  addScene: (parentId: string, opts?: { flashback?: boolean }) => string;
  undo: () => void;
  redo: () => void;
  forceSave: () => Promise<void>;
};

let undoStack: HistoryEntry[] = [];
let redoStack: HistoryEntry[] = [];
const dirtyNodes = new Set<string>();
const dirtyEdges = new Set<string>();
const deadNodes = new Set<string>();
const deadEdges = new Set<string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let historyTimer: ReturnType<typeof setTimeout> | null = null;

const HISTORY_CAP = 200;
const FLUSH_MS = 800;

function cloneMaps(s: State): NodeMaps {
  return { nodes: { ...s.nodes }, edges: { ...s.edges } };
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
    } else if (op.t === "addEdge" || op.t === "patchEdge") edgeIds.push(op.edge.id);
    else edgeIds.push(op.edge.id);
  }
  return { nodeIds, edgeIds };
}

function markDirty(ops: Op[]): void {
  const { nodeIds, edgeIds } = collectIds(ops);
  for (const id of nodeIds) {
    dirtyNodes.add(id);
    deadNodes.delete(id);
  }
  for (const id of edgeIds) {
    dirtyEdges.add(id);
    deadEdges.delete(id);
  }
}

async function flush(): Promise<void> {
  const s = useGraphStore.getState();
  if (s.status === "booting") return;
  const hasWork =
    dirtyNodes.size > 0 || dirtyEdges.size > 0 || deadNodes.size > 0 || deadEdges.size > 0;
  if (!hasWork) return;
  useGraphStore.setState({ status: "saving" });
  try {
    const nodeRecs = [...dirtyNodes]
      .map((id) => s.nodes[id])
      .filter((n): n is GraphNode => Boolean(n));
    const edgeRecs = [...dirtyEdges]
      .map((id) => s.edges[id])
      .filter((e): e is GraphEdge => Boolean(e));
    await dbPut("nodes", nodeRecs);
    await dbPut("edges", edgeRecs);
    await dbDelete("nodes", [...deadNodes]);
    await dbDelete("edges", [...deadEdges]);
    dirtyNodes.clear();
    dirtyEdges.clear();
    deadNodes.clear();
    deadEdges.clear();
    useGraphStore.setState({ status: "saved" });
  } catch {
    useGraphStore.setState({ status: "error" });
  }
}

function scheduleFlush(): void {
  useGraphStore.setState({ status: "dirty" });
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flush();
  }, FLUSH_MS);
}

function persistHistory(projectId: string | null): void {
  if (!projectId) return;
  if (historyTimer) clearTimeout(historyTimer);
  historyTimer = setTimeout(() => {
    historyTimer = null;
    void dbPut("history", [{ projectId, entries: undoStack.slice(), redo: redoStack.slice() }]);
  }, 400);
}

async function loadHistory(projectId: string): Promise<void> {
  undoStack = [];
  redoStack = [];
  try {
    const recs = await dbGetAll<{
      projectId: string;
      entries: HistoryEntry[];
      redo: HistoryEntry[];
    }>("history");
    const mine = recs.find((r) => r.projectId === projectId);
    if (mine) {
      undoStack = mine.entries.slice(-HISTORY_CAP);
      redoStack = mine.redo.slice(-HISTORY_CAP);
    }
  } catch {
    /* corrupt history tail is discarded per ADR-0003 */
  }
}

/** Central mutation chokepoint: apply forward ops, remember inverse, autosave. */
function commit(
  set: typeof useGraphStore.setState,
  get: typeof useGraphStore.getState,
  label: string,
  forward: Op[],
): void {
  const inverse = invertBatch(forward);
  const m = cloneMaps(get());
  applyBatch(m, forward);
  undoStack.push({ at: Date.now(), label, forward, inverse });
  if (undoStack.length > HISTORY_CAP) undoStack.shift();
  redoStack = [];
  markDirty(forward);
  persistHistory(get().projectId);
  scheduleFlush();
  set({
    nodes: m.nodes,
    edges: m.edges,
    projects: Object.values(m.nodes).filter((n) => n.type === "project"),
    canUndo: true,
    canRedo: false,
  });
}

export const useGraphStore = create<State & Actions>()((set, get) => ({
  status: "booting",
  projects: [],
  projectId: null,
  nodes: {},
  edges: {},
  selection: [],
  canUndo: false,
  canRedo: false,
  bootError: null,

  boot: async () => {
    set({ status: "booting" });
    try {
      let nodesArr = await dbGetAll<GraphNode>("nodes");
      let edgesArr = await dbGetAll<GraphEdge>("edges");
      if (nodesArr.length === 0) {
        const seeded = demoGraph();
        nodesArr = seeded.nodes;
        edgesArr = seeded.edges;
        await dbPut("nodes", nodesArr);
        await dbPut("edges", edgesArr);
      }
      const nodes: Record<string, GraphNode> = {};
      for (const n of nodesArr) nodes[n.id] = n;
      const edges: Record<string, GraphEdge> = {};
      for (const e of edgesArr) edges[e.id] = e;
      const projects = Object.values(nodes).filter((n) => n.type === "project");
      const lastId = await metaGet<string>("lastProjectId");
      const project = projects.find((p) => p.id === lastId) ?? projects[0] ?? null;
      if (project) {
        await metaSet("lastProjectId", project.id);
        await loadHistory(project.id);
      }
      set({
        nodes,
        edges,
        projects,
        projectId: project?.id ?? null,
        status: "saved",
        canUndo: undoStack.length > 0,
        canRedo: redoStack.length > 0,
      });
    } catch (err) {
      set({ status: "error", bootError: String(err) });
    }
  },

  select: (ids) => set({ selection: ids }),

  addNode: (partial) => {
    const node: GraphNode = { id: uuidv7(), title: partial.title, ...partial };
    commit(set, get, `Add ${partial.type} “${partial.title}”`, [{ t: "addNode", node }]);
    return node.id;
  },

  patchNode: (id, patch) => {
    const cur = get().nodes[id];
    if (!cur) return;
    const prev: Partial<GraphNode> = {};
    for (const k of Object.keys(patch) as (keyof GraphNode)[]) {
      prev[k] = cur[k] as never;
    }
    commit(set, get, "Edit", [{ t: "patchNode", id, patch, prev }]);
  },

  deleteSelection: () => {
    const s = get();
    const ids = s.selection.filter((id) => Boolean(s.nodes[id]));
    if (ids.length === 0) return;
    const forward: Op[] = [];
    // Parent order arrays lose the deleted ids (restored by the inverse).
    const parents = new Set(
      ids.map((id) => s.nodes[id]?.parentId).filter((p): p is string => Boolean(p)),
    );
    for (const pid of parents) {
      const p = s.nodes[pid];
      if (p?.order) {
        forward.push({
          t: "patchNode",
          id: p.id,
          patch: { order: p.order.filter((x) => !ids.includes(x)) },
          prev: { order: p.order },
        });
      }
    }
    const doomed = ids.map((id) => s.nodes[id]).filter((n): n is GraphNode => Boolean(n));
    // Every edge touching a deleted node goes with it — and comes back on undo.
    const touching = Object.values(s.edges).filter(
      (e) => ids.includes(e.from) || ids.includes(e.to),
    );
    forward.push({ t: "deleteNodes", nodes: doomed, edges: touching });
    commit(set, get, ids.length > 1 ? `Delete ${ids.length} nodes` : "Delete", forward);
    set({ selection: [] });
  },

  connect: (from, to, type, label) => {
    const s = get();
    const a = s.nodes[from];
    const b = s.nodes[to];
    if (!a || !b || from === to || !isLegal(a.type, b.type, type)) return false;
    const edge: GraphEdge = label
      ? { id: uuidv7(), type, from, to, label }
      : { id: uuidv7(), type, from, to };
    commit(set, get, `Connect ${type}`, [{ t: "addEdge", edge }]);
    return true;
  },

  patchEdge: (id, patch) => {
    const cur = get().edges[id];
    if (!cur) return;
    const prev: Partial<GraphEdge> = {};
    for (const k of Object.keys(patch) as (keyof GraphEdge)[]) {
      prev[k] = cur[k] as never;
    }
    commit(set, get, "Edit connection", [{ t: "patchEdge", id, patch, prev }]);
  },

  deleteEdge: (id) => {
    const edge = get().edges[id];
    if (!edge) return;
    commit(set, get, "Remove connection", [{ t: "deleteEdge", edge }]);
  },

  setOrder: (containerId, order) => {
    const cur = get().nodes[containerId];
    if (!cur) return;
    commit(set, get, "Reorder scenes", [
      { t: "patchNode", id: containerId, patch: { order }, prev: { order: cur.order } },
    ]);
  },

  /** Context-aware add (T5 §7): one atomic batch — node + contains edge + order append. */
  addScene: (parentId, opts) => {
    const parent = get().nodes[parentId];
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
    commit(set, get, flashback ? "Add flashback" : "Add scene", forward);
    set({ selection: [node.id] });
    return node.id;
  },

  undo: () => {
    const entry = undoStack[undoStack.length - 1];
    if (!entry) return;
    undoStack.pop();
    const m = cloneMaps(get());
    applyBatch(m, entry.inverse);
    redoStack.push(entry);
    markDirty(entry.forward);
    markDirty(entry.inverse);
    persistHistory(get().projectId);
    scheduleFlush();
    set({
      nodes: m.nodes,
      edges: m.edges,
      projects: Object.values(m.nodes).filter((n) => n.type === "project"),
      canUndo: undoStack.length > 0,
      canRedo: true,
    });
  },

  redo: () => {
    const entry = redoStack[redoStack.length - 1];
    if (!entry) return;
    redoStack.pop();
    const m = cloneMaps(get());
    applyBatch(m, entry.forward);
    undoStack.push(entry);
    markDirty(entry.forward);
    persistHistory(get().projectId);
    scheduleFlush();
    set({
      nodes: m.nodes,
      edges: m.edges,
      projects: Object.values(m.nodes).filter((n) => n.type === "project"),
      canUndo: true,
      canRedo: redoStack.length > 0,
    });
  },

  forceSave: async () => {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    await flush();
  },
}));
