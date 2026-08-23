// Characters lens: roster cards with appears_in scene lists and relates_to
// chips. Clicking a scene title selects it graph-wide (Map will center it).
import { useMemo } from "react";
import { useGraphStore } from "../store";

export default function CharactersView() {
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const select = useGraphStore((s) => s.select);

  const characters = useMemo(
    () => Object.values(nodes).filter((n) => n.type === "character"),
    [nodes],
  );

  const appearsIn = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const e of Object.values(edges)) {
      if (e.type !== "appears_in") continue;
      const arr = m.get(e.from) ?? [];
      arr.push(e.to);
      m.set(e.from, arr);
    }
    return m;
  }, [edges]);

  const relatesTo = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const e of Object.values(edges)) {
      if (e.type !== "relates_to" && e.type !== "related_to") continue;
      const a = e.from;
      const b = e.to;
      m.set(a, [...(m.get(a) ?? []), b]);
      m.set(b, [...(m.get(b) ?? []), a]);
    }
    return m;
  }, [edges]);

  if (characters.length === 0) {
    return (
      <div className="tln-chars tln-chars--empty">No characters yet — add one on the Map rail.</div>
    );
  }

  return (
    <div className="tln-chars">
      {characters.map((c) => {
        const scenes = appearsIn.get(c.id) ?? [];
        const rels = relatesTo.get(c.id) ?? [];
        return (
          <div key={c.id} className="tln-charcard">
            <div className="tln-charcard__name">{c.title}</div>
            {c.synopsis ? <div className="tln-charcard__syn">{c.synopsis}</div> : null}
            <div className="tln-charcard__sec">Scenes ({scenes.length})</div>
            <div className="tln-charcard__scenes">
              {scenes.map((sid) => (
                <button key={sid} className="tln-charcard__scene" onClick={() => select([sid])}>
                  {nodes[sid]?.title ?? sid}
                </button>
              ))}
              {scenes.length === 0 ? <span className="tln-charcard__none">None linked</span> : null}
            </div>
            {rels.length > 0 ? (
              <>
                <div className="tln-charcard__sec">Relations</div>
                <div className="tln-charcard__rels">
                  {rels.map((rid, i) => (
                    <span key={`${rid}-${i}`} className="tln-charcard__rel">
                      {nodes[rid]?.title ?? rid}
                    </span>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
