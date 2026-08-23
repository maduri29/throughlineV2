// Script lens (T6 contract): split textarea + live preview, draggable 15–85%
// divider, collapsible preview, graph-owned locked slug, full-template
// skeletons with bracketed hints, whole-project .fountain export.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FountainEditor from "../editor/FountainEditor";
import { useGraphStore } from "../store";
import {
  downloadFountain,
  locationTitleFor,
  parseFountain,
  renderPreview,
  scriptSequence,
  skeletonBody,
  slugFor,
} from "../data/fountain";

const MIN_PCT = 15;
const MAX_PCT = 85;

export default function ScriptView() {
  const nodeMap = useGraphStore((s) => s.nodes);
  const edgeMap = useGraphStore((s) => s.edges);
  const projectId = useGraphStore((s) => s.projectId);

  const [sceneId, setSceneId] = useState<string | null>(null);
  const [buffers, setBuffers] = useState<Record<string, string>>({});
  const [splitPct, setSplitPct] = useState(50);
  const [collapsed, setCollapsed] = useState(false);

  const buffersRef = useRef(buffers);
  useEffect(() => {
    buffersRef.current = buffers;
  }, [buffers]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const project = projectId ? nodeMap[projectId] : undefined;
  const sequence = useMemo(
    () => (project ? scriptSequence(project, nodeMap, edgeMap) : []),
    [project, nodeMap, edgeMap],
  );

  // Derived initial pick — no setState-in-effect cascade.
  const effectiveSceneId = sceneId ?? sequence[0]?.scene.id ?? null;

  const patchNode = useCallback(
    (id: string, text: string) => useGraphStore.getState().patchNode(id, { fountain: text }),
    [],
  );

  /** One undo-entry per typing pause (ADR-0003 coalescing). */
  const flushScene = useCallback(
    (id: string) => {
      const t = timers.current.get(id);
      if (t) {
        clearTimeout(t);
        timers.current.delete(id);
      }
      const buf = buffersRef.current[id];
      if (buf === undefined) return;
      const cur = useGraphStore.getState().nodes[id];
      if (cur && cur.fountain !== buf) patchNode(id, buf);
      setBuffers((b) => {
        if (!(id in b)) return b;
        const next = { ...b };
        delete next[id];
        return next;
      });
    },
    [patchNode],
  );

  const scheduleScene = useCallback(
    (id: string, text: string) => {
      setBuffers((b) => ({ ...b, [id]: text }));
      const prev = timers.current.get(id);
      if (prev) clearTimeout(prev);
      timers.current.set(
        id,
        setTimeout(() => {
          timers.current.delete(id);
          const latest = buffersRef.current[id];
          const cur = useGraphStore.getState().nodes[id];
          if (latest !== undefined && cur && cur.fountain !== latest) patchNode(id, latest);
          setBuffers((b) => {
            if (!(id in b)) return b;
            const next = { ...b };
            delete next[id];
            return next;
          });
        }, 600),
      );
    },
    [patchNode],
  );

  // Flush pending edits when switching scenes or unmounting (ref-stable).
  const flushRef = useRef(flushScene);
  useEffect(() => {
    flushRef.current = flushScene;
  }, [flushScene]);
  useEffect(() => {
    return () => {
      if (sceneId) flushRef.current(sceneId);
    };
  }, [sceneId]);
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const [id, t] of pending) {
        clearTimeout(t);
        const buf = buffersRef.current[id];
        const cur = useGraphStore.getState().nodes[id];
        if (buf !== undefined && cur && cur.fountain !== buf)
          useGraphStore.getState().patchNode(id, { fountain: buf });
      }
      pending.clear();
    };
  }, []);

  /* Divider drag clamped to 15–85%. */
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const onDividerDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const move = (ev: MouseEvent): void => {
      const rect = wrapRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) return;
      const pct = ((ev.clientX - rect.left) / rect.width) * 100;
      setSplitPct(Math.min(MAX_PCT, Math.max(MIN_PCT, pct)));
    };
    const up = (): void => {
      removeEventListener("mousemove", move);
      removeEventListener("mouseup", up);
    };
    addEventListener("mousemove", move);
    addEventListener("mouseup", up);
  }, []);

  const scene = effectiveSceneId ? nodeMap[effectiveSceneId] : undefined;
  const storedText = scene?.fountain?.trim() ? (scene.fountain ?? "") : "";
  const text =
    (effectiveSceneId ? buffers[effectiveSceneId] : undefined) ??
    (scene ? storedText || skeletonBody(scene) : "");
  const slug = scene ? slugFor(scene, locationTitleFor(scene.id, nodeMap, edgeMap)) : "";
  const previewHtml = useMemo(() => renderPreview(parseFountain(text).els), [text]);

  if (!project) return <div className="tln-script">Loading…</div>;

  return (
    <div className="tln-script">
      <aside className="tln-script__rail">
        <div className="tln-script__railhead">SCRIPT ORDER</div>
        {sequence.map(({ container, scene: sc }) => (
          <button
            key={sc.id}
            className={`tln-script__item${sc.id === effectiveSceneId ? " tln-script__item--on" : ""}`}
            onClick={() => setSceneId(sc.id)}
            title={slugFor(sc, locationTitleFor(sc.id, nodeMap, edgeMap))}
          >
            <span className="tln-script__ep">{container ? container.title : "—"}</span>
            <span className="tln-script__ttl">
              {(sc.storyTime?.storyDay ?? 0) < 0 ? "⟲ " : ""}
              {sc.title}
            </span>
          </button>
        ))}
      </aside>

      <div className="tln-script__main" ref={wrapRef}>
        <div
          className="tln-script__edit"
          style={{ flexBasis: collapsed ? "100%" : `${splitPct}%` }}
        >
          <div className="tln-script__toolbar">
            <div className="tln-slug" title="Graph-owned — edit in Inspector">
              {slug}
            </div>
            <button
              className="tln-btn"
              onClick={() => void downloadFountain(project, nodeMap, edgeMap)}
            >
              Export .fountain
            </button>
          </div>
          {scene ? (
            <FountainEditor
              className="tln-script__ta"
              value={text}
              onChange={(v) => scheduleScene(scene.id, v)}
              onBlur={() => flushScene(scene.id)}
            />
          ) : (
            <div className="tln-script__empty">Select a scene on the left.</div>
          )}
        </div>

        {!collapsed ? (
          <>
            <div className="tln-script__divider" onMouseDown={onDividerDown} />
            <div
              className="tln-script__preview"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </>
        ) : null}

        <button
          className="tln-script__collapse"
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? "Show preview" : "Hide preview"}
        >
          {collapsed ? "◀" : "▶"}
        </button>
      </div>
    </div>
  );
}
