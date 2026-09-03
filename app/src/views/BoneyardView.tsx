// The boneyard: raw ideas kept before they belong to any project.
//
// This finishes a concept the domain model already had. CONTEXT.md defines a
// Seed as "a raw idea kept before it belongs to any project" and Grew Into as
// "a seed becoming a project or a scene"; the node type, the edge type and its
// legality rules were all in the code, and nothing ever surfaced them.
//
// The design constraint that matters: capture has to cost nothing. An idea you
// have to title, categorise and file is an idea you write down somewhere else.
// So one box, Enter, done — everything else is optional and comes later.
import { useEffect, useState } from "react";
import { dbGetAll } from "../data/idb";
import { useGraphStore } from "../store";
import type { GraphEdge, SparkType } from "../types";

type SparkMeta = {
  type: SparkType;
  label: string;
  icon: string;
  shortLabel: string;
};

const SPARK_METAS: readonly SparkMeta[] = [
  { type: "premise", label: "Premise / Logline", icon: "🎬", shortLabel: "Premise" },
  { type: "character", label: "Character Concept", icon: "👤", shortLabel: "Character" },
  { type: "location", label: "World / Location", icon: "📍", shortLabel: "World" },
  { type: "scene", label: "Set Piece / Scene", icon: "⚡", shortLabel: "Scene" },
  { type: "dialogue", label: "Overheard Dialogue", icon: "💬", shortLabel: "Dialogue" },
  { type: "twist", label: "What If / Twist", icon: "🔮", shortLabel: "Twist" },
] as const;

export default function BoneyardView({ onGrown }: { onGrown: (projectId: string) => void }) {
  const seeds = useGraphStore((s) => s.seeds);
  const projects = useGraphStore((s) => s.projects);
  const addSeed = useGraphStore((s) => s.addSeed);
  const patchSeed = useGraphStore((s) => s.patchSeed);
  const deleteSeed = useGraphStore((s) => s.deleteSeed);
  const growSeed = useGraphStore((s) => s.growSeed);

  const [draft, setDraft] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [tagPickerId, setTagPickerId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | SparkType | "untagged">("all");
  const [grewIntoMap, setGrewIntoMap] = useState<Record<string, { id: string; title: string }>>({});

  // Detect which seeds have already grown into stories via grew_into edges
  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const edges = await dbGetAll<GraphEdge>("edges");
        const grewEdges = edges.filter((e) => e.type === "grew_into");
        const map: Record<string, { id: string; title: string }> = {};
        for (const ge of grewEdges) {
          const proj = projects.find((p) => p.id === ge.to);
          if (proj) {
            map[ge.from] = { id: proj.id, title: proj.title };
          }
        }
        if (live) setGrewIntoMap(map);
      } catch {
        // IDB errors shouldn't crash the view
      }
    })();
    return () => {
      live = false;
    };
  }, [seeds, projects]);

  const jot = (): void => {
    const t = draft.trim();
    if (!t) return;
    void addSeed(t);
    setDraft("");
  };

  // Spark tag counts
  const tagCounts = {
    all: seeds.length,
    premise: seeds.filter((s) => s.sparkType === "premise").length,
    character: seeds.filter((s) => s.sparkType === "character").length,
    location: seeds.filter((s) => s.sparkType === "location").length,
    scene: seeds.filter((s) => s.sparkType === "scene").length,
    dialogue: seeds.filter((s) => s.sparkType === "dialogue").length,
    twist: seeds.filter((s) => s.sparkType === "twist").length,
    untagged: seeds.filter((s) => !s.sparkType).length,
  };

  // Filtered & searched seeds
  const filteredSeeds = seeds.filter((s) => {
    if (filter !== "all") {
      if (filter === "untagged") {
        if (s.sparkType) return false;
      } else if (s.sparkType !== filter) {
        return false;
      }
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const titleMatch = s.title.toLowerCase().includes(q);
      const synopsisMatch = (s.synopsis ?? "").toLowerCase().includes(q);
      if (!titleMatch && !synopsisMatch) return false;
    }
    return true;
  });

  return (
    <div className="tln-library">
      <header className="tln-library__head">
        <div>
          <h1 className="tln-library__title">Boneyard</h1>
          <p className="tln-library__count">
            {seeds.length === 0
              ? "Nothing here yet"
              : `${seeds.length} idea${seeds.length === 1 ? "" : "s"} waiting`}
          </p>
        </div>
      </header>

      {/* Capture first, always visible, never behind a button. */}
      <div className="tln-jot">
        <input
          className="tln-jot__input"
          placeholder="A line about something that might be a story…"
          aria-label="New idea"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") jot();
          }}
        />
        <button className="tln-btn tln-btn--accent" disabled={!draft.trim()} onClick={jot}>
          Keep it
        </button>
      </div>

      {seeds.length > 0 && (
        <div className="tln-boneyard__toolbar">
          {/* Instant search across titles and notes */}
          <div className="tln-boneyard__search-wrap">
            <input
              className="tln-boneyard__search-input"
              type="text"
              placeholder="Search sparks by keyword, dialogue, note…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search sparks"
            />
            {search && (
              <button
                className="tln-boneyard__clear-btn"
                onClick={() => setSearch("")}
                title="Clear search"
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {/* Prism spark classification filter chips */}
          <div className="tln-boneyard__filters" role="tablist" aria-label="Filter sparks by tag">
            <button
              className={`tln-filter-chip${filter === "all" ? " tln-filter-chip--active" : ""}`}
              onClick={() => setFilter("all")}
            >
              <span>All</span>
              <span className="tln-filter-chip__count">{tagCounts.all}</span>
            </button>
            {SPARK_METAS.map((m) => (
              <button
                key={m.type}
                className={`tln-filter-chip${filter === m.type ? " tln-filter-chip--active" : ""}`}
                onClick={() => setFilter(filter === m.type ? "all" : m.type)}
                title={`Filter by ${m.label}`}
              >
                <span>{m.icon}</span>
                <span>{m.shortLabel}</span>
                <span className="tln-filter-chip__count">{tagCounts[m.type]}</span>
              </button>
            ))}
            {tagCounts.untagged > 0 && (
              <button
                className={`tln-filter-chip${filter === "untagged" ? " tln-filter-chip--active" : ""}`}
                onClick={() => setFilter(filter === "untagged" ? "all" : "untagged")}
                title="Filter untagged sparks"
              >
                <span>Untagged</span>
                <span className="tln-filter-chip__count">{tagCounts.untagged}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {seeds.length === 0 ? (
        <p className="tln-boneyard__empty">
          Ideas live here until they are worth building. Nothing kept here belongs to a story yet,
          and nothing here is lost when you decide it is not the one.
        </p>
      ) : filteredSeeds.length === 0 ? (
        <div className="tln-boneyard__no-match">
          <p>No sparks match your current search or filter.</p>
          <button
            className="tln-btn tln-btn--quiet"
            onClick={() => {
              setSearch("");
              setFilter("all");
            }}
          >
            Clear filters
          </button>
        </div>
      ) : (
        <ul className="tln-seeds">
          {filteredSeeds.map((s) => {
            const open = openId === s.id;
            const picking = tagPickerId === s.id;
            const meta = SPARK_METAS.find((m) => m.type === s.sparkType);
            const grew = grewIntoMap[s.id];

            return (
              <li
                key={s.id}
                className={`tln-seed${s.sparkType ? ` tln-seed--${s.sparkType}` : ""}${open ? " tln-seed--open" : ""}`}
              >
                <div className="tln-seed__row">
                  {/* 1-Click Spark Type Badge */}
                  <button
                    className={`tln-spark-chip${s.sparkType ? ` tln-spark-chip--${s.sparkType}` : " tln-spark-chip--empty"}`}
                    onClick={() => setTagPickerId(picking ? null : s.id)}
                    title={meta ? `Tag: ${meta.label} (click to change)` : "Add spark tag"}
                  >
                    <span>{meta ? meta.icon : "+"}</span>
                    <span>{meta ? meta.shortLabel : "Tag"}</span>
                  </button>

                  <button
                    className="tln-seed__title"
                    onClick={() => setOpenId(open ? null : s.id)}
                    title={open ? "Collapse" : "Add a note"}
                  >
                    {s.title}
                  </button>

                  {/* Lineage badge: links back to grown project */}
                  {grew && (
                    <button
                      className="tln-seed__grew"
                      onClick={() => onGrown(grew.id)}
                      title={`Open story: ${grew.title}`}
                    >
                      🌱 {grew.title} →
                    </button>
                  )}

                  <button
                    className="tln-btn"
                    onClick={() => void growSeed(s.id).then((id) => id && onGrown(id))}
                    title="Start a story from this idea, keeping the link back to it"
                  >
                    Grow into a story
                  </button>

                  <button
                    className="tln-btn tln-btn--quiet"
                    onClick={() => void deleteSeed(s.id)}
                    title="Throw this idea away"
                  >
                    ✕
                  </button>
                </div>

                {/* 1-Click Tag Selector Popover */}
                {picking && (
                  <div className="tln-spark-popover">
                    {SPARK_METAS.map((m) => (
                      <button
                        key={m.type}
                        className={`tln-spark-popover__opt${s.sparkType === m.type ? " tln-spark-popover__opt--active" : ""}`}
                        onClick={() => {
                          void patchSeed(s.id, {
                            sparkType: s.sparkType === m.type ? undefined : m.type,
                          });
                          setTagPickerId(null);
                        }}
                        title={m.label}
                      >
                        <span>{m.icon}</span>
                        <span>{m.label}</span>
                      </button>
                    ))}
                    {s.sparkType && (
                      <button
                        className="tln-spark-popover__clear"
                        onClick={() => {
                          void patchSeed(s.id, { sparkType: undefined });
                          setTagPickerId(null);
                        }}
                        title="Remove tag"
                      >
                        ✕ Remove tag
                      </button>
                    )}
                  </div>
                )}

                {open && (
                  <textarea
                    className="tln-seed__note"
                    rows={4}
                    autoFocus
                    placeholder="What is it? Why might it matter? Anything you would forget by Thursday."
                    value={s.synopsis ?? ""}
                    onChange={(e) => void patchSeed(s.id, { synopsis: e.target.value })}
                  />
                )}
                {!open && s.synopsis ? <p className="tln-seed__preview">{s.synopsis}</p> : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
