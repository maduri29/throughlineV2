// The mutation op-log behind ADR-0003 (full persisted undo/redo). Every user-visible
// change is a batch of forward ops with a precomputed inverse batch; history entries
// are plain JSON so they persist to IndexedDB and survive restarts.
import type { EdgeType, GraphEdge, GraphNode, NodeType } from "../types";

export type Op =
  | { t: "addNode"; node: GraphNode }
  | { t: "patchNode"; id: string; patch: Partial<GraphNode>; prev: Partial<GraphNode> }
  | { t: "deleteNodes"; nodes: GraphNode[]; edges: GraphEdge[] }
  | { t: "addEdge"; edge: GraphEdge }
  | { t: "patchEdge"; id: string; patch: Partial<GraphEdge>; prev: Partial<GraphEdge> }
  | { t: "deleteEdge"; edge: GraphEdge };

export type HistoryEntry = {
  at: number;
  label: string;
  forward: Op[];
  inverse: Op[];
};

export type NodeMaps = {
  nodes: Record<string, GraphNode>;
  edges: Record<string, GraphEdge>;
};

/** Apply one op to maps that the caller has already shallow-cloned. Mutates in place. */
export function applyOp(m: NodeMaps, op: Op): void {
  switch (op.t) {
    case "addNode":
      m.nodes[op.node.id] = op.node;
      break;
    case "patchNode": {
      const cur = m.nodes[op.id];
      if (cur) m.nodes[op.id] = { ...cur, ...op.patch };
      break;
    }
    case "deleteNodes":
      for (const n of op.nodes) delete m.nodes[n.id];
      for (const e of op.edges) delete m.edges[e.id];
      break;
    case "addEdge":
      m.edges[op.edge.id] = op.edge;
      break;
    case "patchEdge": {
      const cur = m.edges[op.id];
      if (cur) m.edges[op.id] = { ...cur, ...op.patch };
      break;
    }
    case "deleteEdge":
      delete m.edges[op.edge.id];
      break;
  }
}

export function applyBatch(m: NodeMaps, ops: Op[]): void {
  for (const op of ops) applyOp(m, op);
}

/** Inverse of a forward batch, in reverse order — pairs computed at commit time. */
export function invertBatch(forward: Op[]): Op[] {
  const out: Op[] = [];
  for (const op of [...forward].reverse()) {
    switch (op.t) {
      case "addNode":
        out.push({
          t: "deleteNodes",
          nodes: [op.node],
          edges: [],
        });
        break;
      case "patchNode":
        out.push({ t: "patchNode", id: op.id, patch: op.prev, prev: op.patch });
        break;
      case "deleteNodes":
        out.push(...op.nodes.map((n) => ({ t: "addNode", node: n }) as Op));
        out.push(...op.edges.map((e) => ({ t: "addEdge", edge: e }) as Op));
        break;
      case "addEdge":
        out.push({ t: "deleteEdge", edge: op.edge });
        break;
      case "patchEdge":
        out.push({ t: "patchEdge", id: op.id, patch: op.prev, prev: op.patch });
        break;
      case "deleteEdge":
        out.push({ t: "addEdge", edge: op.edge });
        break;
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Edge legality — derived from CONTEXT.md's connection definitions.  */
/* ------------------------------------------------------------------ */

const ANY = new Set<NodeType>([
  "seed",
  "project",
  "episode",
  "scene",
  "character",
  "location",
  "theme",
  "reference",
]);

/** Which edge types may legally run from `a` to `b` (self-loops never legal). */
export function legalEdgeTypes(a: NodeType, b: NodeType): EdgeType[] {
  if (a === b && a === "project") return [];
  const legal: EdgeType[] = [];
  const push = (t: EdgeType, ok: boolean): void => {
    if (ok) legal.push(t);
  };
  push(
    "contains",
    (a === "project" && (b === "episode" || b === "scene")) || (a === "episode" && b === "scene"),
  );
  push("appears_in", a === "character" && b === "scene");
  push("takes_place_at", a === "scene" && b === "location");
  push("relates_to", a === "character" && b === "character");
  push("precedes", a === "scene" && b === "scene");
  push("flashback_of", a === "scene" && b === "scene");
  push("parallels", a === "scene" && b === "scene");
  push("foreshadows", (a === "seed" || a === "scene") && b === "scene");
  push("sets_up", a === "scene" && b === "scene");
  push("embodies", (a === "character" || a === "scene") && b === "theme");
  push("grew_into", a === "seed" && (b === "project" || b === "scene"));
  // A reference is material *about* something, so it attaches to anything and
  // constrains nothing. Giving it its own verbs would be inventing structure the
  // writer has not asked for; related_to already means "these belong together".
  push("related_to", a !== b && ANY.has(a) && ANY.has(b));
  return legal;
}

export function isLegal(a: NodeType, b: NodeType, t: EdgeType): boolean {
  return legalEdgeTypes(a, b).includes(t);
}
