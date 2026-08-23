import { describe, expect, test } from "bun:test";
import { connectionTargets } from "../src/data/connections";
import type { GraphEdge, GraphNode } from "../src/types";

function N(id: string, type: GraphNode["type"]): GraphNode {
  return { id, type, title: id };
}
function E(id: string, type: GraphEdge["type"], from: string, to: string): GraphEdge {
  return { id, type, from, to };
}

const nodes = {
  sc1: N("sc1", "scene"),
  sc2: N("sc2", "scene"),
  maya: N("maya", "character"),
  loc: N("loc", "location"),
};

describe("connectionTargets", () => {
  test("lists legal pairs with remaining types, sorted by title", () => {
    const edges = {
      e1: E("e1", "appears_in", "maya", "sc1"),
    };
    const out = connectionTargets(nodes, edges, "maya");
    // sc1 keeps only related_to (appears_in already used); any↔any means no
    // pair ever drops entirely between these types.
    expect(out.map((c) => c.targetId)).toEqual(["loc", "sc1", "sc2"]);
    const sc1 = out.find((c) => c.targetId === "sc1");
    expect(sc1?.types).toEqual(["related_to"]);
    const loc = out.find((c) => c.targetId === "loc");
    expect(loc?.types).toEqual(["related_to"]);
  });

  test("scene source sees precedes-family toward scenes; only related_to toward characters", () => {
    const out = connectionTargets(nodes, {}, "sc1");
    const toScene = out.find((c) => c.targetId === "sc2");
    expect(toScene?.types).toEqual(
      expect.arrayContaining(["precedes", "flashback_of", "parallels", "sets_up", "foreshadows"]),
    );
    const toChar = out.find((c) => c.targetId === "maya");
    expect(toChar?.types).toEqual(["related_to"]);
  });

  test("unknown source yields nothing; self never listed", () => {
    expect(connectionTargets(nodes, {}, "ghost")).toEqual([]);
    expect(connectionTargets(nodes, {}, "sc1").some((c) => c.targetId === "sc1")).toBe(false);
  });
});
