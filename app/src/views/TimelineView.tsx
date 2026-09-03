// Timeline lens: the second order (chronology by storyDay) against the Map's
// storyline bands. Flashbacks (negative days) render in the upper lane.
// Scene cards drag horizontally to reschedule: drop-x picks the day column
// and one patchNode commits the move (undoable like any edit).
import { Background, Controls, ReactFlow, ReactFlowProvider } from "@xyflow/react";
import type { Edge, NodeTypes } from "@xyflow/react";
import { useCallback, useMemo } from "react";
import GraphCard, { type CardFlowNode } from "../GraphNode";
import { groupByDay, type DayBucket } from "../data/scopes";
import { useGraphStore } from "../store";

const nodeTypes = { card: GraphCard } satisfies NodeTypes;
const COL_W = 240;

function TimelineInner() {
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const select = useGraphStore((s) => s.select);
  const patchNode = useGraphStore((s) => s.patchNode);

  const buckets = useMemo<DayBucket[]>(
    () => groupByDay(Object.values(nodes).filter((n) => n.type === "scene")),
    [nodes],
  );

  /** Drop-x decides the column; the column decides the new storyDay. */
  const onNodeDragStop = useCallback(
    (_: unknown, n: { id: string; position: { x: number } }) => {
      if (n.id.startsWith("day-")) return;
      const col = Math.min(buckets.length - 1, Math.max(0, Math.round(n.position.x / COL_W)));
      const target = buckets[col];
      if (!target) return;
      const cur = useGraphStore.getState().nodes[n.id];
      if (!cur || cur.type !== "scene") return;
      const st = cur.storyTime ?? { storyDay: null, tod: null, eraLabel: null };
      if (st.storyDay === target.day) return;
      patchNode(cur.id, { storyTime: { ...st, storyDay: target.day } });
    },
    [buckets, patchNode],
  );

  const rfNodes = useMemo<CardFlowNode[]>(() => {
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
  }, [buckets]);

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
            stroke: e.type === "flashback_of" ? "#e8912d" : "#7c8aa8",
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
        onNodeDragStop={onNodeDragStop}
        nodesDraggable
      >
        <Background color="#dfe4f4" gap={18} />
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
