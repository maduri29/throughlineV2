import { describe, expect, test } from "bun:test";
import { analyzeStoryHealth } from "../src/data/diagnostics/storyDiagnostics";
import type { GraphEdge, GraphNode } from "../src/types";

describe("story diagnostics engine (Effect-powered)", () => {
  test("clean well-connected story scores high and has no errors", () => {
    const nodes: Record<string, GraphNode> = {
      p1: { id: "p1", type: "project", title: "Project Alpha" },
      s1: {
        id: "s1",
        type: "scene",
        title: "Opening Scene",
        parentId: "p1",
        synopsis: "The adventure begins.",
        storyTime: { storyDay: 1, tod: "Dawn", eraLabel: null },
      },
      s2: {
        id: "s2",
        type: "scene",
        title: "The Encounter",
        parentId: "p1",
        synopsis: "Hero meets mentor.",
        storyTime: { storyDay: 1, tod: "Day", eraLabel: null },
      },
      c1: {
        id: "c1",
        type: "character",
        title: "Hero",
        role: "Protagonist",
      },
    };

    const edges: Record<string, GraphEdge> = {
      e1: { id: "e1", type: "precedes", from: "s1", to: "s2" },
      e2: { id: "e2", type: "appears_in", from: "c1", to: "s1" },
    };

    const report = analyzeStoryHealth(nodes, edges);
    expect(report.score).toBeGreaterThanOrEqual(95);
    expect(report.rating).toBe("Flawless Narrative Architecture");
    expect(report.issues.filter((i) => i.severity === "error")).toHaveLength(0);
    expect(report.metrics.totalScenes).toBe(2);
    expect(report.metrics.connectedScenes).toBe(2);
    expect(report.metrics.totalCharacters).toBe(1);
    expect(report.metrics.activeCharacters).toBe(1);
  });

  test("detects narrative causal loops (cycles)", () => {
    const nodes: Record<string, GraphNode> = {
      p1: { id: "p1", type: "project", title: "Time Loop Story" },
      s1: { id: "s1", type: "scene", title: "Scene 1", parentId: "p1", synopsis: "Start" },
      s2: { id: "s2", type: "scene", title: "Scene 2", parentId: "p1", synopsis: "Middle" },
      s3: { id: "s3", type: "scene", title: "Scene 3", parentId: "p1", synopsis: "End" },
    };

    const edges: Record<string, GraphEdge> = {
      e1: { id: "e1", type: "precedes", from: "s1", to: "s2" },
      e2: { id: "e2", type: "precedes", from: "s2", to: "s3" },
      e3: { id: "e3", type: "precedes", from: "s3", to: "s1" }, // Cycle back to s1!
    };

    const report = analyzeStoryHealth(nodes, edges);
    const loopIssue = report.issues.find((i) => i.code === "FLOW_CYCLE");
    expect(loopIssue).toBeDefined();
    expect(loopIssue?.severity).toBe("error");
    expect(report.score).toBeLessThan(80);
  });

  test("detects self-referential connections", () => {
    const nodes: Record<string, GraphNode> = {
      s1: { id: "s1", type: "scene", title: "Paradox Scene", synopsis: "Self" },
    };
    const edges: Record<string, GraphEdge> = {
      e1: { id: "e1", type: "related_to", from: "s1", to: "s1" },
    };

    const report = analyzeStoryHealth(nodes, edges);
    const selfIssue = report.issues.find((i) => i.code === "SELF_LOOP");
    expect(selfIssue).toBeDefined();
    expect(selfIssue?.severity).toBe("error");
  });

  test("detects floating orphan scenes and unused characters", () => {
    const nodes: Record<string, GraphNode> = {
      s1: { id: "s1", type: "scene", title: "Abandoned Scene" },
      c1: { id: "c1", type: "character", title: "Forgotten Ghost" },
      l1: { id: "l1", type: "location", title: "Unvisited Isle" },
    };
    const edges: Record<string, GraphEdge> = {};

    const report = analyzeStoryHealth(nodes, edges);
    expect(report.issues.some((i) => i.code === "SCENE_ORPHAN")).toBe(true);
    expect(report.issues.some((i) => i.code === "CHARACTER_UNUSED")).toBe(true);
    expect(report.issues.some((i) => i.code === "LOCATION_UNUSED")).toBe(true);
  });

  test("detects chronological inversion without a flashback connection", () => {
    const nodes: Record<string, GraphNode> = {
      p1: { id: "p1", type: "project", title: "Timeline Test" },
      s1: {
        id: "s1",
        type: "scene",
        title: "Future Scene",
        parentId: "p1",
        synopsis: "Later events",
        storyTime: { storyDay: 10, tod: "Day", eraLabel: null },
      },
      s2: {
        id: "s2",
        type: "scene",
        title: "Past Scene",
        parentId: "p1",
        synopsis: "Earlier events",
        storyTime: { storyDay: 2, tod: "Night", eraLabel: null },
      },
    };

    const edges: Record<string, GraphEdge> = {
      e1: { id: "e1", type: "precedes", from: "s1", to: "s2" },
    };

    const report = analyzeStoryHealth(nodes, edges);
    const conflict = report.issues.find((i) => i.code === "CHRONOLOGY_INVERSION");
    expect(conflict).toBeDefined();
    expect(conflict?.severity).toBe("warning");

    // But if linked via flashback_of, the inversion is legitimate
    edges["e2"] = { id: "e2", type: "flashback_of", from: "s2", to: "s1" };
    const report2 = analyzeStoryHealth(nodes, edges);
    expect(report2.issues.find((i) => i.code === "CHRONOLOGY_INVERSION")).toBeUndefined();
  });

  test("tracks unfulfilled beats in reference sheets", () => {
    const nodes: Record<string, GraphNode> = {
      p1: { id: "p1", type: "project", title: "Project" },
      r1: {
        id: "r1",
        type: "reference",
        title: "Hero's Journey",
        beats: [
          { id: "b1", name: "Call to Adventure", done: false },
          { id: "b2", name: "Refusal of Call", done: true },
        ],
      },
    };

    const report = analyzeStoryHealth(nodes, {});
    const beatIssue = report.issues.find((i) => i.code === "BEAT_UNFULFILLED");
    expect(beatIssue).toBeDefined();
    expect(beatIssue?.title).toContain("Call to Adventure");
    expect(report.metrics.totalBeats).toBe(2);
    expect(report.metrics.fulfilledBeats).toBe(1);
  });
});
