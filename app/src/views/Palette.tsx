// Command palette (Ctrl+K): keyboard-first jump-to-anything across the
// current story — scenes, characters, locations, themes, seeds, episodes —
// plus direct story switching. Substring match over title/synopsis/type,
// title-prefix matches ranked first; ↑/↓ + Enter, Esc or backdrop to close.
import { useEffect, useMemo, useRef, useState } from "react";
import { useGraphStore } from "../store";
import type { GraphNode } from "../types";

type Item = {
  id: string;
  kind: "node" | "story";
  node: GraphNode | null;
  label: string;
  sub: string;
};

const MAX_ITEMS = 12;

export default function Palette({
  open,
  onClose,
  onJump,
}: {
  open: boolean;
  onClose: () => void;
  /** A node was chosen: focus it in the right lens. */
  onJump: (id: string, type: string) => void;
}) {
  const nodes = useGraphStore((s) => s.nodes);
  const projects = useGraphStore((s) => s.projects);
  const projectId = useGraphStore((s) => s.projectId);
  const select = useGraphStore((s) => s.select);

  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Fresh palette state every time it opens.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setQuery("");
      setActive(0);
    }
  }

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const items = useMemo<Item[]>(() => {
    if (!open) return [];
    const q = query.trim().toLowerCase();
    const out: Item[] = [];
    const graphNodes = Object.values(nodes);
    const matchNode = (n: GraphNode): boolean =>
      q === "" ||
      n.title.toLowerCase().includes(q) ||
      (n.synopsis ?? "").toLowerCase().includes(q) ||
      n.type.includes(q);
    const ranked: Array<{ n: GraphNode; score: number }> = [];
    for (const n of graphNodes) {
      if (!matchNode(n)) continue;
      const score = q !== "" && n.title.toLowerCase().startsWith(q) ? 0 : 1;
      ranked.push({ n, score });
    }
    ranked.sort((a, b) => a.score - b.score || a.n.title.localeCompare(b.n.title));
    for (const { n } of ranked.slice(0, MAX_ITEMS)) {
      out.push({
        id: n.id,
        kind: "node",
        node: n,
        label: n.title,
        sub: n.type + (n.synopsis ? ` — ${n.synopsis}` : ""),
      });
    }
    // Story switching stays available even mid-query.
    for (const p of projects) {
      if (p.id === projectId) continue;
      if (q === "" || p.title.toLowerCase().includes(q)) {
        out.push({ id: p.id, kind: "story", node: p, label: p.title, sub: "switch story" });
      }
    }
    return out.slice(0, MAX_ITEMS + 4);
  }, [open, query, nodes, projects, projectId]);

  if (!open) return null;

  const choose = (it: Item | undefined): void => {
    if (!it) return;
    onClose();
    if (it.kind === "story") {
      void useGraphStore.getState().switchProject(it.id);
      return;
    }
    select([it.id]);
    onJump(it.id, it.node?.type ?? "scene");
  };

  // Clamp defensively at use-sites; index resets live in onChange/open-reset.
  const safeActive = items.length === 0 ? 0 : Math.min(active, items.length - 1);
  const activeItem = (items[safeActive] ?? undefined) as Item | undefined;

  return (
    <>
      <div className="tln-palette-backdrop" onClick={onClose} />
      <div className="tln-palette" role="dialog" aria-label="Command palette">
        <input
          ref={inputRef}
          className="tln-palette__input"
          placeholder="Jump to scene, character, theme…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => (items.length === 0 ? 0 : (a + 1) % items.length));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => (items.length === 0 ? 0 : (a - 1 + items.length) % items.length));
            } else if (e.key === "Enter") {
              e.preventDefault();
              choose(activeItem);
            } else if (e.key === "Escape") {
              e.preventDefault();
              onClose();
            }
          }}
        />
        <div className="tln-palette__list" ref={listRef}>
          {items.map((it, i) => (
            <button
              key={`${it.kind}-${it.id}`}
              className={`tln-palette__item${i === safeActive ? " tln-palette__item--on" : ""}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(it)}
            >
              <span className="tln-palette__label">
                {it.kind === "story" ? "⌂ " : ""}
                {it.label}
              </span>
              <span className="tln-palette__sub">{it.sub}</span>
            </button>
          ))}
          {items.length === 0 ? <div className="tln-palette__empty">No matches</div> : null}
        </div>
        <div className="tln-palette__hint">↑↓ navigate · Enter jump · Esc close</div>
      </div>
    </>
  );
}
