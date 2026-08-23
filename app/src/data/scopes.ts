// Project scoping + Timeline grouping helpers (pure, unit-tested).
import type { GraphEdge, GraphNode } from "../types";

export type ScopedMaps = { nodes: Record<string, GraphNode>; edges: Record<string, GraphEdge> };

const CONTAINER_TYPES = new Set(["project", "episode", "scene"]);

/**
 * Keep-set = the parent-chain subtree of the project, grown outward through
 * edges so parentless entities (characters, locations, themes, seeds — and
 * legacy flashback scenes) stay visible. Growth is deliberately constrained:
 *
 *  - a non-container joined when a kept SCENE links to it (appears_in,
 *    takes_place_at, embodies…);
 *  - two non-containers join when either side is already kept (related_to
 *    chains like Boathouse ↔ The Water);
 *  - a parentless SCENE joins only via flashback_of to a kept scene (legacy
 *    seed data; new flashbacks get parentId = project);
 *  - nothing joins if another project's parent-subtree already claims it —
 *    explicit ownership beats incidental edges, so cross-project links
 *    never leak a foreign story into scope.
 */
export function scopeToProject(
  nodes: Record<string, GraphNode>,
  edges: Record<string, GraphEdge>,
  projectId: string,
): ScopedMaps {
  // Union of every project's parent subtree, minus this project's own —
  // nodes claimed structurally elsewhere may not be edge-pulled in.
  const claimed = new Set<string>();
  for (const p of Object.values(nodes)) {
    if (p.type !== "project" || p.id === projectId) continue;
    const stack = [p.id];
    while (stack.length > 0) {
      const cur = stack.pop();
      if (cur === undefined || claimed.has(cur)) continue;
      claimed.add(cur);
      for (const n of Object.values(nodes)) {
        if (n.parentId === cur) stack.push(n.id);
      }
    }
  }

  const keep = new Set<string>([projectId]);
  let grew = true;
  while (grew) {
    grew = false;
    // Structural ownership first (deterministic priority).
    for (const n of Object.values(nodes)) {
      if (!keep.has(n.id) && n.parentId && keep.has(n.parentId)) {
        keep.add(n.id);
        grew = true;
      }
    }
    for (const e of Object.values(edges)) {
      const a = nodes[e.from];
      const b = nodes[e.to];
      if (!a || !b) continue;
      const aKept = keep.has(a.id);
      const bKept = keep.has(b.id);
      if (aKept === bKept) continue;
      const kept = (aKept ? a : b) as GraphNode;
      const cand = (aKept ? b : a) as GraphNode;
      if (claimed.has(cand.id)) continue;
      if (kept.type === "scene" && !CONTAINER_TYPES.has(cand.type)) {
        keep.add(cand.id);
        grew = true;
      } else if (
        e.type === "flashback_of" &&
        kept.type === "scene" &&
        cand.type === "scene" &&
        !cand.parentId
      ) {
        keep.add(cand.id);
        grew = true;
      } else if (!CONTAINER_TYPES.has(kept.type) && !CONTAINER_TYPES.has(cand.type)) {
        keep.add(cand.id);
        grew = true;
      }
    }
  }

  const outNodes: Record<string, GraphNode> = {};
  for (const n of Object.values(nodes)) {
    // Truly orphaned subtrees (parent missing from db) attach to nothing — drop.
    if (keep.has(n.id)) outNodes[n.id] = n;
  }
  const outEdges: Record<string, GraphEdge> = {};
  for (const e of Object.values(edges)) {
    if (keep.has(e.from) && keep.has(e.to)) outEdges[e.id] = e;
  }
  return { nodes: outNodes, edges: outEdges };
}

export type DayBucket = { day: number | null; scenes: GraphNode[] };

/** Chronological buckets for the Timeline lens: sorted real days, nulls last. */
export function groupByDay(scenes: GraphNode[]): DayBucket[] {
  const withDay = new Map<number, GraphNode[]>();
  const undated: GraphNode[] = [];
  for (const s of scenes) {
    const d = s.storyTime?.storyDay ?? null;
    if (d === null) {
      undated.push(s);
      continue;
    }
    const arr = withDay.get(d) ?? [];
    arr.push(s);
    withDay.set(d, arr);
  }
  const days = [...withDay.keys()].sort((a, b) => a - b);
  const out: DayBucket[] = days.map((day) => ({ day, scenes: withDay.get(day) ?? [] }));
  if (undated.length > 0) out.push({ day: null, scenes: undated });
  return out;
}
