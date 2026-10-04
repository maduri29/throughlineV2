import { Effect } from "effect";
import { CONTAINER_TYPES } from "./scopes";
import type { GraphEdge, GraphNode } from "../types";

export type StoryStats = { scenes: number; characters: number };
export type StorySort = "library" | "title" | "scenes";

/** Delete structural ownership only; shared research and linked entities survive. */
export function projectDeletionIds(nodes: GraphNode[], projectId: string): Set<string> {
  if (!nodes.some((node) => node.id === projectId && node.type === "project")) return new Set();
  const childrenMap = new Map<string, string[]>();
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node?.parentId) {
      let list = childrenMap.get(node.parentId);
      if (!list) {
        list = [];
        childrenMap.set(node.parentId, list);
      }
      list.push(node.id);
    }
  }
  const ids = new Set([projectId]);
  const queue = [projectId];
  while (queue.length > 0) {
    const parentId = queue.pop()!;
    const children = childrenMap.get(parentId);
    if (children) {
      for (let i = 0; i < children.length; i++) {
        const childId = children[i]!;
        if (!ids.has(childId)) {
          ids.add(childId);
          queue.push(childId);
        }
      }
    }
  }
  return ids;
}

type StoryGraphIndex = {
  nodeMap: Record<string, GraphNode>;
  childrenByParent: Map<string, string[]>;
  ownerProject: Map<string, string>;
  edgesByNode: Map<string, GraphEdge[]>;
};

function indexStoryGraph(nodes: GraphNode[], edges: GraphEdge[]): StoryGraphIndex {
  const nodeMap: Record<string, GraphNode> = {};
  const childrenByParent = new Map<string, string[]>();

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (!node) continue;
    nodeMap[node.id] = node;
    if (node.parentId) {
      let list = childrenByParent.get(node.parentId);
      if (!list) {
        list = [];
        childrenByParent.set(node.parentId, list);
      }
      list.push(node.id);
    }
  }

  // Map each node to its structural root project in one pass
  const ownerProject = new Map<string, string>();
  for (let i = 0; i < nodes.length; i++) {
    const p = nodes[i];
    if (p?.type !== "project") continue;
    const stack = [p.id];
    ownerProject.set(p.id, p.id);
    while (stack.length > 0) {
      const cur = stack.pop()!;
      const kids = childrenByParent.get(cur);
      if (kids) {
        for (let k = 0; k < kids.length; k++) {
          const kid = kids[k]!;
          if (!ownerProject.has(kid)) {
            ownerProject.set(kid, p.id);
            stack.push(kid);
          }
        }
      }
    }
  }

  // Pre-index edges by both endpoints
  const edgesByNode = new Map<string, GraphEdge[]>();
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i];
    if (!e) continue;
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

  return { nodeMap, childrenByParent, ownerProject, edgesByNode };
}

/**
 * Concurrently summarize project story counts using an Effect-powered pipeline
 * with pre-indexed graph indices.
 */
export function summarizeStoriesEffect(
  projects: GraphNode[],
  nodes: GraphNode[],
  edges: GraphEdge[],
): Effect.Effect<Record<string, StoryStats>> {
  return Effect.sync(() => indexStoryGraph(nodes, edges)).pipe(
    Effect.flatMap(({ nodeMap, childrenByParent, ownerProject, edgesByNode }) => {
      const projectEffects = projects.map((project) =>
        Effect.sync((): readonly [string, StoryStats] => {
          let scenes = 0;
          let characters = 0;
          const keep = new Set<string>([project.id]);
          const queue: string[] = [project.id];
          let head = 0;

          while (head < queue.length) {
            const curId = queue[head++];
            if (!curId) continue;
            const node = nodeMap[curId];
            if (node) {
              if (node.type === "scene") scenes++;
              else if (node.type === "character") characters++;
            }

            const kids = childrenByParent.get(curId);
            if (kids) {
              for (let i = 0; i < kids.length; i++) {
                const kid = kids[i]!;
                if (!keep.has(kid)) {
                  keep.add(kid);
                  queue.push(kid);
                }
              }
            }

            const incident = edgesByNode.get(curId);
            if (incident && node) {
              for (let i = 0; i < incident.length; i++) {
                const e = incident[i]!;
                const candId = e.from === curId ? e.to : e.from;
                if (keep.has(candId)) continue;
                const candOwner = ownerProject.get(candId);
                if (candOwner !== undefined && candOwner !== project.id) continue;
                const cand = nodeMap[candId];
                if (!cand) continue;

                if (node.type === "scene" && !CONTAINER_TYPES.has(cand.type)) {
                  keep.add(candId);
                  queue.push(candId);
                } else if (
                  e.type === "flashback_of" &&
                  node.type === "scene" &&
                  cand.type === "scene" &&
                  !cand.parentId
                ) {
                  keep.add(candId);
                  queue.push(candId);
                } else if (!CONTAINER_TYPES.has(node.type) && !CONTAINER_TYPES.has(cand.type)) {
                  keep.add(candId);
                  queue.push(candId);
                }
              }
            }
          }

          return [project.id, { scenes, characters }] as const;
        }),
      );

      return Effect.all(projectEffects, { concurrency: "unbounded" }).pipe(
        Effect.map((entries) => {
          const result: Record<string, StoryStats> = {};
          for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            if (entry) {
              result[entry[0]] = entry[1];
            }
          }
          return result;
        }),
      );
    }),
  );
}

/**
 * Concurrently extract all scoped scenes grouped by project ID.
 */
export function scopedScenesByProjectEffect(
  projects: GraphNode[],
  nodes: GraphNode[],
  edges: GraphEdge[],
): Effect.Effect<Record<string, GraphNode[]>> {
  return Effect.sync(() => indexStoryGraph(nodes, edges)).pipe(
    Effect.flatMap(({ nodeMap, childrenByParent, ownerProject, edgesByNode }) => {
      const projectEffects = projects.map((project) =>
        Effect.sync((): readonly [string, GraphNode[]] => {
          const scenes: GraphNode[] = [];
          const keep = new Set<string>([project.id]);
          const queue: string[] = [project.id];
          let head = 0;

          while (head < queue.length) {
            const curId = queue[head++];
            if (!curId) continue;
            const node = nodeMap[curId];
            if (node && node.type === "scene") {
              scenes.push(node);
            }

            const kids = childrenByParent.get(curId);
            if (kids) {
              for (let i = 0; i < kids.length; i++) {
                const kid = kids[i]!;
                if (!keep.has(kid)) {
                  keep.add(kid);
                  queue.push(kid);
                }
              }
            }

            const incident = edgesByNode.get(curId);
            if (incident && node) {
              for (let i = 0; i < incident.length; i++) {
                const e = incident[i]!;
                const candId = e.from === curId ? e.to : e.from;
                if (keep.has(candId)) continue;
                const candOwner = ownerProject.get(candId);
                if (candOwner !== undefined && candOwner !== project.id) continue;
                const cand = nodeMap[candId];
                if (!cand) continue;

                if (node.type === "scene" && !CONTAINER_TYPES.has(cand.type)) {
                  keep.add(candId);
                  queue.push(candId);
                } else if (
                  e.type === "flashback_of" &&
                  node.type === "scene" &&
                  cand.type === "scene" &&
                  !cand.parentId
                ) {
                  keep.add(candId);
                  queue.push(candId);
                } else if (!CONTAINER_TYPES.has(node.type) && !CONTAINER_TYPES.has(cand.type)) {
                  keep.add(candId);
                  queue.push(candId);
                }
              }
            }
          }

          return [project.id, scenes] as const;
        }),
      );

      return Effect.all(projectEffects, { concurrency: "unbounded" }).pipe(
        Effect.map((entries) => {
          const result: Record<string, GraphNode[]> = {};
          for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            if (entry) {
              result[entry[0]] = entry[1];
            }
          }
          return result;
        }),
      );
    }),
  );
}

export function summarizeStories(
  projects: GraphNode[],
  nodes: GraphNode[],
  edges: GraphEdge[],
): Record<string, StoryStats> {
  return Effect.runSync(summarizeStoriesEffect(projects, nodes, edges));
}

export function selectStories(
  projects: GraphNode[],
  query: string,
  sort: StorySort,
  stats: Record<string, StoryStats>,
): GraphNode[] {
  const term = query.trim().toLocaleLowerCase();
  const matches = term
    ? projects.filter((project) =>
        [project.title, project.author, project.synopsis].some((value) =>
          value?.toLocaleLowerCase().includes(term),
        ),
      )
    : projects.slice();
  if (sort === "title") matches.sort((a, b) => a.title.localeCompare(b.title));
  if (sort === "scenes")
    matches.sort((a, b) => (stats[b.id]?.scenes ?? 0) - (stats[a.id]?.scenes ?? 0));
  return matches;
}
