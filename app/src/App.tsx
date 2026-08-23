import { Background, Controls, ReactFlow } from "@xyflow/react";
import type { Edge, NodeTypes } from "@xyflow/react";
import { useEffect, useMemo, useState } from "react";
import GraphCard, { type CardFlowNode } from "./GraphNode";
import { useGraphStore } from "./store";
import type { GraphNode } from "./types";

const nodeTypes = { card: GraphCard } satisfies NodeTypes;

/** Storyline band layout (locked Map direction): episode columns + flashback lane. */
function layout(nodes: GraphNode[], orderFor: (id: string) => string[]): CardFlowNode[] {
  const out: CardFlowNode[] = [];

  const scenesOf = new Map<string, GraphNode[]>();
  for (const n of nodes) {
    if (n.type !== "scene" || !n.parentId) continue;
    const arr = scenesOf.get(n.parentId) ?? [];
    arr.push(n);
    scenesOf.set(n.parentId, arr);
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
    const ordered = orderFor(ep.id)
      .map((id) => scenesOf.get(ep.id)?.find((s) => s.id === id))
      .filter((s): s is GraphNode => Boolean(s));
    for (const [si, sc] of ordered.entries()) {
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

const SAVE_LABEL: Record<string, string> = {
  booting: "Loading…",
  saved: "Saved ✓",
  saving: "Saving…",
  dirty: "Unsaved edits",
  error: "Save failed — retry with Ctrl+S",
};

export default function App() {
  const nodeMap = useGraphStore((s) => s.nodes);
  const edgeMap = useGraphStore((s) => s.edges);
  const status = useGraphStore((s) => s.status);
  const canUndo = useGraphStore((s) => s.canUndo);
  const canRedo = useGraphStore((s) => s.canRedo);
  const undo = useGraphStore((s) => s.undo);
  const redo = useGraphStore((s) => s.redo);
  const del = useGraphStore((s) => s.deleteSelection);
  const select = useGraphStore((s) => s.select);
  const forceSave = useGraphStore((s) => s.forceSave);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    void useGraphStore.getState().boot();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void forceSave();
      } else if (mod && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
      } else if (
        (mod && e.shiftKey && e.key.toLowerCase() === "z") ||
        (mod && e.key.toLowerCase() === "y")
      ) {
        e.preventDefault();
        redo();
      } else if (e.key === "Delete") {
        del();
      } else if (e.key === "Escape") {
        setSelectedIds([]);
      }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [undo, redo, del, forceSave]);

  const graphNodes = useMemo(() => Object.values(nodeMap), [nodeMap]);
  const graphEdges = useMemo(() => Object.values(edgeMap), [edgeMap]);
  const orderFor = useMemo(() => (id: string) => nodeMap[id]?.order ?? [], [nodeMap]);

  const rfNodes = useMemo(
    () =>
      layout(graphNodes, orderFor).map((n) =>
        selectedIds.includes(n.id) ? { ...n, selected: true } : n,
      ),
    [graphNodes, orderFor, selectedIds],
  );

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
          HIGH WATER · {graphNodes.length} nodes / {graphEdges.length} edges
        </span>
        <span className={`tln-save tln-save--${status}`}>
          {status === "error"
            ? `Error: ${useGraphStore.getState().bootError ?? "unknown"}`
            : SAVE_LABEL[status]}
        </span>
        <button className="tln-btn" onClick={undo} disabled={!canUndo} title="Ctrl+Z">
          ↶
        </button>
        <button className="tln-btn" onClick={redo} disabled={!canRedo} title="Ctrl+Shift+Z">
          ↷
        </button>
      </header>
      <div className="tln-flow">
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.2}
          proOptions={{ hideAttribution: true }}
          onSelectionChange={(p) => {
            const ids = [...p.nodes.map((n) => n.id), ...p.edges.map((e) => e.id)];
            // Keep referential stability so this can't loop back into node props.
            setSelectedIds((prev) =>
              prev.length === ids.length && prev.every((v) => ids.includes(v)) ? prev : ids,
            );
            const s = useGraphStore.getState();
            if (s.selection.length !== ids.length || !s.selection.every((v) => ids.includes(v))) {
              select(ids);
            }
          }}
        >
          <Background color="#e4ddd0" gap={18} />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}
