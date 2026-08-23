// Timeline lens: the second order (chronology by storyDay) against the Map's
// storyline bands. Flashbacks (negative days) render in the upper lane.
import { Background, Controls, ReactFlow, ReactFlowProvider } from "@xyflow/react";
import type { Edge, NodeTypes } from "@xyflow/react";
import { useMemo } from "react";
import GraphCard, { type CardFlowNode } from "../GraphNode";
import { groupByDay } from "../data/scopes";
import { useGraphStore } from "../store";

const nodeTypes = { card: GraphCard } satisfies NodeTypes;
const COL_W = 240;

function TimelineInner() {
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const select = useGraphStore((s) => s.select);

  const rfNodes = useMemo<CardFlowNode[]>(() => {
    const scenes = Object.values(nodes).filter((n) => n.type === "scene");
    const buckets = groupByDay(scenes);
    const out: CardFlowNode[] = [];
    for (const [bi, b] of buckets.entries()) {
      const isFlashLane = b.day !== null && b.day < 0;
      const x = bi * COL_W;
      const y0 = isFlashLane ? -40 : 120;
      out.push({
        id: `day-${b.day ?? "null"}`,
        type: "card",
        position: { x, y: isFlashLane ? -110 : 40 },
        data: {
          kind: "pill",
          title: b.day === null ? "unscheduled" : `Day ${b.day}`,
        },
        draggable: false,
        selectable: false,
      });
      for (const [si, sc] of b.scenes.entries()) {
        out.push({
          id: sc.id,
          type: "card",
          position: { x, y: y0 + si * 110 },
          data: {
            kind: isFlashLane ? "flashback" : "scene",
            title: sc.title,
            badge: sc.storyTime?.tod ?? "",
            synopsis: sc.synopsis,
          },
        });
      }
    }
    return out;
  }, [nodes]);

  const rfEdges = useMemo<Edge[]>(
    () =>
      Object.values(edges)
        .filter(
          (e) =>
            (e.type === "precedes" || e.type === "flashback_of" || e.type === "parallels") &&
            rfNodes.some((n) => n.id === e.from) &&
            rfNodes.some((n) => n.id === e.to),
        )
        .map((e) => ({
          id: e.id,
          source: e.from,
          target: e.to,
          style: {
            stroke: e.type === "flashback_of" ? "#b98a1f" : "#9aa2ad",
            strokeDasharray: e.type === "precedes" ? undefined : "5 4",
          },
        })),
    [edges, rfNodes],
  );

  return (
    <div className="tln-timeline">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.25}
        maxZoom={2.5}
        proOptions={{ hideAttribution: true }}
        onNodeClick={(_, n) => select([n.id])}
        onPaneClick={() => select([])}
        nodesDraggable={false}
      >
        <Background color="#e4ddd0" gap={18} />
        <Controls />
      </ReactFlow>
    </div>
  );
}

export default function TimelineView() {
  return (
    <ReactFlowProvider>
      <TimelineInner />
    </ReactFlowProvider>
  );
}
