// Project scoping + Timeline grouping helpers (pure, unit-tested).
import type { GraphEdge, GraphNode } from "../types";

export type ScopedMaps = { nodes: Record<string, GraphNode>; edges: Record<string, GraphEdge> };

export const CONTAINER_TYPES = new Set(["project", "episode", "scene"]);

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
  // Pre-index children by parentId in one O(N) pass.
  const childrenByParent = new Map<string, string[]>();
  for (const n of Object.values(nodes)) {
    if (n.parentId) {
      const arr = childrenByParent.get(n.parentId);
      if (arr) arr.push(n.id);
      else childrenByParent.set(n.parentId, [n.id]);
    }
  }

  // Union of every project's parent subtree, minus this project's own —
  // nodes claimed structurally elsewhere may not be edge-pulled in.
  const claimed = new Set<string>();
  for (const p of Object.values(nodes)) {
    if (p.type !== "project" || p.id === projectId) continue;
    const stack = [p.id];
    while (stack.length > 0) {
      const cur = stack.pop()!;
      if (claimed.has(cur)) continue;
      claimed.add(cur);
      const kids = childrenByParent.get(cur);
      if (kids) {
        for (const kid of kids) stack.push(kid);
      }
    }
  }

  // Pre-index edges by both endpoints for fast incident lookup:
  const edgeList = Object.values(edges);
  const edgesByNode = new Map<string, GraphEdge[]>();
  for (const e of edgeList) {
    let fromList = edgesByNode.get(e.from);
    if (!fromList) {
      fromList = [];
      edgesByNode.set(e.from, fromList);
    }
    fromList.push(e);

    let toList = edgesByNode.get(e.to);
    if (!toList) {
      toList = [];
      edgesByNode.set(e.to, toList);
    }
    toList.push(e);
  }

  const keep = new Set<string>([projectId]);
  const queue: string[] = [projectId];
  let head = 0;

  while (head < queue.length) {
    const curId = queue[head++];
    if (!curId) continue;

    // Structural ownership first (deterministic priority).
    const kids = childrenByParent.get(curId);
    if (kids) {
      for (const kid of kids) {
        if (!keep.has(kid)) {
          keep.add(kid);
          queue.push(kid);
        }
      }
    }

    const incident = edgesByNode.get(curId);
    if (incident) {
      const kept = nodes[curId];
      if (!kept) continue;
      for (const e of incident) {
        const candId = e.from === curId ? e.to : e.from;
        if (keep.has(candId) || claimed.has(candId)) continue;
        const cand = nodes[candId];
        if (!cand) continue;

        if (kept.type === "scene" && !CONTAINER_TYPES.has(cand.type)) {
          keep.add(candId);
          queue.push(candId);
        } else if (
          e.type === "flashback_of" &&
          kept.type === "scene" &&
          cand.type === "scene" &&
          !cand.parentId
        ) {
          keep.add(candId);
          queue.push(candId);
        } else if (!CONTAINER_TYPES.has(kept.type) && !CONTAINER_TYPES.has(cand.type)) {
          keep.add(candId);
          queue.push(candId);
        }
      }
    }
  }

  const outNodes: Record<string, GraphNode> = {};
  for (const n of Object.values(nodes)) {
    // Truly orphaned subtrees (parent missing from db) attach to nothing — drop.
    if (keep.has(n.id)) outNodes[n.id] = n;
  }
  const outEdges: Record<string, GraphEdge> = {};
  for (const e of edgeList) {
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

/**
 * Days for every unscheduled scene, in Map order (episode order, then each
 * episode's child order, then anything parentless), continuing after the
 * highest scheduled day. Explicit days — including flashback negatives —
 * are never touched, so this is safe to offer as a one-click catch-up for
 * a story whose Timeline is still one big "unscheduled" pile.
 */
export function autoScheduleDays(nodes: GraphNode[]): Array<{ id: string; day: number }> {
  const scenes: GraphNode[] = [];
  const episodes: GraphNode[] = [];
  const byId = new Map<string, GraphNode>();
  let day = 1;

  for (const n of nodes) {
    byId.set(n.id, n);
    if (n.type === "scene") {
      scenes.push(n);
      const d = n.storyTime?.storyDay;
      if (d != null) day = Math.max(day, d + 1);
    } else if (n.type === "episode") {
      episodes.push(n);
    }
  }

  const unscheduledScenesByParent = new Map<string, GraphNode[]>();
  for (const s of scenes) {
    if (s.parentId && s.storyTime?.storyDay == null) {
      let list = unscheduledScenesByParent.get(s.parentId);
      if (!list) {
        list = [];
        unscheduledScenesByParent.set(s.parentId, list);
      }
      list.push(s);
    }
  }

  const queued = (parentId: string): GraphNode[] => {
    const kidsList = unscheduledScenesByParent.get(parentId);
    if (!kidsList || kidsList.length === 0) return [];
    const kids = new Map<string, GraphNode>();
    for (const s of kidsList) {
      kids.set(s.id, s);
    }
    const parentNode = byId.get(parentId);
    const ordered = (parentNode?.order ?? [])
      .map((id) => kids.get(id))
      .filter((s): s is GraphNode => Boolean(s));
    for (const [, s] of kids) if (!ordered.includes(s)) ordered.push(s);
    return ordered;
  };
  const out: Array<{ id: string; day: number }> = [];
  const placed = new Set<string>();
  for (const ep of episodes) {
    for (const s of queued(ep.id)) {
      out.push({ id: s.id, day: day++ });
      placed.add(s.id);
    }
  }
  for (const s of scenes) {
    if (s.storyTime?.storyDay != null || placed.has(s.id)) continue;
    out.push({ id: s.id, day: day++ });
  }
  return out;
}
