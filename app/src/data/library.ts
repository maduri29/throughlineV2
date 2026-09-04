import { scopeToProject } from "./scopes";
import type { GraphEdge, GraphNode } from "../types";

export type StoryStats = { scenes: number; characters: number };
export type StorySort = "library" | "title" | "scenes";

export function summarizeStories(
  projects: GraphNode[],
  nodes: GraphNode[],
  edges: GraphEdge[],
): Record<string, StoryStats> {
  const nodeMap = Object.fromEntries(nodes.map((node) => [node.id, node]));
  const edgeMap = Object.fromEntries(edges.map((edge) => [edge.id, edge]));
  return Object.fromEntries(
    projects.map((project) => {
      const scoped = scopeToProject(nodeMap, edgeMap, project.id);
      const stats = { scenes: 0, characters: 0 };
      for (const node of Object.values(scoped.nodes)) {
        if (node.type === "scene") stats.scenes++;
        if (node.type === "character") stats.characters++;
      }
      return [project.id, stats];
    }),
  );
}

export function selectStories(
  projects: GraphNode[],
  query: string,
  sort: StorySort,
  stats: Record<string, StoryStats>,
): GraphNode[] {
  const term = query.trim().toLocaleLowerCase();
  const matches = projects.filter((project) =>
    [project.title, project.author, project.synopsis].some((value) =>
      value?.toLocaleLowerCase().includes(term),
    ),
  );
  if (sort === "title") matches.sort((a, b) => a.title.localeCompare(b.title));
  if (sort === "scenes")
    matches.sort((a, b) => (stats[b.id]?.scenes ?? 0) - (stats[a.id]?.scenes ?? 0));
  return matches;
}
