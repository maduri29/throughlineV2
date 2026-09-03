// Inspector dock (T5 §1): Enter focuses it; edits commit on blur via patchNode
// so each field blur is one undo entry (ADR-0003).
import { useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { CHAR_ROLE_SUGGESTIONS, TODS } from "../types";
import type { GraphNode, Tod } from "../types";
import { useGraphStore } from "../store";

export default function Inspector() {
  const { nodeId, node, edges, nodes, patchNode, deleteEdge } = useGraphStore(
    useShallow((s) => {
      const id = s.selection.find((selId) => Boolean(s.nodes[selId])) ?? null;
      return {
        nodeId: id,
        node: id ? s.nodes[id] : undefined,
        edges: s.edges,
        nodes: s.nodes,
        patchNode: s.patchNode,
        deleteEdge: s.deleteEdge,
      };
    }),
  );

  const [draft, setDraft] = useState<Partial<GraphNode>>({});
  const titleRef = useRef<HTMLInputElement | null>(null);

  // Reset stale edits when the inspected node changes — React's
  // derive-during-render pattern (no effect cascade).
  const [prevNodeId, setPrevNodeId] = useState(nodeId);
  if (prevNodeId !== nodeId) {
    setPrevNodeId(nodeId);
    setDraft({});
  }

  /* T5 keyboard contract: Enter jumps into the Inspector's title field. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const t = e.target as HTMLElement | null;
      if (e.key !== "Enter" || !node) return;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      e.preventDefault();
      titleRef.current?.focus();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [node]);

  if (!node || !nodeId) {
    return (
      <aside className="tln-inspector tln-inspector--empty">
        <div className="tln-inspector__hint">Select a card to inspect it</div>
      </aside>
    );
  }

  const val = <K extends keyof GraphNode>(k: K): GraphNode[K] =>
    k in draft ? (draft[k] as GraphNode[K]) : node[k];

  const edit = (patch: Partial<GraphNode>): void => setDraft((d) => ({ ...d, ...patch }));
  const save = (): void => {
    if (Object.keys(draft).length > 0) patchNode(nodeId, draft);
    setDraft({});
  };

  const st = val("storyTime") ?? { storyDay: null, tod: null, eraLabel: null };
  const touching = Object.values(edges).filter((e) => e.from === nodeId || e.to === nodeId);

  return (
    <aside className="tln-inspector">
      <div className="tln-inspector__type">{node.type}</div>
      <input
        ref={titleRef}
        id="tln-inspector-title"
        className="tln-inspector__title"
        value={val("title") ?? ""}
        onChange={(e) => edit({ title: e.target.value })}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
      <label className="tln-inspector__field">
        Synopsis
        <textarea
          value={val("synopsis") ?? ""}
          rows={3}
          onChange={(e) => edit({ synopsis: e.target.value })}
          onBlur={save}
        />
      </label>

      {node.type === "scene" ? (
        <>
          <div className="tln-inspector__row3">
            <label className="tln-inspector__field">
              INT/EXT
              <select
                value={val("intExt") ?? ""}
                onChange={(e) => {
                  edit({ intExt: (e.target.value || undefined) as GraphNode["intExt"] });
                  setTimeout(save, 0);
                }}
              >
                <option value="">INT.</option>
                <option value="INT.">INT.</option>
                <option value="EXT.">EXT.</option>
                <option value="EST.">EST.</option>
                <option value="INT./EXT.">I/E</option>
              </select>
            </label>
            <label className="tln-inspector__field">
              Day
              <input
                type="number"
                value={st.storyDay ?? ""}
                onChange={(e) =>
                  edit({
                    storyTime: {
                      ...st,
                      storyDay: e.target.value === "" ? null : Number(e.target.value),
                    },
                  })
                }
                onBlur={save}
              />
            </label>
            <label className="tln-inspector__field">
              Time
              <select
                value={st.tod ?? ""}
                onChange={(e) => {
                  edit({ storyTime: { ...st, tod: (e.target.value || null) as Tod | null } });
                  setTimeout(save, 0);
                }}
              >
                <option value="">—</option>
                {TODS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </>
      ) : null}

      {node.type === "project" ? (
        <>
          <label className="tln-inspector__field">
            Author
            <input
              value={val("author") ?? ""}
              onChange={(e) => edit({ author: e.target.value })}
              onBlur={save}
            />
          </label>
          <label className="tln-inspector__field">
            Contact
            <textarea
              value={val("contact") ?? ""}
              rows={2}
              onChange={(e) => edit({ contact: e.target.value })}
              onBlur={save}
            />
          </label>
        </>
      ) : null}

      {node.type === "character" ? (
        <>
          <label className="tln-inspector__field">
            Role
            <input
              list="tln-role-suggestions"
              placeholder="Protagonist…"
              value={val("role") ?? ""}
              onChange={(e) => edit({ role: e.target.value })}
              onBlur={save}
            />
          </label>
          <label className="tln-inspector__field">
            Backstory
            <textarea
              value={val("backstory") ?? ""}
              rows={4}
              onChange={(e) => edit({ backstory: e.target.value })}
              onBlur={save}
            />
          </label>
          <datalist id="tln-role-suggestions">
            {CHAR_ROLE_SUGGESTIONS.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </>
      ) : null}

      <div className="tln-inspector__field">
        Connections ({touching.length})
        <div className="tln-inspector__edges">
          {touching.map((e) => {
            const otherId = e.from === nodeId ? e.to : e.from;
            const arrow = e.from === nodeId ? "→" : "←";
            return (
              <div key={e.id} className="tln-inspector__edge">
                <span className="tln-inspector__etype">
                  {arrow} {e.type}
                </span>
                <span className="tln-inspector__eother">{nodes[otherId]?.title ?? "?"}</span>
                <button
                  className="tln-inspector__edel"
                  title="Remove connection"
                  onClick={() => deleteEdge(e.id)}
                >
                  ✕
                </button>
              </div>
            );
          })}
          {touching.length === 0 ? <span className="tln-inspector__none">None yet</span> : null}
        </div>
      </div>
    </aside>
  );
}
