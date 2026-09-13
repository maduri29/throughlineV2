import { describe, expect, test } from "bun:test";
import { autoScheduleDays, groupByDay, scopeToProject } from "../src/data/scopes";
import type { GraphEdge, GraphNode } from "../src/types";

function N(id: string, type: GraphNode["type"], parentId?: string): GraphNode {
  return { id, type, title: id, ...(parentId ? { parentId } : {}) };
}
function E(id: string, type: GraphEdge["type"], from: string, to: string): GraphEdge {
  return { id, type, from, to };
}

describe("scopeToProject", () => {
  const nodes = {
    p1: N("p1", "project"),
    ep: N("ep", "episode", "p1"),
    sc: N("sc", "scene", "ep"),
    ch: N("ch", "character", "p1"), // explicitly owned by p1
    free: N("free", "character"), // parentless — reachable only via edges
    fb: N("fb", "scene"), // legacy parentless flashback
    loc: N("loc", "location"),
    theme: N("theme", "theme"),
    p2: N("p2", "project"),
    sc2: N("sc2", "scene", "p2"),
  };
  const edges = {
    c1: E("c1", "contains", "p1", "ep"),
    x1: E("x1", "appears_in", "free", "sc"), // keeps the parentless character
    x2: E("x2", "appears_in", "ch", "sc2"), // crosses projects — must be dropped
    x3: E("x3", "flashback_of", "fb", "sc"), // legacy flashback rescue
    x4: E("x4", "takes_place_at", "sc", "loc"),
    x5: E("x5", "related_to", "loc", "theme"), // non-container chain growth
  };

  test("keeps the parent subtree plus edge-reachable entities; drops foreign nodes/edges", () => {
    const s = scopeToProject(nodes, edges, "p1");
    expect(Object.keys(s.nodes).sort()).toEqual([
      "ch",
      "ep",
      "fb",
      "free",
      "loc",
      "p1",
      "sc",
      "theme",
    ]);
    expect(Object.keys(s.edges).sort()).toEqual(["c1", "x1", "x3", "x4", "x5"]);
  });

  test("switching scopes isolates the other project — claims beat incidental edges", () => {
    const s = scopeToProject(nodes, edges, "p2");
    expect(Object.keys(s.nodes).sort()).toEqual(["p2", "sc2"]);
    expect(s.edges["x2"]).toBeUndefined();
    expect(s.nodes["free"]).toBeUndefined();
  });

  test("orphaned subtrees (missing parent) are excluded", () => {
    const orphaned = { ...nodes, lost: N("lost", "scene", "ghost") };
    const s = scopeToProject(orphaned, {}, "p1");
    expect(s.nodes["lost"]).toBeUndefined();
  });
});

describe("groupByDay (Timeline)", () => {
  const mk = (id: string, day: number | null): GraphNode => ({
    id,
    type: "scene",
    title: id,
    storyTime: { storyDay: day, tod: null, eraLabel: null },
  });

  test("sorts ascending with flashbacks first and undated last", () => {
    const buckets = groupByDay([mk("a", 3), mk("fb", -9), mk("b", 1), mk("u", null), mk("c", -2)]);
    expect(buckets.map((b) => b.day)).toEqual([-9, -2, 1, 3, null]);
    expect(buckets[0]?.scenes.map((s) => s.id)).toEqual(["fb"]);
    expect(buckets[4]?.scenes.map((s) => s.id)).toEqual(["u"]);
  });
});

describe("autoScheduleDays (Timeline)", () => {
  const scene = (id: string, parentId?: string, day?: number | null): GraphNode => {
    const n: GraphNode = { id, type: "scene", title: id };
    if (parentId) n.parentId = parentId;
    if (day !== undefined) n.storyTime = { storyDay: day, tod: null, eraLabel: null };
    return n;
  };
  const episode = (id: string, order: string[] = []): GraphNode => ({
    id,
    type: "episode",
    title: id,
    parentId: "p",
    order,
  });

  test("dates unscheduled from day 1 in episode then child order", () => {
    const nodes = [
      episode("e1", ["s2", "s1"]),
      episode("e2", ["s3"]),
      scene("s1", "e1"),
      scene("s2", "e1"),
      scene("s3", "e2"),
    ];
    expect(autoScheduleDays(nodes)).toEqual([
      { id: "s2", day: 1 },
      { id: "s1", day: 2 },
      { id: "s3", day: 3 },
    ]);
  });

  test("continues after the highest day and never touches dated scenes", () => {
    const nodes = [
      episode("e1", ["done", "next", "fb"]),
      scene("done", "e1", 2),
      scene("next", "e1"),
      scene("fb", "e1", -9),
    ];
    expect(autoScheduleDays(nodes)).toEqual([{ id: "next", day: 3 }]);
  });

  test("parentless unscheduled scenes go last; nothing to do returns []", () => {
    const nodes = [episode("e1", ["a"]), scene("a", "e1"), scene("loose")];
    expect(autoScheduleDays(nodes)).toEqual([
      { id: "a", day: 1 },
      { id: "loose", day: 2 },
    ]);
    expect(autoScheduleDays([episode("e1", []), scene("a", "e1", 4)])).toEqual([]);
    expect(autoScheduleDays([])).toEqual([]);
  });
});
