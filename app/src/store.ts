// Throughline state: normalized in-memory maps over IndexedDB (ADR-0001) with a
// full persisted undo/redo op-log (ADR-0003) and hybrid autosave (ADR-0004).
import { create } from "zustand";
import { demoGraph } from "./demo";
import { uuidv7 } from "./data/uuid";
import { splitSceneChunks } from "./data/fountain";
import { requestDurableStorage, type Durability } from "./data/durability";
import { deleteFile } from "./data/files";
import { buildEnvelope, downloadEnvelope, parseEnvelope } from "./data/envelope";
import { dbDelete, dbGet, dbGetAll, dbPut, metaGet, metaSet } from "./data/idb";
import { scopeToProject } from "./data/scopes";
import { executeSync } from "./data/sync";
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
  /** Raw ideas not yet belonging to any project (CONTEXT: Seed). */
  seeds: GraphNode[];
  /** Research material. Parentless ones are shared across every story. */
  references: GraphNode[];
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
  /** Resolves to the new project id so the caller can navigate to it. */
  createProject: (title: string) => Promise<string>;
  /** Add research material; `projectId` null keeps it shared across stories. */
  addReference: (
    title: string,
    projectId: string | null,
    extra?: Partial<GraphNode>,
  ) => Promise<string>;
  patchReference: (id: string, patch: Partial<GraphNode>) => Promise<void>;
  deleteReference: (id: string) => Promise<void>;
  /** Jot an idea into the boneyard; resolves to its id. */
  addSeed: (title: string) => Promise<string>;
  patchSeed: (id: string, patch: Partial<GraphNode>) => Promise<void>;
  deleteSeed: (id: string) => Promise<void>;
  /** Turn an idea into a story, keeping the link back (CONTEXT: Grew Into). */
  growSeed: (id: string) => Promise<string | null>;
  /** Put the sample story on the shelf, on request only; resolves to its id. */
  openSample: () => Promise<string | null>;
  /** Storage bucket status; null until boot has asked. */
  durability: Durability | null;
  /** Lossless graph export (ADR-0001 envelope). */
  exportProject: () => void;
  /** Lossless graph import; returns an error string, or null on success. */
  importProject: (text: string) => Promise<string | null>;
  undo: () => void;
  redo: () => void;
  forceSave: () => Promise<void>;
  syncStatus: "idle" | "syncing" | "synced" | "error";
  syncMessage: string | null;
  syncNow: () => Promise<void>;
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
    } else if (op.t === "patchEdge") edgeIds.push(op.id);
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
    const mine = await dbGet<{
      projectId: string;
      entries: HistoryEntry[];
      redo: HistoryEntry[];
    }>("history", projectId);
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
  const current = get();
  const m = cloneMaps(current);
  applyBatch(m, forward);
  undoStack.push({ at: Date.now(), label, forward, inverse });
  if (undoStack.length > HISTORY_CAP) undoStack.shift();
  redoStack = [];
  markDirty(forward);
  persistHistory(current.projectId);
  scheduleFlush();

  // Only re-filter projects if an op actually touched a project node.
  // Preserving current.projects array identity prevents spurious re-renders
  // and cascade background sync/scoping calls in Library, Boneyard, Research & Palette.
  const touchesProject = forward.some((op) => {
    if (op.t === "addNode") return op.node.type === "project";
    if (op.t === "patchNode") return current.nodes[op.id]?.type === "project";
    if (op.t === "deleteNodes") return op.nodes.some((n) => n.type === "project");
    return false;
  });

  const nextProjects = touchesProject
    ? Object.values(m.nodes).filter((n) => n.type === "project")
    : current.projects;

  set({
    nodes: m.nodes,
    edges: m.edges,
    projects: nextProjects,
    canUndo: true,
    canRedo: false,
  });
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
  seeds: [],
  references: [],
  syncStatus: "idle",
  syncMessage: null,

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
      // Parentless seeds only: one that has been adopted into a story belongs
      // to that story now, and listing it in the boneyard would double it.
      const seeds = Object.values(allNodes).filter((n) => n.type === "seed" && !n.parentId);
      const references = Object.values(allNodes).filter((n) => n.type === "reference");
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
        seeds,
        references,
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

  addReference: async (title, projectId, extra) => {
    // Throwing here used to be invisible: the caller void-ed the promise, so a
    // failed write looked identical to a dead button. Failures are rethrown with
    // context so the view can say what went wrong.
    // Like seeds, written straight through: a reference attached to no project
    // has no project history to live in, and one attached to a project is
    // material *about* the story rather than a change *to* it.
    const node: GraphNode = {
      ...extra,
      id: uuidv7(),
      type: "reference",
      title,
      ...(projectId ? { parentId: projectId } : {}),
    };
    try {
      await dbPut("nodes", [node]);
    } catch (err) {
      throw new Error(`Could not save to this browser's storage — ${String(err)}`);
    }
    set({ references: [...get().references, node] });
    return node.id;
  },

  patchReference: async (id, patch) => {
    const cur = get().references.find((r) => r.id === id);
    if (!cur) return;
    const next: GraphNode = { ...cur, ...patch, id: cur.id, type: "reference" };
    await dbPut("nodes", [next]);
    set({ references: get().references.map((r) => (r.id === id ? next : r)) });
  },

  deleteReference: async (id) => {
    const cur = get().references.find((r) => r.id === id);
    // Bytes go with the record: an orphaned blob is invisible, counts against
    // the browser quota, and nothing would ever reclaim it.
    for (const a of cur?.attachments ?? []) await deleteFile(a.id);
    await dbDelete("nodes", [id]);
    set({ references: get().references.filter((r) => r.id !== id) });
  },

  addSeed: async (title) => {
    // Written straight through rather than through the op-log: the log is scoped
    // to a project (ADR-0003) and a seed belongs to none, so there is no history
    // for it to live in. Losing an undo on a one-line idea is the cheaper trade.
    const node: GraphNode = { id: uuidv7(), type: "seed", title };
    await dbPut("nodes", [node]);
    set({ seeds: [...get().seeds, node] });
    return node.id;
  },

  patchSeed: async (id, patch) => {
    const cur = get().seeds.find((s) => s.id === id);
    if (!cur) return;
    const next: GraphNode = { ...cur, ...patch, id: cur.id, type: "seed" };
    await dbPut("nodes", [next]);
    set({ seeds: get().seeds.map((s) => (s.id === id ? next : s)) });
  },

  deleteSeed: async (id) => {
    await dbDelete("nodes", [id]);
    set({ seeds: get().seeds.filter((s) => s.id !== id) });
  },

  growSeed: async (id) => {
    const seed = get().seeds.find((s) => s.id === id);
    if (!seed) return null;
    const project: GraphNode = {
      id: uuidv7(),
      type: "project",
      title: seed.title,
      ...(seed.synopsis ? { synopsis: seed.synopsis } : {}),
    };
    // The seed is kept and linked rather than consumed: where an idea came from
    // is worth being able to look up later, and deleting it would make growing
    // a story a destructive act nobody would expect.
    const edge: GraphEdge = {
      id: uuidv7(),
      type: "grew_into",
      from: seed.id,
      to: project.id,
    };
    await dbPut("nodes", [project]);
    await dbPut("edges", [edge]);
    set({ projects: [...get().projects, project] });
    await get().switchProject(project.id);
    return project.id;
  },

  openSample: async () => {
    const seeded = demoGraph();
    await dbPut("nodes", seeded.nodes);
    await dbPut("edges", seeded.edges);
    const added = seeded.nodes.filter((n) => n.type === "project");
    set({ projects: [...get().projects, ...added] });
    const first = added[0];
    if (first) await get().switchProject(first.id);
    return first?.id ?? null;
  },

  createProject: async (title) => {
    const node: GraphNode = { id: uuidv7(), type: "project", title };
    await dbPut("nodes", [node]);
    set({ projects: [...get().projects, node] });
    await get().switchProject(node.id);
    return node.id;
  },

  select: (ids) => set({ selection: ids }),

  addNode: (partial) => {
    const node: GraphNode = { ...partial, id: partial.id ?? uuidv7() };
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

  syncNow: async () => {
    set({ syncStatus: "syncing", syncMessage: null });
    const res = await executeSync();
    if (res.pulledNodes.length > 0 || res.pulledEdges.length > 0) {
      const [nodesArr, edgesArr] = await Promise.all([
        dbGetAll<GraphNode>("nodes"),
        dbGetAll<GraphEdge>("edges"),
      ]);
      const allNodes: Record<string, GraphNode> = {};
      for (const n of nodesArr) allNodes[n.id] = n;
      const allEdges: Record<string, GraphEdge> = {};
      for (const e of edgesArr) allEdges[e.id] = e;
      const projects = Object.values(allNodes).filter((n) => n.type === "project");
      const seeds = Object.values(allNodes).filter((n) => n.type === "seed" && !n.parentId);
      const curProjectId = get().projectId;
      const scoped = curProjectId
        ? scopeToProject(allNodes, allEdges, curProjectId)
        : { nodes: {}, edges: {} };
      set({
        nodes: scoped.nodes,
        edges: scoped.edges,
        projects,
        seeds,
        syncStatus: res.ok ? "synced" : "error",
        syncMessage: res.message,
      });
    } else {
      set({
        syncStatus: res.ok ? "synced" : "error",
        syncMessage: res.message,
      });
    }
  },
}));
