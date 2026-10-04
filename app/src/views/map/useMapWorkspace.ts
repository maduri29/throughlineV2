import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Edge, EdgeChange, NodeChange, OnConnectEnd } from "@xyflow/react";
import { useReactFlow } from "@xyflow/react";
import { metaGet, metaSet } from "../../data/idb";
import { legalEdgeTypes } from "../../data/ops";
import { useGraphStore } from "../../store";
import type { EdgeType } from "../../types";
import {
  ALL_ON,
  BAND_TOP,
  COL_W,
  EDGE_STROKE,
  EMPTY_ORDER,
  LANE_Y_MAX,
  chipOf,
  episodes,
  layout,
  type Chip,
  type Filters,
  type PendingConnect,
  type ToastItem,
} from "./mapLayout";

export function useMapWorkspace() {
  const nodeMap = useGraphStore((s) => s.nodes);
  const edgeMap = useGraphStore((s) => s.edges);
  const projectId = useGraphStore((s) => s.projectId);
  const addScene = useGraphStore((s) => s.addScene);
  const addNodeOfType = useGraphStore((s) => s.addNodeOfType);
  const connect = useGraphStore((s) => s.connect);
  const deleteSelection = useGraphStore((s) => s.deleteSelection);
  const select = useGraphStore((s) => s.select);
  const selection = useGraphStore((s) => s.selection);
  const undo = useGraphStore((s) => s.undo);
  const screenToFlow = useReactFlow().screenToFlowPosition;

  const [filters, setFilters] = useState<Filters>(ALL_ON);
  const [pending, setPending] = useState<PendingConnect | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
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

  const toggleFilter = useCallback((chip: Chip) => {
    setFilters((f) => ({ ...f, [chip]: !f[chip] }));
  }, []);

  const graphNodes = useMemo(() => Object.values(nodeMap), [nodeMap]);
  const orderFor = useMemo(() => (id: string) => nodeMap[id]?.order ?? EMPTY_ORDER, [nodeMap]);
  const visibleNodes = useMemo(
    () => graphNodes.filter((n) => chipOf(n) === null || filters[chipOf(n) as Chip]),
    [graphNodes, filters],
  );
  const visibleIds = useMemo(() => new Set(visibleNodes.map((n) => n.id)), [visibleNodes]);

  const baseNodes = useMemo(() => layout(visibleNodes, orderFor), [visibleNodes, orderFor]);
  const selectionSet = useMemo(() => new Set(selection), [selection]);

  const rfNodes = useMemo(
    () =>
      baseNodes.map((node) => ({
        ...node,
        selected: selectionSet.has(node.id),
      })),
    [baseNodes, selectionSet],
  );

  const rfEdges = useMemo<Edge[]>(() => {
    const edgeList = Object.values(edgeMap);
    const result: Edge[] = [];
    for (let i = 0; i < edgeList.length; i++) {
      const e = edgeList[i];
      if (!e || !visibleIds.has(e.from) || !visibleIds.has(e.to)) continue;
      result.push({
        id: e.id,
        source: e.from,
        target: e.to,
        selected: selectionSet.has(e.id),
        label: e.label,
        style: {
          stroke: EDGE_STROKE[e.type] ?? "#9aa3ba",
          strokeWidth: 1.5,
          ...(e.type === "flashback_of" || e.type === "sets_up" ? { strokeDasharray: "5 4" } : {}),
        },
      });
    }
    return result;
  }, [edgeMap, visibleIds, selectionSet]);

  const onSelectionChanges = useCallback(
    (changes: (NodeChange | EdgeChange)[]) => {
      const selectionChanges = changes.filter((change) => change.type === "select");
      if (!selectionChanges.length) return;
      const current = useGraphStore.getState().selection;
      const next = new Set(current);
      for (const change of selectionChanges) {
        if (change.selected) next.add(change.id);
        else next.delete(change.id);
      }
      if (current.length !== next.size || !current.every((id) => next.has(id))) select([...next]);
    },
    [select],
  );

  const pushToast = useCallback((label: string) => {
    const key = toastSeq.current++;
    setToasts((t) => [...t, { key, label }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.key !== key)), 5000);
  }, []);

  const handleUndo = useCallback(
    (key: number) => {
      undo();
      setToasts((all) => all.filter((x) => x.key !== key));
    },
    [undo],
  );

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
      if ((e.target as HTMLElement).closest(".tln-addmenu")) return;
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
    const to = state.toNode?.id;
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

  return {
    filters,
    toggleFilter,
    addNodeOfType,
    rfNodes,
    rfEdges,
    pending,
    pendingTypes,
    toasts,
    onSelectionChanges,
    onPaneClick: () => select([]),
    onConnectEnd,
    onDoubleClick,
    pickType,
    cancelPending: () => setPending(null),
    handleUndo,
  };
}
