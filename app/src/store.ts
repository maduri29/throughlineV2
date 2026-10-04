// Story Lane state: normalized in-memory maps over IndexedDB (ADR-0001) with a
// full persisted undo/redo op-log (ADR-0003) and hybrid autosave (ADR-0004).
// Persistence and graph mutation engine are encapsulated in headless GraphEngine.
import { create } from "zustand";
import { requestDurableStorage, type Durability } from "./data/durability";
import { executeSync } from "./data/sync";
import { GraphEngine, type GraphEngineState } from "./data/graphEngine";
import type { EdgeType, GraphEdge, GraphNode, NodeType } from "./types";

type SaveState = "booting" | "saved" | "saving" | "dirty" | "error";

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
  /** Schedule scenes in one undoable step; days come from autoScheduleDays. */
  scheduleScenes: (plan: Array<{ id: string; day: number | null }>) => void;
  deleteSelection: () => void;
  deleteNodes: (ids: string[]) => void;
  connect: (from: string, to: string, type: EdgeType, label?: string) => boolean;
  patchEdge: (id: string, patch: Partial<GraphEdge>) => void;
  deleteEdge: (id: string) => void;
  setOrder: (containerId: string, order: string[]) => void;
  moveScene: (sceneId: string, containerId: string, beforeId?: string) => void;
  addScene: (parentId: string, opts?: { flashback?: boolean }) => string;
  /** Create any entity type with sensible defaults; episodes nest under the project. */
  addNodeOfType: (type: Exclude<NodeType, "project">, title?: string) => string;
  /** Split .fountain text into scene nodes under the project; returns scene count. */
  importFountain: (text: string) => number;
  switchProject: (id: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
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

const graphEngine = new GraphEngine();

export const useGraphStore = create<State & Actions>()((set, get) => {
  // Synchronize Zustand reactive state whenever graphEngine state updates
  graphEngine.subscribe((engineState: GraphEngineState) => {
    set({
      status: engineState.status,
      nodes: engineState.nodes,
      edges: engineState.edges,
      projects: engineState.projects,
      projectId: engineState.projectId,
      canUndo: engineState.canUndo,
      canRedo: engineState.canRedo,
      bootError: engineState.bootError,
      seeds: engineState.seeds,
      references: engineState.references,
    });
  });

  return {
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
      void requestDurableStorage().then((d) => set({ durability: d }));
      await graphEngine.boot();
      set({ selection: [] });
    },

    select: (ids) => set({ selection: ids }),

    addNode: (partial) => graphEngine.addNode(partial),

    addNodeOfType: (type, title) => {
      const id = graphEngine.addNodeOfType(type, title);
      if (id) set({ selection: [id] });
      return id;
    },

    patchNode: (id, patch) => graphEngine.patchNode(id, patch),

    scheduleScenes: (plan) => graphEngine.scheduleScenes(plan),

    deleteSelection: () => {
      graphEngine.deleteNodes(get().selection);
      set({ selection: [] });
    },

    deleteNodes: (ids) => {
      graphEngine.deleteNodes(ids);
      const remaining = get().selection.filter((id) => !ids.includes(id));
      set({ selection: remaining });
    },

    connect: (from, to, type, label) => graphEngine.connect(from, to, type, label),

    patchEdge: (id, patch) => graphEngine.patchEdge(id, patch),

    deleteEdge: (id) => graphEngine.deleteEdge(id),

    setOrder: (containerId, order) => graphEngine.setOrder(containerId, order),

    moveScene: (sceneId, containerId, beforeId) =>
      graphEngine.moveScene(sceneId, containerId, beforeId),

    addScene: (parentId, opts) => {
      const id = graphEngine.addScene(parentId, opts);
      if (id) set({ selection: [id] });
      return id;
    },

    importFountain: (text) => {
      const count = graphEngine.importFountain(text);
      set({ selection: [] });
      return count;
    },

    switchProject: async (id) => {
      await graphEngine.switchProject(id);
      set({ selection: [] });
    },

    deleteProject: async (id) => {
      if (graphEngine.isDeletingProject() || get().syncStatus === "syncing") {
        throw new Error("Cloud sync is in progress. Try deleting again in a moment.");
      }
      await graphEngine.deleteProject(id);
      set({ selection: [] });
      void get().syncNow();
    },

    createProject: (title) => graphEngine.createProject(title),

    addReference: (title, projectId, extra) => graphEngine.addReference(title, projectId, extra),

    patchReference: (id, patch) => graphEngine.patchReference(id, patch),

    deleteReference: (id) => graphEngine.deleteReference(id),

    addSeed: (title) => graphEngine.addSeed(title),

    patchSeed: (id, patch) => graphEngine.patchSeed(id, patch),

    deleteSeed: (id) => graphEngine.deleteSeed(id),

    growSeed: (id) => graphEngine.growSeed(id),

    openSample: async () => {
      const id = await graphEngine.openSample();
      set({ selection: [] });
      return id;
    },

    exportProject: () => graphEngine.exportProject(),

    importProject: (text) => graphEngine.importProject(text),

    undo: () => graphEngine.undo(),

    redo: () => graphEngine.redo(),

    forceSave: () => graphEngine.forceSave(),

    syncNow: async () => {
      if (graphEngine.isDeletingProject() || get().syncStatus === "syncing") return;
      set({ syncStatus: "syncing", syncMessage: null });
      const res = await executeSync(() => graphEngine.forceSave());
      if (res.deleted || res.pulledNodes.length > 0 || res.pulledEdges.length > 0) {
        await graphEngine.reloadScoped();
      }
      set({
        syncStatus: res.ok ? "synced" : "error",
        syncMessage: res.message,
      });
    },
  };
});
