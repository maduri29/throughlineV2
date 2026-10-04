import { useCallback, useEffect, useRef, useState } from "react";
import { useGraphStore } from "../../store";

/**
 * Manages text buffers and debounced autosaves for the Fountain script editor.
 * Implements ADR-0003 coalescing: 1 undo entry per typing pause.
 */
export function useScriptBuffers(sceneId: string | null) {
  const [buffers, setBuffers] = useState<Record<string, string>>({});
  const buffersRef = useRef(buffers);
  useEffect(() => {
    buffersRef.current = buffers;
  }, [buffers]);

  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

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
      buffersRef.current = { ...buffersRef.current, [id]: text };
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

  useEffect(() => {
    const flush = () => {
      for (const id of Object.keys(buffersRef.current)) flushScene(id);
    };
    window.addEventListener("throughline:flush-script", flush);
    return () => window.removeEventListener("throughline:flush-script", flush);
  }, [flushScene]);

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

  return {
    buffers,
    scheduleScene,
    flushScene,
  };
}
