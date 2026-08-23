import { Background, Controls, ReactFlow } from "@xyflow/react";
import type { Edge, NodeTypes } from "@xyflow/react";
import { useMemo } from "react";
import GraphCard, { type CardFlowNode } from "./GraphNode";
import { useGraphStore } from "./store";
import type { GraphNode } from "./types";

const nodeTypes = { card: GraphCard } satisfies NodeTypes;

/** Storyline band layout (locked Map direction): episode columns + flashback lane. */
function layout(nodes: GraphNode[]): CardFlowNode[] {
  const out: CardFlowNode[] = [];

  const byParent = new Map<string, GraphNode[]>();
  for (const n of nodes) {
    if (n.type !== "scene" || !n.parentId) continue;
    const arr = byParent.get(n.parentId) ?? [];
    arr.push(n);
    byParent.set(n.parentId, arr);
  }

  const episodes = nodes.filter((n) => n.type === "episode");
  episodes.forEach((ep, ei) => {
    out.push({
      id: ep.id,
      type: "card",
      position: { x: ei * 300, y: 40 },
      data: { kind: "pill", title: ep.title },
      draggable: false,
      selectable: false,
    });
    for (const [si, sc] of (byParent.get(ep.id) ?? []).entries()) {
      const day = sc.storyTime?.storyDay ?? null;
      out.push({
        id: sc.id,
        type: "card",
        position: { x: ei * 300, y: 100 + si * 120 },
        data: {
          kind: "scene",
          title: sc.title,
          badge: day === null ? undefined : `D${day} · ${sc.storyTime?.tod ?? ""}`.trim(),
          synopsis: sc.synopsis,
        },
      });
    }
  });

  // Flashback lane on top
  for (const [fi, fb] of nodes
    .filter((n) => n.type === "scene" && (n.storyTime?.storyDay ?? 0) < 0)
    .entries()) {
    out.push({
      id: fb.id,
      type: "card",
      position: { x: 60 + fi * 300, y: -80 },
      data: {
        kind: "flashback",
        title: fb.title,
        badge: `D${fb.storyTime?.storyDay}`,
        synopsis: fb.synopsis,
      },
    });
  }

  // Non-scene material as a left rail of pills
  const rail = new Set(["character", "location", "theme", "project", "seed"]);
  for (const [oi, o] of nodes.filter((n) => rail.has(n.type)).entries()) {
    out.push({
      id: o.id,
      type: "card",
      position: { x: -280, y: 20 + oi * 56 },
      data: { kind: "pill", title: o.title },
      draggable: false,
      selectable: false,
    });
  }
  return out;
}

const EDGE_STROKE: Record<string, string> = {
  precedes: "#9aa2ad",
  contains: "#d3ccbc",
  flashback_of: "#b98a1f",
  sets_up: "#c96f6f",
  parallels: "#7a8794",
  appears_in: "#c56a2b",
  takes_place_at: "#3d8f5f",
  embodies: "#8460b8",
  relates_to: "#98a0a8",
  foreshadows: "#a5686f",
  grew_into: "#7a998f",
  related_to: "#aab2ba",
};

export default function App() {
  const graphNodes = useGraphStore((s) => s.nodes);
  const graphEdges = useGraphStore((s) => s.edges);

  const rfNodes = useMemo(() => layout(graphNodes), [graphNodes]);

  const rfEdges = useMemo<Edge[]>(
    () =>
      graphEdges.map((e) => ({
        id: e.id,
        source: e.from,
        target: e.to,
        label: e.label,
        style: {
          stroke: EDGE_STROKE[e.type] ?? "#999999",
          strokeWidth: 1.5,
          ...(e.type === "flashback_of" || e.type === "sets_up" ? { strokeDasharray: "5 4" } : {}),
        },
      })),
    [graphEdges],
  );

  return (
    <div className="tln-app">
      <header className="tln-header">
        <strong>Throughline</strong>
        <span className="tln-header__sub">
          HIGH WATER · scaffold seed ({graphNodes.length} nodes / {graphEdges.length} edges)
        </span>
      </header>
      <div className="tln-flow">
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.2}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#e4ddd0" gap={18} />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}
