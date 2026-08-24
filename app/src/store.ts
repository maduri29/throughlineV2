// Throughline state: normalized in-memory maps over IndexedDB (ADR-0001) with a
// full persisted undo/redo op-log (ADR-0003) and hybrid autosave (ADR-0004).
import { create } from "zustand";
import { demoGraph, uuidv7 } from "./demo";
import { splitSceneChunks } from "./data/fountain";
import { requestDurableStorage, type Durability } from "./data/durability";
import { buildEnvelope, downloadEnvelope, parseEnvelope, type Envelope } from "./data/envelope";
import { markSyncDirty, pushOne, readGate, readSync, writeSync } from "./data/cloudSync";
import { cloudStatus, forkTitle, type CloudStatus } from "./data/sync";
import { dbDelete, dbGetAll, dbPut, metaGet, metaSet } from "./data/idb";
import { scopeToProject } from "./data/scopes";
import {
  applyBatch,
  invertBatch,
  isLegal,
  type HistoryEntry,
  type NodeMaps,
  type Op,
} from "./data/ops";
import type { EdgeType, GraphEdge, GraphNode, NodeType } from "./types";

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
  /** Cloud side of the indicator pair. Local status stays in `status` (ADR-0007). */
  cloud: CloudStatus;
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
  /** Create any entity type with sensible defaults; episodes nest under the project. */
  addNodeOfType: (type: Exclude<NodeType, "project">) => string;
  /** Split .fountain text into scene nodes under the project; returns scene count. */
  importFountain: (text: string) => number;
  switchProject: (id: string) => Promise<void>;
  createProject: (title: string) => Promise<void>;
  /** Put the sample story on the shelf, on request only. */
  openSample: () => Promise<void>;
  /** Storage bucket status; null until boot has asked. */
  durability: Durability | null;
  /** Lossless graph export (ADR-0001 envelope). */
  exportProject: () => void;
  /** Lossless graph import; returns an error string, or null on success. */
  importProject: (text: string) => Promise<string | null>;
  undo: () => void;
  redo: () => void;
  forceSave: () => Promise<void>;
  /** Push the open story now, forking if the cloud has moved on. */
  syncNow: () => Promise<void>;
  refreshCloud: () => Promise<void>;
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
    // Local save landed; the cloud is now behind. Marking dirty before the push
    // is scheduled means a crash in between leaves the story queued, not "clean".
    const pid = s.projectId;
    if (pid) {
      await markSyncDirty(pid);
      void refreshCloud();
      scheduleCloudPush();
    }
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

/* --------------------------------------------------------------- cloud -- */

/** Longer than the local flush: the network is slower and far more expensive. */
const CLOUD_MS = 2500;
let cloudTimer: ReturnType<typeof setTimeout> | null = null;

/** Re-read the current project from IndexedDB without the switchProject guard. */
async function reloadProject(id: string): Promise<void> {
  const [nodesArr, edgesArr] = await Promise.all([
    dbGetAll<GraphNode>("nodes"),
    dbGetAll<GraphEdge>("edges"),
  ]);
  const allNodes: Record<string, GraphNode> = {};
  for (const n of nodesArr) allNodes[n.id] = n;
  const allEdges: Record<string, GraphEdge> = {};
  for (const e of edgesArr) allEdges[e.id] = e;
  const scoped = scopeToProject(allNodes, allEdges, id);
  useGraphStore.setState({
    nodes: scoped.nodes,
    edges: scoped.edges,
    projects: Object.values(allNodes).filter((n) => n.type === "project"),
    selection: [],
  });
}

async function refreshCloud(): Promise<void> {
  const s = useGraphStore.getState();
  if (!s.projectId) return;
  const [local, gate] = await Promise.all([readSync(s.projectId), readGate()]);
  useGraphStore.setState({ cloud: cloudStatus(local, gate, cloudTimer !== null) });
}

/**
 * The cloud refused our push because another device got there first.
 *
 * Keep OUR version as a separate story, then take theirs into the story that
 * owns the cloud row. Nothing is discarded: the writer ends up with both, and
 * the one they were just typing into is the one that keeps its identity.
 */
async function applyConflict(remote: Envelope, remoteRevision: number): Promise<void> {
  const s = useGraphStore.getState();
  const pid = s.projectId;
  const project = pid ? s.nodes[pid] : undefined;
  if (!pid || !project) return;

  // 1. Our version, copied out under fresh ids so it cannot collide with theirs.
  const forkId = uuidv7();
  const remap = new Map<string, string>([[pid, forkId]]);
  const mine = Object.values(s.nodes).filter((n) => n.id !== pid);
  for (const n of mine) remap.set(n.id, uuidv7());

  const container: GraphNode = { ...project, id: forkId, title: forkTitle(project.title) };
  const forkNodes: GraphNode[] = [container];
  for (const n of mine) {
    const copy: GraphNode = { ...n, id: remap.get(n.id) as string };
    if (n.parentId) copy.parentId = remap.get(n.parentId) ?? forkId;
    if (n.order) {
      copy.order = n.order.map((i) => remap.get(i)).filter((x): x is string => Boolean(x));
    }
    forkNodes.push(copy);
  }
  if (container.order) {
    container.order = container.order
      .map((i) => remap.get(i))
      .filter((x): x is string => Boolean(x));
  }
  const forkEdges: GraphEdge[] = Object.values(s.edges).map((e) => ({
    ...e,
    id: uuidv7(),
    from: remap.get(e.from) as string,
    to: remap.get(e.to) as string,
  }));

  // Written BEFORE anything is removed: if this fails, we have changed nothing.
  await dbPut("nodes", forkNodes);
  await dbPut("edges", forkEdges);
  await writeSync(forkId, { base: null, dirty: true });

  // 2. Their version replaces ours in the story that owns the cloud row.
  await dbDelete(
    "nodes",
    Object.keys(s.nodes).filter((id) => id !== pid),
  );
  await dbDelete("edges", Object.keys(s.edges));
  await dbPut("nodes", [{ ...remote.project, id: pid }, ...remote.nodes]);
  await dbPut("edges", remote.edges);
  await writeSync(pid, { base: remoteRevision, dirty: false });

  await reloadProject(pid);
}

function scheduleCloudPush(): void {
  if (cloudTimer) clearTimeout(cloudTimer);
  cloudTimer = setTimeout(() => {
    cloudTimer = null;
    void useGraphStore.getState().syncNow();
  }, CLOUD_MS);
}

export const useGraphStore = create<State & Actions>()((set, get) => ({
  status: "booting",
  durability: null,
  projects: [],
  projectId: null,
  nodes: {},
  edges: {},
  selection: [],
  canUndo: false,
  canRedo: false,
  bootError: null,
  cloud: "off",

  boot: async () => {
    set({ status: "booting" });
    // Ask for the persistent storage bucket before the first write. Never
    // blocks boot: a refusal is normal on a first visit, not an error.
    void requestDurableStorage().then((d) => set({ durability: d }));
    try {
      const nodesArr = await dbGetAll<GraphNode>("nodes");
      const edgesArr = await dbGetAll<GraphEdge>("edges");
      // No demo is seeded here any more (ADR-0007 decision 4). Under automatic
      // sync a fabricated story would upload itself to the account and then
      // appear on every device the writer owns. The sample is now something you
      // ask for, via openSample().
      const allNodes: Record<string, GraphNode> = {};
      for (const n of nodesArr) allNodes[n.id] = n;
      const allEdges: Record<string, GraphEdge> = {};
      for (const e of edgesArr) allEdges[e.id] = e;
      const projects = Object.values(allNodes).filter((n) => n.type === "project");
      const lastId = await metaGet<string>("lastProjectId");
      const project = projects.find((p) => p.id === lastId) ?? projects[0] ?? null;
      if (project) {
        await metaSet("lastProjectId", project.id);
        await loadHistory(project.id);
      }
      const scoped = project
        ? scopeToProject(allNodes, allEdges, project.id)
        : { nodes: {}, edges: {} };
      set({
        nodes: scoped.nodes,
        edges: scoped.edges,
        projects,
        projectId: project?.id ?? null,
        status: "saved",
        canUndo: undoStack.length > 0,
        canRedo: redoStack.length > 0,
        selection: [],
      });
    } catch (err) {
      set({ status: "error", bootError: String(err) });
    }
  },

  /** Two-level shell (T4): swap the workspace to another story. */
  switchProject: async (id) => {
    if (get().projectId === id) return;
    // get().forceSave, not a bare forceSave: there is no module-level function of
    // that name, so this threw ReferenceError on every project switch from
    // 82942eb until the auto-seeded demo stopped hiding the path.
    await get().forceSave();
    try {
      const [nodesArr, edgesArr] = await Promise.all([
        dbGetAll<GraphNode>("nodes"),
        dbGetAll<GraphEdge>("edges"),
      ]);
      const allNodes: Record<string, GraphNode> = {};
      for (const n of nodesArr) allNodes[n.id] = n;
      const allEdges: Record<string, GraphEdge> = {};
      for (const e of edgesArr) allEdges[e.id] = e;
      const scoped = scopeToProject(allNodes, allEdges, id);
      await metaSet("lastProjectId", id);
      await loadHistory(id);
      set({
        nodes: scoped.nodes,
        edges: scoped.edges,
        projectId: id,
        selection: [],
        canUndo: undoStack.length > 0,
        canRedo: redoStack.length > 0,
        status: "saved",
      });
    } catch {
      set({ status: "error" });
    }
  },

  /** Fresh story: written through immediately; no undo entry (nothing to undo back over). */
  exportProject: () => {
    const s = get();
    const project = s.projectId ? s.nodes[s.projectId] : undefined;
    if (!project) return;
    downloadEnvelope(buildEnvelope(project, s.nodes, s.edges));
  },

  /**
   * Import as a NEW project rather than merging into the open one. Ids in the
   * file are kept, so re-importing the same export twice would collide; a fresh
   * project id is minted for the container and the incoming nodes are re-parented
   * to it, which makes import idempotent-ish and never destructive to existing work.
   */
  importProject: async (text) => {
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
      // Write before switching: a failed write must leave the open project intact.
      await dbPut("nodes", rebuilt);
      await dbPut("edges", rebuiltEdges);
    } catch {
      return "Could not write the imported project to local storage.";
    }
    set({ projects: [...get().projects, container] });
    await get().switchProject(newProjectId);
    return null;
  },

  openSample: async () => {
    const seeded = demoGraph();
    await dbPut("nodes", seeded.nodes);
    await dbPut("edges", seeded.edges);
    const added = seeded.nodes.filter((n) => n.type === "project");
    set({ projects: [...get().projects, ...added] });
    const first = added[0];
    if (first) await get().switchProject(first.id);
  },

  createProject: async (title) => {
    const node: GraphNode = { id: uuidv7(), type: "project", title };
    await dbPut("nodes", [node]);
    set({ projects: [...get().projects, node] });
    await get().switchProject(node.id);
  },

  select: (ids) => set({ selection: ids }),

  addNode: (partial) => {
    const node: GraphNode = { id: uuidv7(), title: partial.title, ...partial };
    commit(set, get, `Add ${partial.type} “${partial.title}”`, [{ t: "addNode", node }]);
    return node.id;
  },

  addNodeOfType: (type) => {
    const s = get();
    const title = `New ${type}`;
    if (type === "episode") {
      if (!s.projectId || !s.nodes[s.projectId]) return "";
      const project = s.nodes[s.projectId] as GraphNode;
      const node: GraphNode = { id: uuidv7(), type, title, parentId: project.id };
      const edge: GraphEdge = { id: uuidv7(), type: "contains", from: project.id, to: node.id };
      commit(set, get, "Add episode", [
        { t: "addNode", node },
        { t: "addEdge", edge },
        {
          t: "patchNode",
          id: project.id,
          patch: { order: [...(project.order ?? []), node.id] },
          prev: { order: project.order },
        },
      ]);
      set({ selection: [node.id] });
      return node.id;
    }
    // Own story entities under the active project so they survive scoping
    // before any edges exist (scopes keeps the parent-chain subtree). Seeds
    // stay parentless — they belong to no project yet.
    const owned = type === "character" || type === "location" || type === "theme";
    const node: GraphNode = {
      id: uuidv7(),
      type,
      title,
      synopsis: "",
      ...(owned && s.projectId && s.nodes[s.projectId] ? { parentId: s.projectId } : {}),
    };
    commit(set, get, `Add ${type}`, [{ t: "addNode", node }]);
    set({ selection: [node.id] });
    return node.id;
  },

  importFountain: (text) => {
    const s = get();
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
    commit(set, get, `Import ${chunks.length} scenes`, forward);
    set({ selection: [] });
    return chunks.length;
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

  refreshCloud,

  syncNow: async () => {
    const s = get();
    const project = s.projectId ? s.nodes[s.projectId] : undefined;
    if (!project) return;
    useGraphStore.setState({ cloud: "syncing" });
    const outcome = await pushOne(project, s.nodes, s.edges);
    if (outcome.kind === "conflict") {
      await applyConflict(outcome.remote, outcome.remoteRevision);
    }
    await refreshCloud();
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
