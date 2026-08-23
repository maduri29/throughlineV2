import { describe, expect, test } from "bun:test";
import { characterDetails } from "../src/data/characters";
import type { GraphEdge, GraphNode } from "../src/types";

function N(id: string, type: GraphNode["type"], extra: Partial<GraphNode> = {}): GraphNode {
  return { id, type, title: id, ...extra };
}
function E(
  id: string,
  type: GraphEdge["type"],
  from: string,
  to: string,
  label?: string,
): GraphEdge {
  return label ? { id, type, from, to, label } : { id, type, from, to };
}

/** HIGH-WATER-shaped mini graph: one episode, two ordered scenes, an
 *  auto-placed flashback, plus one loose scene outside any container. */
function graph(): {
  nodes: Record<string, GraphNode>;
  edges: Record<string, GraphEdge>;
} {
  const list: GraphNode[] = [
    N("p1", "project", { order: ["e1"] }),
    N("e1", "episode", { parentId: "p1", order: ["s1", "s2"] }),
    N("s1", "scene", { parentId: "e1" }),
    N("s2", "scene", { parentId: "e1" }),
    N("fb", "scene"), // parentless flashback → auto-places before its target
    N("sx", "scene"), // loose scene, unranked
    N("a", "character"),
    N("b", "character"),
    N("c", "character"),
    N("th", "theme"),
    N("loc", "location"),
  ];
  const elist: GraphEdge[] = [
    E("c1", "contains", "p1", "e1"),
    E("c2", "contains", "e1", "s1"),
    E("c3", "contains", "e1", "s2"),
    E("f1", "flashback_of", "fb", "s1"),
    E("a0", "appears_in", "a", "fb"),
    E("a1", "appears_in", "a", "s2"), // inserted before s1 — narrative sort fixes it
    E("a2", "appears_in", "a", "s1"),
    E("a3", "appears_in", "a", "s2"), // duplicate link
    E("a4", "appears_in", "a", "sx"), // unranked trails the ranked ones
    E("t1", "takes_place_at", "s1", "loc"),
    E("m1", "embodies", "a", "th"),
    E("r1", "relates_to", "b", "a"), // reversed direction, unlabeled…
    E("r2", "relates_to", "a", "b", "rival"), // …labeled twin wins
    E("x1", "related_to", "loc", "th"), // non-character pair ignored
  ];
  const nodes: Record<string, GraphNode> = {};
  for (const n of list) nodes[n.id] = n;
  const edges: Record<string, GraphEdge> = {};
  for (const e of elist) edges[e.id] = e;
  return { nodes, edges };
}

describe("characterDetails", () => {
  const { nodes, edges } = graph();
  const details = characterDetails(nodes["p1"] as GraphNode, nodes, edges);

  test("orders scenes by narrative sequence, dedupes, trails unranked", () => {
    expect(details.get("a")?.sceneIds).toEqual(["fb", "s1", "s2", "sx"]);
  });

  test("first/last appearance follow narrative order, ignoring unranked", () => {
    expect(details.get("a")?.firstSceneId).toBe("fb");
    expect(details.get("a")?.lastSceneId).toBe("s2");
  });

  test("locations derive from the character's scenes' takes_place_at", () => {
    expect(details.get("a")?.locationIds).toEqual(["loc"]);
  });

  test("themes collect embodied edges", () => {
    expect(details.get("a")?.themeIds).toEqual(["th"]);
  });

  test("relations dedupe pairs across direction and keep labels", () => {
    const rel = [{ otherId: "b", label: "rival" }];
    expect(details.get("a")?.relations).toEqual(rel);
    expect(details.get("b")?.relations).toEqual([{ otherId: "a", label: "rival" }]);
  });

  test("edge-less characters yield empty detail", () => {
    const d = details.get("c");
    expect(d?.sceneIds).toEqual([]);
    expect(d?.relations).toEqual([]);
    expect(d?.themeIds).toEqual([]);
    expect(d?.locationIds).toEqual([]);
    expect(d?.firstSceneId).toBeNull();
    expect(d?.lastSceneId).toBeNull();
  });
});
