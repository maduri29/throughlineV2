// Project scoping + Timeline grouping helpers (pure, unit-tested).
import type { GraphEdge, GraphNode } from "../types";

export type ScopedMaps = { nodes: Record<string, GraphNode>; edges: Record<string, GraphEdge> };

/** BFS down parentId chains from the project root; edges kept iff both ends survive. */
export function scopeToProject(
  nodes: Record<string, GraphNode>,
  edges: Record<string, GraphEdge>,
  projectId: string,
): ScopedMaps {
  const keep = new Set<string>([projectId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const n of Object.values(nodes)) {
      if (!keep.has(n.id) && n.parentId && keep.has(n.parentId)) {
        keep.add(n.id);
        grew = true;
      }
    }
  }
  const outNodes: Record<string, GraphNode> = {};
  for (const n of Object.values(nodes)) {
    // Orphaned subtrees (parent missing from db) attach to nothing — drop silently.
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
