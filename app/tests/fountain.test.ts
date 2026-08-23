import { describe, expect, test } from "bun:test";
import {
  assembleExport,
  parseFountain,
  renderPreview,
  scriptSequence,
  skeletonBody,
  slugFor,
  splitSceneChunks,
} from "../src/data/fountain";
import type { GraphEdge, GraphNode } from "../src/types";

function N(id: string, type: GraphNode["type"], extra: Partial<GraphNode> = {}): GraphNode {
  return { id, type, title: id, ...extra };
}
function E(id: string, type: GraphEdge["type"], from: string, to: string): GraphEdge {
  return { id, type, from, to };
}

describe("slug", () => {
  test("full form with location + tod", () => {
    const s = N("s", "scene", {
      intExt: "EXT.",
      storyTime: { storyDay: 3, tod: "Night", eraLabel: null },
    });
    expect(slugFor(s, "Boathouse")).toBe("EXT. BOATHOUSE - NIGHT");
  });

  test("degrades: no location → UNTITLED, no tod → bare slug", () => {
    const s = N("s", "scene", { storyTime: { storyDay: null, tod: null, eraLabel: null } });
    expect(slugFor(s, null)).toBe("INT. UNTITLED");
  });
});

describe("parser (subset spec fixtures)", () => {
  test("F1 plain scene + dialogue", () => {
    const { els } = parseFountain("EXT. BRICK'S PATIO - DAY\n\nSTEEL\nBeer's ready!");
    expect(els.map((e) => e.type)).toEqual(["scene_heading", "character", "dialogue"]);
    expect(els[1]?.text).toBe("STEEL");
    expect(els[2]?.text).toBe("Beer's ready!");
  });

  test("F2 forced heading + forced action stay distinct", () => {
    const { els } = parseFountain(".SNIPER SCOPE POV\n\n!SCANNING THE AISLES...");
    expect(els[0]).toMatchObject({ type: "scene_heading", text: "SNIPER SCOPE POV", forced: true });
    expect(els[1]).toMatchObject({ type: "action", text: "SCANNING THE AISLES...", forced: true });
  });

  test("F4 parenthetical between cue and dialogue", () => {
    const { els } = parseFountain("STEEL\n(beer raised)\nTo retirement.");
    expect(els.map((e) => e.type)).toEqual(["character", "parenthetical", "dialogue"]);
  });

  test("F5 auto transition needs blank neighbors; forced > always wins", () => {
    const { els } = parseFountain("They speed off.\n\nCUT TO:\n\n>Burn to White.");
    const trans = els.filter((e) => e.type === "transition");
    expect(trans.map((t) => t.text)).toEqual(["CUT TO:", "Burn to White."]);
    expect(trans[0]?.forced).toBe(false);
    expect(trans[1]?.forced).toBe(true);
  });

  test("F6 dual dialogue: caret on second cue", () => {
    const { els } = parseFountain("BRICK\nScrew retirement.\n\nSTEEL ^\nScrew retirement.");
    const cues = els.filter((e) => e.type === "character");
    expect(cues).toHaveLength(2);
    expect(cues[0]?.dual).toBeUndefined();
    expect(cues[1]?.dual).toBe(true);
    expect(cues[1]?.text).toBe("STEEL");
  });

  test("F8 ALL-CAPS action with lowercase words is action, not a cue", () => {
    const { els } = parseFountain("THE DEALER eyes the new player warily.");
    expect(els[0]?.type).toBe("action");
  });

  test("F9 notes extracted; boneyard excluded; sections/synopses present but hidden in preview", () => {
    const src = [
      "# ACT ONE",
      "",
      "= Set up the retirees.",
      "",
      "The take[[count it twice]] sits on the table.",
      "",
      "/*",
      "INT. GARAGE - DAY",
      "",
      "Cut scene.",
      "*/",
    ].join("\n");
    const { els } = parseFountain(src);
    expect(els.some((e) => e.type === "boneyard" || e.text.includes("GARAGE"))).toBe(false);
    const action = els.find((e) => e.type === "action");
    expect(action?.notes).toEqual(["count it twice"]);
    expect(action?.text).toContain("The take");
    const html = renderPreview(els);
    expect(html).not.toContain("ACT ONE");
    expect(html).toContain("tln-f-note");
    expect(html).not.toContain("GARAGE");
  });

  test("preview hides sections and synopses from body", () => {
    const { els } = parseFountain("# ACT ONE\n\n= Set up the retirees.\n\nHe left.");
    const html = renderPreview(els);
    expect(html).not.toContain("ACT ONE");
    expect(html).not.toContain("Set up the retirees.");
    expect(html).toContain("He left.");
  });
});

describe("script order + export", () => {
  const project = N("p", "project", { title: "High Water", order: ["ep1"] });
  const ep1 = N("ep1", "episode", { title: "E1 · RISE", parentId: "p", order: ["sc1", "sc2"] });
  const sc1 = N("sc1", "scene", { title: "Cold open", parentId: "ep1" });
  const sc2 = N("sc2", "scene", { title: "The call", parentId: "ep1" });
  const fb = N("fb", "scene", {
    title: "Solo run",
    storyTime: { storyDay: -9, tod: "Dawn", eraLabel: null },
  });
  const nodes: Record<string, GraphNode> = { p: project, ep1, sc1, sc2, fb };
  const edges: Record<string, GraphEdge> = {
    c1: E("c1", "contains", "p", "ep1"),
    f1: E("f1", "flashback_of", "fb", "sc2"),
  };

  test("parentless flashback auto-inserts before its target", () => {
    const seq = scriptSequence(project, nodes, edges);
    expect(seq.map((x) => x.scene.id)).toEqual(["sc1", "fb", "sc2"]);
  });

  test("export emits title page, episode section, slugs, and skeleton bodies", () => {
    const doc = assembleExport(project, nodes, edges);
    expect(doc).toStartWith("Title:");
    expect(doc).toContain("\tHigh Water");
    expect(doc).toContain("# E1 · RISE");
    expect(doc).toContain("INT. UNTITLED"); // sc1 has no location/time
    expect(doc).toContain("[ACTION — what happens in this scene?]");
  });

  test("skeleton body carries hints but never the slug line", () => {
    const body = skeletonBody(sc1);
    expect(body).toContain("[ACTION — what happens in this scene?]");
    expect(body).not.toContain("INT.");
  });
});

describe("splitSceneChunks (import)", () => {
  test("splits at headings, parses prefix/location/tod, strips heading from body", () => {
    const src = [
      "INT. BOATHOUSE - NIGHT",
      "",
      "MAYA",
      "Hold it steady.",
      "",
      "EXT. SHALLOWS - DAWN",
      "",
      "The flare dies over flat water.",
    ].join("\n");
    const chunks = splitSceneChunks(src);
    expect(chunks.length).toBe(2);
    expect(chunks[0]?.intExt).toBe("INT.");
    expect(chunks[0]?.location).toBe("BOATHOUSE");
    expect(chunks[0]?.tod).toBe("Night");
    expect(chunks[0]?.body).toContain("MAYA");
    expect(chunks[0]?.body).not.toContain("INT.");
    expect(chunks[1]?.intExt).toBe("EXT.");
    expect(chunks[1]?.tod).toBe("Dawn");
  });

  test("line-1 heading is legal; caps action lines are not headings; unknown tod keeps location", () => {
    const src = [
      "EST. RANCH - GOLDEN HOUR",
      "",
      "!The door hangs open.",
      "",
      "LATER",
      "",
      "I/E. COUNTY RD",
      "",
      "The truck rolls on.",
    ].join("\n");
    const chunks = splitSceneChunks(src);
    expect(chunks.length).toBe(2);
    expect(chunks[0]?.intExt).toBe("EST.");
    expect(chunks[0]?.location).toBe("RANCH - GOLDEN HOUR");
    expect(chunks[0]?.tod).toBeNull();
    expect(chunks[0]?.body).toContain("!The door hangs open.");
    expect(chunks[0]?.body).not.toContain("EST.");
    expect(chunks[1]?.intExt).toBe("INT./EXT.");
    expect(chunks[1]?.location).toBe("COUNTY RD");
  });

  test("title-page preamble produces no chunk; no headings → no chunks", () => {
    const withTitle = "Title:\n\tHigh Water\n\n\nINT. DECK - DAY\n\nWave.";
    expect(splitSceneChunks(withTitle).length).toBe(1);
    expect(splitSceneChunks("Just some action.\nAnd more.").length).toBe(0);
  });
});
