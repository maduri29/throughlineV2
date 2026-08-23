// The Map lens per the T5 canvas contract: Beat×Storyline bands, filter chips,
// drag-connect legality picker, context-aware double-click add, instant delete
// with undo toast, marquee + shift-click multi-select, RF-default pan/zoom.
import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  useReactFlow,
} from "@xyflow/react";
import type { Edge, NodeTypes, OnConnectEnd } from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import GraphCard, { type CardFlowNode } from "../GraphNode";
import { metaGet, metaSet } from "../data/idb";
import { legalEdgeTypes } from "../data/ops";
import { useGraphStore } from "../store";
import type { EdgeType, GraphNode } from "../types";

const nodeTypes = { card: GraphCard } satisfies NodeTypes;

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

const CHIPS = ["scene", "character", "location", "theme", "flashback"] as const;
type Chip = (typeof CHIPS)[number];
type Filters = Record<Chip, boolean>;

const ALL_ON: Filters = {
  scene: true,
  character: true,
  location: true,
  theme: true,
  flashback: true,
};

const COL_W = 300;
const LANE_Y_MAX = 40;
const BAND_TOP = 40;

/** Which filter chip governs a node's visibility; null = always visible. */
function chipOf(n: GraphNode): Chip | null {
  if (n.type === "scene") return (n.storyTime?.storyDay ?? 0) < 0 ? "flashback" : "scene";
  if (n.type === "character" || n.type === "location" || n.type === "theme") return n.type;
  return null; // project/episode/seed always visible
}

function episodes(nodes: GraphNode[]): GraphNode[] {
  return nodes.filter((n) => n.type === "episode");
}

function layout(nodes: GraphNode[], orderFor: (id: string) => string[]): CardFlowNode[] {
  const out: CardFlowNode[] = [];
  const scenesOf = new Map<string, GraphNode[]>();
  for (const n of nodes) {
    if (n.type !== "scene" || !n.parentId) continue;
    const arr = scenesOf.get(n.parentId) ?? [];
    arr.push(n);
    scenesOf.set(n.parentId, arr);
  }

  episodes(nodes).forEach((ep, ei) => {
    out.push({
      id: ep.id,
      type: "card",
      position: { x: ei * COL_W, y: BAND_TOP },
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
        position: { x: ei * COL_W, y: 100 + si * 120 },
        data: {
          kind: day !== null && day < 0 ? "flashback" : "scene",
          title: sc.title,
          badge: day === null ? "unscheduled" : `D${day} · ${sc.storyTime?.tod ?? ""}`.trim(),
          synopsis: sc.synopsis,
        },
      });
    }
  });

  // Flashback lane on top.
  const lane = nodes.filter((n) => n.type === "scene" && (n.storyTime?.storyDay ?? 0) < 0);
  for (const [fi, fb] of lane.entries()) {
    out.push({
      id: fb.id,
      type: "card",
      position: { x: 60 + fi * COL_W, y: -80 },
      data: {
        kind: "flashback",
        title: fb.title,
        badge: `D${fb.storyTime?.storyDay}`,
        synopsis: fb.synopsis,
      },
    });
  }

  const rail = new Set(["character", "location", "theme", "project", "seed"]);
  for (const [oi, o] of nodes.filter((n) => rail.has(n.type)).entries()) {
    out.push({
      id: o.id,
      type: "card",
      position: { x: -280, y: 20 + oi * 56 },
      data: { kind: "pill", title: o.title },
      draggable: false,
    });
  }
  return out;
}

type Pending = { source: string; target: string; x: number; y: number };
type Toast = { key: number; label: string };

export default function MapView() {
  return (
    <ReactFlowProvider>
      <MapInner />
    </ReactFlowProvider>
  );
}

function MapInner() {
  const nodeMap = useGraphStore((s) => s.nodes);
  const edgeMap = useGraphStore((s) => s.edges);
  const projectId = useGraphStore((s) => s.projectId);
  const addScene = useGraphStore((s) => s.addScene);
  const connect = useGraphStore((s) => s.connect);
  const deleteSelection = useGraphStore((s) => s.deleteSelection);
  const select = useGraphStore((s) => s.select);
  const undo = useGraphStore((s) => s.undo);
  const screenToFlow = useReactFlow().screenToFlowPosition;

  const [filters, setFilters] = useState<Filters>(ALL_ON);
  const [pending, setPending] = useState<Pending | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastSeq = useRef(1);

  /* Filter chips persist locally per project (T5 §6). */
  useEffect(() => {
    if (!projectId) return;
    let alive = true;
    void metaGet<string>(`filters.${projectId}`).then((raw) => {
      if (!alive || !raw) return;
      try {
        setFilters({ ...ALL_ON, ...(JSON.parse(raw) as Partial<Filters>) });
      } catch {
        /* keep defaults on corrupt state */
      }
    });
    return () => {
      alive = false;
    };
  }, [projectId]);
  useEffect(() => {
    if (!projectId) return;
    void metaSet(`filters.${projectId}`, JSON.stringify(filters));
  }, [filters, projectId]);

  const graphNodes = useMemo(() => Object.values(nodeMap), [nodeMap]);
  const orderFor = useMemo(() => (id: string) => nodeMap[id]?.order ?? [], [nodeMap]);
  const visibleNodes = useMemo(
    () => graphNodes.filter((n) => chipOf(n) === null || filters[chipOf(n) as Chip]),
    [graphNodes, filters],
  );
  const visibleIds = useMemo(() => new Set(visibleNodes.map((n) => n.id)), [visibleNodes]);

  const rfNodes = useMemo(() => layout(visibleNodes, orderFor), [visibleNodes, orderFor]);
  const rfEdges = useMemo<Edge[]>(
    () =>
      Object.values(edgeMap)
        .filter((e) => visibleIds.has(e.from) && visibleIds.has(e.to))
        .map((e) => ({
          id: e.id,
          source: e.from,
          target: e.to,
          label: e.label,
          style: {
            stroke: EDGE_STROKE[e.type] ?? "#999999",
            strokeWidth: 1.5,
            ...(e.type === "flashback_of" || e.type === "sets_up"
              ? { strokeDasharray: "5 4" }
              : {}),
          },
        })),
    [edgeMap, visibleIds],
  );

  const pushToast = useCallback((label: string) => {
    const key = toastSeq.current++;
    setToasts((t) => [...t, { key, label }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.key !== key)), 5000);
  }, []);

  /* Delete: instant removal + 5 s undo toast (T5 §5). */
  const deleteWithToast = useCallback(() => {
    const ids = useGraphStore.getState().selection.filter((id) => Boolean(nodeMap[id]));
    if (ids.length === 0) return;
    deleteSelection();
    pushToast(ids.length > 1 ? `${ids.length} nodes deleted` : "Deleted");
  }, [deleteSelection, pushToast, nodeMap]);

  /* Keyboard: Delete / Esc / Tab-cycle across visible cards (T5 §1). */
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === "Delete") {
        e.preventDefault();
        deleteWithToast();
      } else if (e.key === "Escape") {
        setPending(null);
        select([]);
      } else if (e.key === "Tab") {
        e.preventDefault();
        const ids = rfNodes.filter((n) => n.selectable !== false).map((n) => n.id);
        if (ids.length === 0) return;
        const cur = useGraphStore.getState().selection;
        const idx = cur.length > 0 ? ids.indexOf(cur[cur.length - 1] ?? "") : -1;
        const next = e.shiftKey
          ? ids[(idx - 1 + ids.length) % ids.length]
          : ids[(idx + 1) % ids.length];
        if (next) select([next]);
      }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [rfNodes, deleteWithToast, select]);

  /* Context-aware double-click add (T5 §7). */
  const onDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest(".tln-card")) return;
      const p = screenToFlow({ x: e.clientX, y: e.clientY });
      const s = useGraphStore.getState();
      if (p.y < LANE_Y_MAX) {
        const project = s.projectId ? s.nodes[s.projectId] : undefined;
        if (project) addScene(project.id, { flashback: true });
        return;
      }
      const eps = episodes(graphNodes);
      const col = Math.min(eps.length - 1, Math.max(0, Math.round(p.x / COL_W)));
      const ep = eps[col];
      if (ep && p.y >= BAND_TOP) addScene(ep.id);
    },
    [screenToFlow, graphNodes, addScene],
  );

  /* Drag-connect opens the legality picker (T5 §4); Esc or backdrop cancels. */
  const onConnectEnd: OnConnectEnd = useCallback((event, state) => {
    const from = state.fromNode?.id;
    const to = state.targetNode?.id;
    if (!from || !to || from === to) return;
    const ev = "clientX" in event ? event : event.changedTouches[0];
    if (!ev) return;
    setPending({ source: from, target: to, x: ev.clientX, y: ev.clientY });
  }, []);

  const pendingTypes: EdgeType[] = useMemo(() => {
    if (!pending) return [];
    const a = nodeMap[pending.source];
    const b = nodeMap[pending.target];
    return a && b ? legalEdgeTypes(a.type, b.type) : [];
  }, [pending, nodeMap]);

  const pickType = useCallback(
    (t: EdgeType) => {
      if (pending) connect(pending.source, pending.target, t);
      setPending(null);
    },
    [pending, connect],
  );

  return (
    <div className="tln-map" onDoubleClick={onDoubleClick}>
      <div className="tln-chips">
        {CHIPS.map((c) => (
          <button
            key={c}
            className={`tln-chip${filters[c] ? "" : " tln-chip--off"}`}
            onClick={() => setFilters((f) => ({ ...f, [c]: !f[c] }))}
          >
            {c.charAt(0).toUpperCase() + c.slice(1)}
          </button>
        ))}
      </div>
      <div className="tln-flow">
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.25}
          maxZoom={2.5}
          selectionOnDrag
          panOnDrag={[1, 2]}
          selectionMode={SelectionMode.Partial}
          proOptions={{ hideAttribution: true }}
          onSelectionChange={(p) => {
            const ids = [...p.nodes.map((n) => n.id), ...p.edges.map((e) => e.id)];
            const s = useGraphStore.getState();
            if (s.selection.length !== ids.length || !s.selection.every((v) => ids.includes(v))) {
              select(ids);
            }
          }}
          onPaneClick={() => select([])}
          onConnectEnd={onConnectEnd}
        >
          <Background color="#e4ddd0" gap={18} />
          <Controls />
        </ReactFlow>
      </div>

      {pending ? (
        <>
          <div className="tln-picker-backdrop" onClick={() => setPending(null)} />
          <div className="tln-picker" style={{ left: pending.x, top: pending.y }}>
            <div className="tln-picker__title">Connection type</div>
            {pendingTypes.length === 0 ? (
              <div className="tln-picker__none">No legal connection for this pair</div>
            ) : (
              pendingTypes.map((t) => (
                <button key={t} className="tln-picker__opt" onClick={() => pickType(t)}>
                  {t}
                </button>
              ))
            )}
            <div className="tln-picker__hint">Esc to cancel</div>
          </div>
        </>
      ) : null}

      <div className="tln-toast-wrap">
        {toasts.map((t) => (
          <div key={t.key} className="tln-toast">
            <span>{t.label}</span>
            <button
              onClick={() => {
                undo();
                setToasts((all) => all.filter((x) => x.key !== t.key));
              }}
            >
              Undo
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
