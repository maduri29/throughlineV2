import { Effect } from "effect";
import type { GraphEdge, GraphNode } from "../../types";

export type DiagnosticSeverity = "error" | "warning" | "info";
export type DiagnosticCategory = "flow" | "timeline" | "characters" | "structure";

export type DiagnosticIssue = {
  id: string;
  severity: DiagnosticSeverity;
  category: DiagnosticCategory;
  code: string;
  title: string;
  message: string;
  nodeIds: string[];
};

export type StoryHealthRating =
  | "Flawless Narrative Architecture"
  | "Strong Story Structure"
  | "Needs Revision"
  | "Structural Issues Found";

export type StoryHealthReport = {
  score: number; // 0 - 100
  rating: StoryHealthRating;
  issues: DiagnosticIssue[];
  metrics: {
    totalScenes: number;
    connectedScenes: number;
    totalCharacters: number;
    activeCharacters: number;
    totalBeats: number;
    fulfilledBeats: number;
  };
  analyzedAt: string;
};

/* --------------------------------- Rules --------------------------------- */

/**
 * Detects circular precedes connections (narrative causality loops) and self-loops.
 */
function detectFlowCycles(
  nodes: Record<string, GraphNode>,
  edges: Record<string, GraphEdge>,
): Effect.Effect<DiagnosticIssue[]> {
  return Effect.sync(() => {
    const issues: DiagnosticIssue[] = [];

    // Check for self loops and build directed graph of sequence flow
    const adj = new Map<string, string[]>();
    for (const id in edges) {
      const e = edges[id];
      if (!e) continue;
      if (e.from === e.to) {
        const node = nodes[e.from];
        issues.push({
          id: `self-loop-${e.id}`,
          severity: "error",
          category: "flow",
          code: "SELF_LOOP",
          title: "Self-referential Connection",
          message: `"${node?.title ?? e.from}" connects directly to itself with "${e.type}".`,
          nodeIds: [e.from],
        });
      } else if (e.type === "precedes") {
        let list = adj.get(e.from);
        if (!list) {
          list = [];
          adj.set(e.from, list);
        }
        list.push(e.to);
      }
    }

    const visited = new Set<string>();
    const recStack = new Set<string>();
    const path: string[] = [];
    const reportedCycles = new Set<string>();

    function dfs(nodeId: string): void {
      visited.add(nodeId);
      recStack.add(nodeId);
      path.push(nodeId);

      const neighbors = adj.get(nodeId) ?? [];
      for (const next of neighbors) {
        if (!visited.has(next)) {
          dfs(next);
        } else if (recStack.has(next)) {
          // Cycle found
          const cycleStartIdx = path.indexOf(next);
          const cycle = path.slice(cycleStartIdx);
          const cycleKey = [...cycle].sort().join("->");
          if (!reportedCycles.has(cycleKey)) {
            reportedCycles.add(cycleKey);
            const cycleTitles = cycle.map((id) => nodes[id]?.title ?? id).join(" ➔ ");
            issues.push({
              id: `cycle-${cycleKey}`,
              severity: "error",
              category: "flow",
              code: "FLOW_CYCLE",
              title: "Narrative Causal Loop Detected",
              message: `Scenes form a closed sequence loop: ${cycleTitles} ➔ ${nodes[next]?.title ?? next}`,
              nodeIds: cycle,
            });
          }
        }
      }

      recStack.delete(nodeId);
      path.pop();
    }

    for (const nodeId of adj.keys()) {
      if (!visited.has(nodeId)) {
        dfs(nodeId);
      }
    }

    return issues;
  });
}

/**
 * Detects orphan scenes, inactive characters, unused locations, and floating themes.
 */
function detectOrphans(
  nodes: Record<string, GraphNode>,
  edges: Record<string, GraphEdge>,
): Effect.Effect<{
  issues: DiagnosticIssue[];
  totalScenes: number;
  connectedScenes: number;
  totalCharacters: number;
  activeCharacters: number;
}> {
  return Effect.sync(() => {
    const issues: DiagnosticIssue[] = [];

    let totalScenes = 0;
    let connectedScenes = 0;
    let totalCharacters = 0;
    let activeCharacters = 0;

    // Build degree maps
    const nodeDegree = new Map<string, number>();
    const characterAppearances = new Map<string, number>();
    const locationScenes = new Map<string, number>();
    const themeEmbodiments = new Map<string, number>();

    for (const id in edges) {
      const e = edges[id];
      if (!e) continue;
      nodeDegree.set(e.from, (nodeDegree.get(e.from) ?? 0) + 1);
      nodeDegree.set(e.to, (nodeDegree.get(e.to) ?? 0) + 1);

      if (e.type === "appears_in") {
        characterAppearances.set(e.from, (characterAppearances.get(e.from) ?? 0) + 1);
      } else if (e.type === "takes_place_at") {
        locationScenes.set(e.to, (locationScenes.get(e.to) ?? 0) + 1);
      } else if (e.type === "embodies") {
        themeEmbodiments.set(e.to, (themeEmbodiments.get(e.to) ?? 0) + 1);
      }
    }

    for (const id in nodes) {
      const node = nodes[id];
      if (!node) continue;
      if (node.type === "scene") {
        totalScenes++;
        const degree = nodeDegree.get(node.id) ?? 0;
        const hasParent = Boolean(node.parentId);
        if (degree > 0 || hasParent) {
          connectedScenes++;
        } else {
          issues.push({
            id: `orphan-scene-${node.id}`,
            severity: "warning",
            category: "structure",
            code: "SCENE_ORPHAN",
            title: "Floating Scene (No Connections)",
            message: `"${node.title}" has no container and no connections to characters, locations, or sequence.`,
            nodeIds: [node.id],
          });
        }
      } else if (node.type === "character") {
        totalCharacters++;
        const appearances = characterAppearances.get(node.id) ?? 0;
        if (appearances > 0) {
          activeCharacters++;
        } else {
          issues.push({
            id: `unused-char-${node.id}`,
            severity: "info",
            category: "characters",
            code: "CHARACTER_UNUSED",
            title: "Character With No Scene Appearances",
            message: `"${node.title}" has not been linked to appear in any scene yet.`,
            nodeIds: [node.id],
          });
        }
      } else if (node.type === "location") {
        const scenesHere = locationScenes.get(node.id) ?? 0;
        if (scenesHere === 0) {
          issues.push({
            id: `unused-loc-${node.id}`,
            severity: "info",
            category: "structure",
            code: "LOCATION_UNUSED",
            title: "Location With No Scenes",
            message: `Location "${node.title}" has no scenes set to take place at it.`,
            nodeIds: [node.id],
          });
        }
      } else if (node.type === "theme") {
        const embodiments = themeEmbodiments.get(node.id) ?? 0;
        if (embodiments === 0) {
          issues.push({
            id: `unused-theme-${node.id}`,
            severity: "info",
            category: "structure",
            code: "THEME_UNUSED",
            title: "Theme Not Embodied",
            message: `Theme "${node.title}" is not linked to any embodying scene or character.`,
            nodeIds: [node.id],
          });
        }
      }
    }

    return {
      issues,
      totalScenes,
      connectedScenes,
      totalCharacters,
      activeCharacters,
    };
  });
}

/**
 * Detects chronology anomalies: sequence moves backwards in storyDay without a flashback relation.
 */
function detectTimelineAnomalies(
  nodes: Record<string, GraphNode>,
  edges: Record<string, GraphEdge>,
): Effect.Effect<DiagnosticIssue[]> {
  return Effect.sync(() => {
    const issues: DiagnosticIssue[] = [];

    // Set of flashback connections & precedes edges
    const flashbacks = new Set<string>();
    const precedesEdges: GraphEdge[] = [];
    for (const id in edges) {
      const e = edges[id];
      if (!e) continue;
      if (e.type === "flashback_of") {
        flashbacks.add(`${e.from}->${e.to}`);
        flashbacks.add(`${e.to}->${e.from}`);
      } else if (e.type === "precedes") {
        precedesEdges.push(e);
      }
    }

    for (const e of precedesEdges) {
      const fromNode = nodes[e.from];
      const toNode = nodes[e.to];
      if (
        fromNode?.type === "scene" &&
        toNode?.type === "scene" &&
        fromNode.storyTime?.storyDay != null &&
        toNode.storyTime?.storyDay != null
      ) {
        const fromDay = fromNode.storyTime.storyDay;
        const toDay = toNode.storyTime.storyDay;
        if (fromDay > toDay && !flashbacks.has(`${fromNode.id}->${toNode.id}`)) {
          issues.push({
            id: `chronology-conflict-${e.id}`,
            severity: "warning",
            category: "timeline",
            code: "CHRONOLOGY_INVERSION",
            title: "Chronological Sequence Conflict",
            message: `"${fromNode.title}" (Day ${fromDay}) precedes "${toNode.title}" (Day ${toDay}), traveling backwards in story time without a flashback edge.`,
            nodeIds: [fromNode.id, toNode.id],
          });
        }
      }
    }

    // Flag scenes that lack story-time scheduling when others are scheduled
    let anyDated = false;
    const sceneList: GraphNode[] = [];
    for (const id in nodes) {
      const n = nodes[id];
      if (n && n.type === "scene") {
        sceneList.push(n);
        if (n.storyTime?.storyDay != null) anyDated = true;
      }
    }
    if (anyDated) {
      for (const scene of sceneList) {
        if (scene.storyTime?.storyDay == null && scene.storyTime?.tod == null) {
          issues.push({
            id: `unscheduled-${scene.id}`,
            severity: "info",
            category: "timeline",
            code: "SCENE_UNSCHEDULED",
            title: "Unscheduled Story Time",
            message: `"${scene.title}" has no story day or time-of-day scheduled.`,
            nodeIds: [scene.id],
          });
        }
      }
    }

    return issues;
  });
}

/**
 * Detects unfulfilled beat sheets and empty scenes.
 */
function detectStructureAndBeats(nodes: Record<string, GraphNode>): Effect.Effect<{
  issues: DiagnosticIssue[];
  totalBeats: number;
  fulfilledBeats: number;
}> {
  return Effect.sync(() => {
    const issues: DiagnosticIssue[] = [];
    let totalBeats = 0;
    let fulfilledBeats = 0;

    for (const node of Object.values(nodes)) {
      // Check empty scenes
      if (node.type === "scene") {
        const hasSynopsis = Boolean(node.synopsis?.trim());
        const hasFountain = Boolean(node.fountain?.trim());
        if (!hasSynopsis && !hasFountain) {
          issues.push({
            id: `empty-scene-${node.id}`,
            severity: "info",
            category: "structure",
            code: "SCENE_EMPTY",
            title: "Empty Scene Outline",
            message: `"${node.title}" has no synopsis outline or screenplay text yet.`,
            nodeIds: [node.id],
          });
        }
      }

      // Check beats in reference nodes
      if (node.type === "reference" && Array.isArray(node.beats)) {
        for (const beat of node.beats) {
          totalBeats++;
          const fulfilled = beat.done || Boolean(beat.sceneId && nodes[beat.sceneId]);
          if (fulfilled) {
            fulfilledBeats++;
          } else {
            issues.push({
              id: `unfulfilled-beat-${node.id}-${beat.id}`,
              severity: "info",
              category: "structure",
              code: "BEAT_UNFULFILLED",
              title: `Unlinked Beat: ${beat.name}`,
              message: `Beat "${beat.name}" in reference sheet "${node.title}" has not been linked to a scene or completed.`,
              nodeIds: [node.id],
            });
          }
        }
      }
    }

    return { issues, totalBeats, fulfilledBeats };
  });
}

/* --------------------------------- Engine --------------------------------- */

/**
 * Composable Effect program that analyzes story health and structural integrity.
 */
export function analyzeStoryHealthEffect(
  nodes: Record<string, GraphNode>,
  edges: Record<string, GraphEdge>,
): Effect.Effect<StoryHealthReport> {
  return Effect.gen(function* () {
    const [cycleIssues, orphanData, timelineIssues, structureData] = yield* Effect.all(
      [
        detectFlowCycles(nodes, edges),
        detectOrphans(nodes, edges),
        detectTimelineAnomalies(nodes, edges),
        detectStructureAndBeats(nodes),
      ],
      { concurrency: "unbounded" },
    );

    const issues = [
      ...cycleIssues,
      ...orphanData.issues,
      ...timelineIssues,
      ...structureData.issues,
    ];

    // Calculate score
    let penalty = 0;
    for (const issue of issues) {
      if (issue.severity === "error") penalty += 25;
      else if (issue.severity === "warning") penalty += 8;
      else if (issue.severity === "info") penalty += 2;
    }

    const score = Math.max(0, Math.min(100, 100 - penalty));

    let rating: StoryHealthRating;
    if (score >= 95) {
      rating = "Flawless Narrative Architecture";
    } else if (score >= 80) {
      rating = "Strong Story Structure";
    } else if (score >= 60) {
      rating = "Needs Revision";
    } else {
      rating = "Structural Issues Found";
    }

    return {
      score,
      rating,
      issues,
      metrics: {
        totalScenes: orphanData.totalScenes,
        connectedScenes: orphanData.connectedScenes,
        totalCharacters: orphanData.totalCharacters,
        activeCharacters: orphanData.activeCharacters,
        totalBeats: structureData.totalBeats,
        fulfilledBeats: structureData.fulfilledBeats,
      },
      analyzedAt: new Date().toISOString(),
    };
  });
}

/**
 * Synchronous runner for React components and synchronous stores.
 */
export function analyzeStoryHealth(
  nodes: Record<string, GraphNode>,
  edges: Record<string, GraphEdge>,
): StoryHealthReport {
  return Effect.runSync(analyzeStoryHealthEffect(nodes, edges));
}
