import { describe, expect, test } from "bun:test";
import {
  applyPrefixToSlug,
  applyTodToSlug,
  getInitialSlugDraft,
  parseSceneHeading,
} from "../src/views/script/scriptHeading";
import type { GraphNode } from "../src/types";

describe("scriptHeading parser", () => {
  const baseScene: GraphNode = {
    id: "sc-1",
    type: "scene",
    title: "Old Title",
    intExt: "INT.",
    storyTime: { storyDay: 1, tod: "Day", eraLabel: null },
  };

  test("parses full slug with prefix, location, and time of day", () => {
    const res = parseSceneHeading("EXT. ROOFTOP - NIGHT", baseScene);
    expect(res.intExt).toBe("EXT.");
    expect(res.location).toBe("ROOFTOP");
    expect(res.tod).toBe("Night");
    expect(res.title).toBe("ROOFTOP");
  });

  test("parses INT./EXT. with time of day", () => {
    const res = parseSceneHeading("INT./EXT. CAR - CONTINUOUS", baseScene);
    expect(res.intExt).toBe("INT./EXT.");
    expect(res.location).toBe("CAR");
    expect(res.tod).toBe("Continuous");
  });

  test("parses I/E prefix and converts to standard INT./EXT.", () => {
    const res = parseSceneHeading("I/E. CAFE TERRACE - DUSK", baseScene);
    expect(res.intExt).toBe("INT./EXT.");
    expect(res.location).toBe("CAFE TERRACE");
    expect(res.tod).toBe("Dusk");
  });

  test("parses slug with prefix only", () => {
    const res = parseSceneHeading("INT. LIVING ROOM", baseScene);
    expect(res.intExt).toBe("INT.");
    expect(res.location).toBe("LIVING ROOM");
    expect(res.title).toBe("LIVING ROOM");
  });

  test("parses name with trailing TOD when prefix is omitted", () => {
    const res = parseSceneHeading("COFFEE SHOP - NIGHT", baseScene);
    expect(res.tod).toBe("Night");
    expect(res.location).toBe("COFFEE SHOP");
    expect(res.title).toBe("COFFEE SHOP");
  });

  test("parses freeform title preserving current intExt and tod", () => {
    const res = parseSceneHeading("The Big Heist", baseScene);
    expect(res.title).toBe("The Big Heist");
    expect(res.intExt).toBe("INT.");
    expect(res.tod).toBe("Day");
  });

  test("handles empty input gracefully", () => {
    const res = parseSceneHeading("   ", baseScene);
    expect(res.title).toBe("Old Title");
  });

  test("generates initial draft from meaningful slug or scene title", () => {
    expect(getInitialSlugDraft("EXT. BEACH - DAWN", baseScene)).toBe("EXT. BEACH - DAWN");
    expect(getInitialSlugDraft("INT. UNTITLED", { ...baseScene, title: "Coffee Shop" })).toBe(
      "INT. COFFEE SHOP - DAY",
    );
    expect(getInitialSlugDraft("INT. UNTITLED", { ...baseScene, title: "New Scene" })).toBe(
      "INT. UNTITLED - DAY",
    );
  });

  test("applies prefix preset reliably without breaking existing location and time", () => {
    expect(applyPrefixToSlug("INT. COFFEE SHOP - DAY", "EXT.")).toBe("EXT. COFFEE SHOP - DAY");
    expect(applyPrefixToSlug("EXT. ROOFTOP - NIGHT", "INT./EXT.")).toBe("INT./EXT. ROOFTOP - NIGHT");
    expect(applyPrefixToSlug("COFFEE SHOP", "INT.")).toBe("INT. COFFEE SHOP");
  });

  test("applies time-of-day preset reliably without breaking existing prefix and location", () => {
    expect(applyTodToSlug("INT. COFFEE SHOP - DAY", "NIGHT")).toBe("INT. COFFEE SHOP - NIGHT");
    expect(applyTodToSlug("EXT. ROOFTOP", "DAWN")).toBe("EXT. ROOFTOP - DAWN");
  });
});
