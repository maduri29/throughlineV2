// Unit tests for the op-log core (ADR-0003 semantics): every forward batch must
// round-trip through its inverse back to the exact original maps.
import { describe, expect, test } from "bun:test";
import {
  applyBatch,
  invertBatch,
  isLegal,
  legalEdgeTypes,
  type NodeMaps,
  type Op,
} from "../src/data/ops";
import type { GraphEdge, GraphNode } from "../src/types";

const N = (id: string, type: GraphNode["type"], extra: Partial<GraphNode> = {}): GraphNode => ({
  id,
  type,
  title: id,
  ...extra,
});

const E = (id: string, type: GraphEdge["type"], from: string, to: string): GraphEdge => ({
  id,
  type,
  from,
  to,
});

function snapshot(m: NodeMaps): string {
  return JSON.stringify({
    nodes: Object.values(m.nodes).sort((a, b) => a.id.localeCompare(b.id)),
    edges: Object.values(m.edges).sort((a, b) => a.id.localeCompare(b.id)),
  });
}

describe("op round-trips", () => {
  test("addNode inverts", () => {
    const before: NodeMaps = { nodes: { a: N("a", "scene") }, edges: {} };
    const fwd: Op[] = [{ t: "addNode", node: N("b", "character") }];
    const m = { nodes: { ...before.nodes }, edges: {} };
    applyBatch(m, fwd);
    expect(Object.keys(m.nodes).length).toBe(2);
    applyBatch(m, invertBatch(fwd));
    expect(snapshot(m)).toBe(snapshot(before));
  });

  test("deleteNodes carries touching edges home — the undo data-loss guard", () => {
    const scene = N("s1", "scene");
    const loc = N("l1", "location");
    const edge = E("e1", "takes_place_at", "s1", "l1");
    const before: NodeMaps = {
      nodes: { s1: scene, l1: loc },
      edges: { e1: edge },
    };
    const fwd: Op[] = [
      { t: "patchNode", id: "ep", patch: { order: [] }, prev: { order: ["s1"] } },
      { t: "deleteNodes", nodes: [scene], edges: [edge] },
    ];
    const m = {
      nodes: { ...before.nodes, ep: N("ep", "episode", { order: ["s1"] }) },
      edges: { ...before.edges },
    };
    applyBatch(m, fwd);
    expect(m.nodes["s1"]).toBeUndefined();
    expect(m.edges["e1"]).toBeUndefined();
    applyBatch(m, invertBatch(fwd));
    // order array restored AND edge resurrected
    expect(m.edges["e1"]).toBeDefined();
    expect(m.nodes["ep"]?.order).toEqual(["s1"]);
  });

  test("patchNode restores only patched keys", () => {
    const orig = N("a", "scene", { title: "Orig", synopsis: "syn" });
    const before: NodeMaps = { nodes: { a: orig }, edges: {} };
    const fwd: Op[] = [
      {
        t: "patchNode",
        id: "a",
        patch: { title: "New", storyTime: { storyDay: 3, tod: "Night", eraLabel: null } },
        prev: { title: "Orig", storyTime: undefined },
      },
    ];
    const m = { nodes: { ...before.nodes }, edges: {} };
    applyBatch(m, fwd);
    expect(m.nodes["a"]?.title).toBe("New");
    applyBatch(m, invertBatch(fwd));
    expect(snapshot(m)).toBe(snapshot(before));
  });

  test("mixed batch inverts in reverse order", () => {
    const a = N("a", "character");
    const b = N("b", "character");
    const rel = E("r", "relates_to", "a", "b");
    const empty: NodeMaps = { nodes: {}, edges: {} };
    const fwd: Op[] = [
      { t: "addNode", node: a },
      { t: "addNode", node: b },
      { t: "addEdge", edge: rel },
      { t: "patchEdge", id: "r", patch: { label: "mentor" }, prev: { label: undefined } },
    ];
    const m: NodeMaps = { nodes: {}, edges: {} };
    applyBatch(m, fwd);
    expect(m.edges["r"]?.label).toBe("mentor");
    applyBatch(m, invertBatch(fwd));
    expect(snapshot(m)).toBe(snapshot(empty));
  });
});

describe("edge legality (CONTEXT.md)", () => {
  test("contains runs project→episode→scene and project→scene only", () => {
    expect(isLegal("project", "episode", "contains")).toBe(true);
    expect(isLegal("project", "scene", "contains")).toBe(true);
    expect(isLegal("episode", "scene", "contains")).toBe(true);
    expect(isLegal("episode", "episode", "contains")).toBe(false);
    expect(isLegal("scene", "scene", "contains")).toBe(false);
  });

  test("typed relations check both endpoint kinds", () => {
    expect(isLegal("character", "scene", "appears_in")).toBe(true);
    expect(isLegal("scene", "character", "appears_in")).toBe(false);
    expect(isLegal("scene", "location", "takes_place_at")).toBe(true);
    expect(isLegal("character", "character", "relates_to")).toBe(true);
    expect(isLegal("scene", "scene", "flashback_of")).toBe(true);
    expect(isLegal("seed", "scene", "foreshadows")).toBe(true);
    expect(isLegal("scene", "theme", "embodies")).toBe(true);
    expect(isLegal("seed", "project", "grew_into")).toBe(true);
  });

  test("related_to is the generic fallback but forbids self-loops", () => {
    expect(isLegal("location", "theme", "related_to")).toBe(true);
    expect(legalEdgeTypes("scene", "scene")).not.toContain("related_to");
    expect(isLegal("scene", "scene", "related_to")).toBe(false);
  });
});
