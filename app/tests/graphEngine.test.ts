import { describe, expect, it, beforeEach } from "bun:test";
import { GraphEngine, MemoryGraphStorageAdapter } from "../src/data/graphEngine";
import type { GraphEdge, GraphNode } from "../src/types";

describe("GraphEngine (Headless & Decoupled Persistence Seam)", () => {
  let memoryStorage: MemoryGraphStorageAdapter;
  let engine: GraphEngine;

  beforeEach(() => {
    memoryStorage = new MemoryGraphStorageAdapter();
    engine = new GraphEngine(memoryStorage);
  });

  it("boots from storage and isolates project scope", async () => {
    const project1: GraphNode = { id: "p1", type: "project", title: "Project Alpha" };
    const scene1: GraphNode = { id: "s1", type: "scene", title: "Scene 1", parentId: "p1" };
    const edge1: GraphEdge = { id: "e1", type: "contains", from: "p1", to: "s1" };

    const project2: GraphNode = { id: "p2", type: "project", title: "Project Beta" };
    const scene2: GraphNode = { id: "s2", type: "scene", title: "Scene 2", parentId: "p2" };

    await memoryStorage.putNodes([project1, scene1, project2, scene2]);
    await memoryStorage.putEdges([edge1]);
    await memoryStorage.setMeta("lastProjectId", "p1");

    await engine.boot();
    const state = engine.getState();

    expect(state.status).toBe("saved");
    expect(state.projectId).toBe("p1");
    expect(state.projects.length).toBe(2);
    // In p1 scope, s1 is visible, but s2 from p2 is excluded
    expect(state.nodes["s1"]).toBeDefined();
    expect(state.nodes["s2"]).toBeUndefined();
    expect(state.edges["e1"]).toBeDefined();
  });

  it("commits forward mutations, updates undo stack, and supports rollback", async () => {
    const project: GraphNode = { id: "p1", type: "project", title: "Project Alpha" };
    await memoryStorage.putNodes([project]);
    await memoryStorage.setMeta("lastProjectId", "p1");
    await engine.boot();

    expect(engine.getState().canUndo).toBe(false);

    const sceneId = engine.addScene("p1");
    expect(sceneId).toBeTruthy();

    let state = engine.getState();
    expect(state.nodes[sceneId]).toBeDefined();
    expect(state.canUndo).toBe(true);
    expect(state.canRedo).toBe(false);

    // Undo rollback
    engine.undo();
    state = engine.getState();
    expect(state.nodes[sceneId]).toBeUndefined();
    expect(state.canUndo).toBe(false);
    expect(state.canRedo).toBe(true);

    // Redo re-apply
    engine.redo();
    state = engine.getState();
    expect(state.nodes[sceneId]).toBeDefined();
    expect(state.canUndo).toBe(true);
    expect(state.canRedo).toBe(false);
  });

  it("flushes dirty mutations to storage adapter", async () => {
    const project: GraphNode = { id: "p1", type: "project", title: "Project Alpha" };
    await memoryStorage.putNodes([project]);
    await memoryStorage.setMeta("lastProjectId", "p1");
    await engine.boot();

    const sceneId = engine.addScene("p1");
    expect(await memoryStorage.getAllNodes()).toHaveLength(1); // Not flushed yet

    await engine.flush();

    const storedNodes = await memoryStorage.getAllNodes();
    expect(storedNodes).toHaveLength(2); // Project + new Scene
    expect(storedNodes.some((n) => n.id === sceneId)).toBe(true);
  });

  it("handles connections, node patches, and deletion cascades", async () => {
    const project: GraphNode = { id: "p1", type: "project", title: "Project Alpha" };
    await memoryStorage.putNodes([project]);
    await memoryStorage.setMeta("lastProjectId", "p1");
    await engine.boot();

    const charId = engine.addNodeOfType("character", "Hero");
    const sceneId = engine.addScene("p1");

    expect(engine.getState().nodes[charId]?.title).toBe("Hero");

    // Patch
    engine.patchNode(charId, { title: "Protagonist" });
    expect(engine.getState().nodes[charId]?.title).toBe("Protagonist");

    // Connect
    const connected = engine.connect(charId, sceneId, "appears_in");
    expect(connected).toBe(true);

    const edges = Object.values(engine.getState().edges);
    const featureEdge = edges.find((e) => e.type === "appears_in");
    expect(featureEdge).toBeDefined();

    // Delete selection
    engine.deleteNodes([charId]);
    expect(engine.getState().nodes[charId]).toBeUndefined();
    // Edge touching charId should cascade away
    expect(engine.getState().edges[featureEdge!.id]).toBeUndefined();

    // Undo deletion restores node and edge
    engine.undo();
    expect(engine.getState().nodes[charId]).toBeDefined();
    expect(engine.getState().edges[featureEdge!.id]).toBeDefined();
  });

  it("switches projects and isolates graph states cleanly", async () => {
    const project1: GraphNode = { id: "p1", type: "project", title: "Project Alpha" };
    const scene1: GraphNode = { id: "s1", type: "scene", title: "Scene 1", parentId: "p1" };

    const project2: GraphNode = { id: "p2", type: "project", title: "Project Beta" };
    const scene2: GraphNode = { id: "s2", type: "scene", title: "Scene 2", parentId: "p2" };

    await memoryStorage.putNodes([project1, scene1, project2, scene2]);
    await memoryStorage.setMeta("lastProjectId", "p1");
    await engine.boot();

    expect(engine.getState().projectId).toBe("p1");
    expect(engine.getState().nodes["s1"]).toBeDefined();

    await engine.switchProject("p2");
    expect(engine.getState().projectId).toBe("p2");
    expect(engine.getState().nodes["s1"]).toBeUndefined();
    expect(engine.getState().nodes["s2"]).toBeDefined();
  });

  it("deletes a project atomically via storage transaction", async () => {
    const project1: GraphNode = { id: "p1", type: "project", title: "Project Alpha" };
    const scene1: GraphNode = { id: "s1", type: "scene", title: "Scene 1", parentId: "p1" };
    await memoryStorage.putNodes([project1, scene1]);
    await memoryStorage.setMeta("lastProjectId", "p1");
    await engine.boot();

    await engine.deleteProject("p1");

    expect(engine.getState().projectId).toBeNull();
    expect(engine.getState().projects).toHaveLength(0);
    expect(await memoryStorage.getAllNodes()).toHaveLength(0);
  });
});
