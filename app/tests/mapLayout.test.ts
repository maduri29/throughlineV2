import { describe, expect, it } from "bun:test";
import type { GraphNode } from "../src/types";
import { chipOf, episodes, layout, BAND_TOP, COL_W } from "../src/views/map/mapLayout";

function makeNode(
  partial: Partial<GraphNode> & { id: string; type: GraphNode["type"] },
): GraphNode {
  return {
    title: "Untitled",
    ...partial,
  };
}

describe("mapLayout calculations", () => {
  it("determines filter chip category accurately", () => {
    const regularScene = makeNode({
      id: "s1",
      type: "scene",
      storyTime: { storyDay: 1, tod: "DAY", eraLabel: null },
    });
    const flashbackScene = makeNode({
      id: "s2",
      type: "scene",
      storyTime: { storyDay: -1, tod: "NIGHT", eraLabel: null },
    });
    const unscheduledScene = makeNode({ id: "s3", type: "scene" });
    const character = makeNode({ id: "c1", type: "character" });
    const location = makeNode({ id: "l1", type: "location" });
    const theme = makeNode({ id: "t1", type: "theme" });
    const episode = makeNode({ id: "e1", type: "episode" });
    const project = makeNode({ id: "p1", type: "project" });

    expect(chipOf(regularScene)).toBe("scene");
    expect(chipOf(flashbackScene)).toBe("flashback");
    expect(chipOf(unscheduledScene)).toBe("scene");
    expect(chipOf(character)).toBe("character");
    expect(chipOf(location)).toBe("location");
    expect(chipOf(theme)).toBe("theme");
    expect(chipOf(episode)).toBeNull();
    expect(chipOf(project)).toBeNull();
  });

  it("filters episode nodes cleanly", () => {
    const nodes: GraphNode[] = [
      makeNode({ id: "e1", type: "episode" }),
      makeNode({ id: "s1", type: "scene" }),
      makeNode({ id: "e2", type: "episode" }),
      makeNode({ id: "c1", type: "character" }),
    ];
    const eps = episodes(nodes);
    expect(eps.map((e) => e.id)).toEqual(["e1", "e2"]);
  });

  it("computes 2D layout coordinates for episodes and ordered scenes", () => {
    const ep1 = makeNode({ id: "ep1", type: "episode", title: "Pilot" });
    const ep2 = makeNode({ id: "ep2", type: "episode", title: "Chapter 2" });
    const s1 = makeNode({
      id: "s1",
      type: "scene",
      parentId: "ep1",
      title: "Opening Scene",
      storyTime: { storyDay: 1, tod: "DAWN", eraLabel: null },
    });
    const s2 = makeNode({
      id: "s2",
      type: "scene",
      parentId: "ep1",
      title: "Second Scene",
      storyTime: { storyDay: 2, tod: "NIGHT", eraLabel: null },
    });

    const nodes: GraphNode[] = [ep1, ep2, s1, s2];
    const orderMap: Record<string, string[]> = {
      ep1: ["s1", "s2"],
      ep2: [],
    };
    const orderFor = (id: string) => orderMap[id] ?? [];

    const flowNodes = layout(nodes, orderFor);

    // Pilot at index 0
    const ep1Node = flowNodes.find((n) => n.id === "ep1");
    expect(ep1Node).toBeDefined();
    expect(ep1Node?.position).toEqual({ x: 0, y: BAND_TOP });
    expect(ep1Node?.draggable).toBe(false);

    // Chapter 2 at index 1
    const ep2Node = flowNodes.find((n) => n.id === "ep2");
    expect(ep2Node).toBeDefined();
    expect(ep2Node?.position).toEqual({ x: 1 * COL_W, y: BAND_TOP });

    // s1 at index 0 in ep1 column
    const s1Node = flowNodes.find((n) => n.id === "s1");
    expect(s1Node).toBeDefined();
    expect(s1Node?.position).toEqual({ x: 0, y: 100 });
    expect(s1Node?.data.badge).toBe("D1 · DAWN");

    // s2 at index 1 in ep1 column
    const s2Node = flowNodes.find((n) => n.id === "s2");
    expect(s2Node).toBeDefined();
    expect(s2Node?.position).toEqual({ x: 0, y: 100 + 1 * 120 });
    expect(s2Node?.data.badge).toBe("D2 · NIGHT");
  });

  it("places flashbacks in the top negative lane and entity pills in the left rail", () => {
    const flashback = makeNode({
      id: "fb1",
      type: "scene",
      title: "Childhood Memory",
      storyTime: { storyDay: -5, tod: "DAY", eraLabel: null },
    });
    const char = makeNode({ id: "ch1", type: "character", title: "Protagonist" });
    const loc = makeNode({ id: "loc1", type: "location", title: "Safehouse" });

    const flowNodes = layout([flashback, char, loc], () => []);

    const fbNode = flowNodes.find((n) => n.id === "fb1");
    expect(fbNode).toBeDefined();
    expect(fbNode?.position).toEqual({ x: 60, y: -80 });
    expect(fbNode?.data.kind).toBe("flashback");

    const chNode = flowNodes.find((n) => n.id === "ch1");
    expect(chNode).toBeDefined();
    expect(chNode?.position).toEqual({ x: -280, y: 20 });
    expect(chNode?.draggable).toBe(false);

    const locNode = flowNodes.find((n) => n.id === "loc1");
    expect(locNode).toBeDefined();
    expect(locNode?.position).toEqual({ x: -280, y: 20 + 56 });
  });
});
