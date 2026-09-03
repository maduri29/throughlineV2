// Connection-candidates derivation (pure, unit-tested): for a selected node,
// which existing nodes can it legally link to, and through which edge types.
// Backs the Inspector's "add connection" picker; the store's connect() remains
// the single mutation path (legality re-checked at commit).
import type { EdgeType, GraphEdge, GraphNode } from "../types";
import { legalEdgeTypes } from "./ops";

export type ConnectionCandidate = {
  targetId: string;
  /** Every legal edge type for this pair (non-empty by construction). */
  types: EdgeType[];
};

export function connectionTargets(
  nodes: Record<string, GraphNode>,
  edges: Record<string, GraphEdge>,
  sourceId: string,
): ConnectionCandidate[] {
  const source = nodes[sourceId];
  if (!source) return [];

  // Pre-index existing edge types from sourceId by target in one O(E) pass.
  const existingTypesByTarget = new Map<string, Set<EdgeType>>();
  for (const e of Object.values(edges)) {
    if (e.from === sourceId) {
      let s = existingTypesByTarget.get(e.to);
      if (!s) {
        s = new Set<EdgeType>();
        existingTypesByTarget.set(e.to, s);
      }
      s.add(e.type);
    }
  }

  const out: ConnectionCandidate[] = [];
  for (const n of Object.values(nodes)) {
    if (n.id === sourceId) continue;
    const types = legalEdgeTypes(source.type, n.type);
    // related_to is any↔any and always legal, so `types` is never empty here;
    // skip pairs already joined by every legal type to keep the picker honest.
    if (types.length === 0) continue;
    const existing = existingTypesByTarget.get(n.id);
    const remaining = existing ? types.filter((t) => !existing.has(t)) : types;
    if (remaining.length > 0) out.push({ targetId: n.id, types: remaining });
  }
  return out.sort((a, b) => {
    const an = nodes[a.targetId]?.title ?? "";
    const bn = nodes[b.targetId]?.title ?? "";
    return an.localeCompare(bn);
  });
}
