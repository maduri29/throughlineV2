import { useCallback, useRef, useState } from "react";

const MIN_PCT = 15;
const MAX_PCT = 85;

/**
 * Manages split pane resizing and collapsing for the Script view.
 */
export function useSplitPane(initialPct = 50) {
  const [splitPct, setSplitPct] = useState(initialPct);
  const [collapsed, setCollapsed] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  /* Divider drag clamped to 15–85%. */
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

  return {
    splitPct,
    collapsed,
    setCollapsed,
    wrapRef,
    onDividerDown,
  };
}
