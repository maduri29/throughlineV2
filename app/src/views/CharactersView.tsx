// Characters lens: roster cards over derived graph data — scenes in narrative
// order with first/last appearance, labeled relation chips, embodied themes,
// and locations reached through the scenes' takes_place_at. A card expands
// into an inline editor (name/role/synopsis/backstory) committing on blur via
// patchNode so each blur is one undo entry (ADR-0003), like the Inspector.
import { useMemo, useState } from "react";
import { CHAR_ROLE_SUGGESTIONS } from "../types";
import type { GraphNode } from "../types";
import { useGraphStore } from "../store";
import { characterDetails } from "../data/characters";

export default function CharactersView() {
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const projectId = useGraphStore((s) => s.projectId);
  const select = useGraphStore((s) => s.select);
  const addNodeOfType = useGraphStore((s) => s.addNodeOfType);
  const patchNode = useGraphStore((s) => s.patchNode);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<GraphNode>>({});

  // Reset stale edits when the expanded card changes — derive-during-render.
  const [prevExpanded, setPrevExpanded] = useState(expandedId);
  if (prevExpanded !== expandedId) {
    setPrevExpanded(expandedId);
    setDraft({});
  }

  const project = projectId ? nodes[projectId] : undefined;
  const characters = useMemo(
    () =>
      Object.values(nodes)
        .filter((n) => n.type === "character")
        .sort((a, b) => a.title.localeCompare(b.title)),
    [nodes],
  );
  const details = useMemo(
    () => (project ? characterDetails(project, nodes, edges) : new Map()),
    [project, nodes, edges],
  );

  if (characters.length === 0) {
    return (
      <div className="tln-chars tln-chars--empty">
        No characters yet.
        <button
          className="tln-newcard tln-newcard--solo"
          onClick={() => {
            const id = addNodeOfType("character");
            if (id) setExpandedId(id);
          }}
        >
          + New character
        </button>
      </div>
    );
  }

  const toggle = (id: string): void => {
    setExpandedId((cur) => (cur === id ? null : id));
    select([id]);
  };

  return (
    <div className="tln-chars">
      {characters.map((c) => {
        const d = details.get(c.id);
        const scenes = d?.sceneIds ?? [];
        const isExpanded = expandedId === c.id;

        const val = <K extends keyof GraphNode>(k: K): GraphNode[K] =>
          k in draft ? (draft[k] as GraphNode[K]) : c[k];
        const edit = (patch: Partial<GraphNode>): void => setDraft((p) => ({ ...p, ...patch }));
        const save = (): void => {
          if (Object.keys(draft).length > 0) patchNode(c.id, draft);
          setDraft({});
        };

        const sceneChip = (sid: string, cls: string): JSX.Element => (
          <button key={sid} className={cls} onClick={() => select([sid])}>
            {nodes[sid]?.title ?? sid}
          </button>
        );

        return (
          <div key={c.id} className={`tln-charcard${isExpanded ? " tln-charcard--open" : ""}`}>
            <div className="tln-charcard__head">
              <span className="tln-charcard__name">{val("title") || c.title}</span>
              {!isExpanded && c.role ? <span className="tln-charcard__badge">{c.role}</span> : null}
              <button
                className="tln-charcard__toggle"
                onClick={() => toggle(c.id)}
                title={isExpanded ? "Collapse" : "Edit details"}
              >
                {isExpanded ? "▴" : "✎"}
              </button>
            </div>

            {isExpanded ? (
              <div className="tln-charcard__form">
                <label className="tln-charcard__field">
                  Role
                  <input
                    list="tln-role-suggestions"
                    placeholder="Protagonist…"
                    value={val("role") ?? ""}
                    onChange={(e) => edit({ role: e.target.value })}
                    onBlur={save}
                  />
                </label>
                <label className="tln-charcard__field">
                  Synopsis
                  <textarea
                    rows={2}
                    value={val("synopsis") ?? ""}
                    onChange={(e) => edit({ synopsis: e.target.value })}
                    onBlur={save}
                  />
                </label>
                <label className="tln-charcard__field">
                  Backstory
                  <textarea
                    rows={4}
                    value={val("backstory") ?? ""}
                    onChange={(e) => edit({ backstory: e.target.value })}
                    onBlur={save}
                  />
                </label>
                <datalist id="tln-role-suggestions">
                  {CHAR_ROLE_SUGGESTIONS.map((r) => (
                    <option key={r} value={r} />
                  ))}
                </datalist>
              </div>
            ) : (
              <>
                {c.synopsis ? <div className="tln-charcard__syn">{c.synopsis}</div> : null}
                {d && (d.sceneIds.length > 0 || d.firstSceneId) ? (
                  <div className="tln-charcard__stats">
                    <span>{scenes.length === 1 ? "1 scene" : `${scenes.length} scenes`}</span>
                    {d.firstSceneId ? sceneChip(d.firstSceneId, "tln-charcard__stat") : null}
                    {d.lastSceneId && d.lastSceneId !== d.firstSceneId
                      ? sceneChip(d.lastSceneId, "tln-charcard__stat tln-charcard__stat--last")
                      : null}
                  </div>
                ) : null}
                <div className="tln-charcard__sec">Scenes ({scenes.length})</div>
                <div className="tln-charcard__scenes">
                  {scenes.map((sid) => sceneChip(sid, "tln-charcard__scene"))}
                  {scenes.length === 0 ? (
                    <span className="tln-charcard__none">None linked</span>
                  ) : null}
                </div>
                {(d?.relations.length ?? 0) > 0 ? (
                  <>
                    <div className="tln-charcard__sec">Relations</div>
                    <div className="tln-charcard__rels">
                      {(d?.relations ?? []).map((r) => (
                        <span
                          key={`${c.id}-${r.otherId}`}
                          className="tln-charcard__rel"
                          title={r.label ?? undefined}
                        >
                          {nodes[r.otherId]?.title ?? r.otherId}
                          {r.label ? <em> · {r.label}</em> : null}
                        </span>
                      ))}
                    </div>
                  </>
                ) : null}
                {(d?.themeIds.length ?? 0) > 0 ? (
                  <>
                    <div className="tln-charcard__sec">Themes</div>
                    <div className="tln-charcard__rels">
                      {(d?.themeIds ?? []).map((tid) => (
                        <span key={tid} className="tln-charcard__theme">
                          {nodes[tid]?.title ?? tid}
                        </span>
                      ))}
                    </div>
                  </>
                ) : null}
                {(d?.locationIds.length ?? 0) > 0 ? (
                  <>
                    <div className="tln-charcard__sec">Locations</div>
                    <div className="tln-charcard__rels">
                      {(d?.locationIds ?? []).map((lid) => (
                        <span key={lid} className="tln-charcard__loc">
                          {nodes[lid]?.title ?? lid}
                        </span>
                      ))}
                    </div>
                  </>
                ) : null}
              </>
            )}
          </div>
        );
      })}
      <button
        className="tln-newcard"
        onClick={() => {
          const id = addNodeOfType("character");
          if (id) setExpandedId(id);
        }}
      >
        + New character
      </button>
    </div>
  );
}
