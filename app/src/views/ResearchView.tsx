// Research: material collected about the work rather than part of it.
//
// Two kinds live here and the distinction is the whole design. Material tied to
// one story sits under it; beat sheets, style notes and anything reusable sits
// loose and is shared by every story. Forcing everything to belong to a project
// would mean copying a beat sheet each time, and forcing nothing to would lose
// the association that makes a reference worth keeping at all.
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  Compass,
  ExternalLink,
  FileText,
  FolderOpen,
  Layers,
  Link2,
  ListChecks,
  Paperclip,
  Plus,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { beatProgress } from "../data/beats";
import { BEAT_SHEETS, beatSheetRows } from "../data/beatsheets";
import { describeSize, hasBytes, MAX_FILE_BYTES, openAttachment, putFile } from "../data/files";
import { dbGetAll } from "../data/idb";
import { scopeToProject } from "../data/scopes";
import { useGraphStore } from "../store";
import type { Attachment, Beat, GraphEdge, GraphNode } from "../types";
import BeatSheet from "./BeatSheet";

/**
 * randomUUID exists only in a secure context. On a plain-http host every beat
 * sheet button would throw, which presents exactly as the button doing nothing.
 * Module scope rather than inside the component: it is not render logic.
 */
function newId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function ResearchView() {
  const references = useGraphStore((s) => s.references);
  const projects = useGraphStore((s) => s.projects);
  const openProjectId = useGraphStore((s) => s.projectId);
  const addReference = useGraphStore((s) => s.addReference);
  const patchReference = useGraphStore((s) => s.patchReference);
  const deleteReference = useGraphStore((s) => s.deleteReference);

  // Defaults to the story you were last in, not Shared: a sheet created shared
  // has no scenes to link, so the headline feature arrives disabled and reads as
  // broken. Tracked separately from the user's own choice because projectId is
  // null on first render and only arrives once boot finishes — initialising from
  // it once meant that after a reload the filter said Shared while the items
  // were parented, and the tab looked empty.
  const [scope, setScope] = useState<string>("shared");
  const [chosen, setChosen] = useState(false);

  useEffect(() => {
    if (chosen || !openProjectId) return;
    // oxlint-disable-next-line react/set-state-in-effect
    setScope(openProjectId);
  }, [openProjectId, chosen]);

  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [draftNote, setDraftNote] = useState("");
  const [captureActive, setCaptureActive] = useState(false);
  const composerInputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "beats" | "notes" | "links" | "files">(
    "all",
  );
  const [problem, setProblem] = useState<string | null>(null);
  const [present, setPresent] = useState<Record<string, boolean>>({});
  const [scenesByProject, setScenesByProject] = useState<Record<string, GraphNode[]>>({});

  // Scenes for linking. The store holds only the open project, so a sheet that
  // belongs to some other story has no scenes to offer without reading the graph.
  useEffect(() => {
    let live = true;
    void (async () => {
      const [nodesArr, edgesArr] = await Promise.all([
        dbGetAll<GraphNode>("nodes"),
        dbGetAll<GraphEdge>("edges"),
      ]);
      const allNodes: Record<string, GraphNode> = {};
      for (const n of nodesArr) allNodes[n.id] = n;
      const allEdges: Record<string, GraphEdge> = {};
      for (const e of edgesArr) allEdges[e.id] = e;
      const next: Record<string, GraphNode[]> = {};
      for (const p of projects) {
        next[p.id] = Object.values(scopeToProject(allNodes, allEdges, p.id).nodes).filter(
          (n) => n.type === "scene",
        );
      }
      if (live) setScenesByProject(next);
    })();
    return () => {
      live = false;
    };
  }, [projects, references]);

  // Which attachments actually have bytes on this device. Recorded metadata
  // travels with the story; the file itself does not (data/files.ts).
  useEffect(() => {
    let live = true;
    void (async () => {
      const next: Record<string, boolean> = {};
      for (const r of references) {
        for (const a of r.attachments ?? []) next[a.id] = await hasBytes(a.id);
      }
      if (live) setPresent(next);
    })();
    return () => {
      live = false;
    };
  }, [references]);

  const inScope = useMemo(
    () =>
      references.filter((r) =>
        scope === "all" ? true : scope === "shared" ? !r.parentId : r.parentId === scope,
      ),
    [references, scope],
  );

  const counts = useMemo(
    () => ({
      all: inScope.length,
      beats: inScope.filter((r) => !!r.beats).length,
      notes: inScope.filter((r) => !r.beats && !r.url).length,
      links: inScope.filter((r) => !!r.url).length,
      files: inScope.filter((r) => (r.attachments?.length ?? 0) > 0).length,
    }),
    [inScope],
  );

  const shown = useMemo(() => {
    const term = query.trim().toLowerCase();
    return inScope.filter((r) => {
      if (typeFilter === "beats" && !r.beats) return false;
      if (typeFilter === "notes" && (r.beats || r.url)) return false;
      if (typeFilter === "links" && !r.url) return false;
      if (typeFilter === "files" && (!r.attachments || r.attachments.length === 0)) return false;

      if (!term) return true;
      if (r.title.toLowerCase().includes(term)) return true;
      if (r.synopsis?.toLowerCase().includes(term)) return true;
      if (r.url?.toLowerCase().includes(term)) return true;
      if (
        r.beats?.some(
          (b) => b.name.toLowerCase().includes(term) || b.note?.toLowerCase().includes(term),
        )
      ) {
        return true;
      }
      return false;
    });
  }, [inScope, typeFilter, query]);

  const titleOf = (id: string | undefined): string =>
    projects.find((p) => p.id === id)?.title ?? "Shared";

  const add = (): void => {
    const t = draft.trim();
    if (!t) {
      setCaptureActive(true);
      composerInputRef.current?.focus();
      return;
    }
    setProblem(null);
    const extra: Partial<GraphNode> = {};
    if (draftNote.trim()) {
      extra.synopsis = draftNote.trim();
    }
    addReference(t, scope === "all" || scope === "shared" ? null : scope, extra)
      .then((id) => {
        setOpenId(id);
        setDraft("");
        setDraftNote("");
        setCaptureActive(false);
      })
      .catch((err: unknown) => setProblem(String(err)));
  };

  const applySheet = (sheetId: string): void => {
    const sheet = BEAT_SHEETS.find((b) => b.id === sheetId);
    if (!sheet) return;
    setProblem(null);
    // Guarded because a throw in here is the difference between "the button did
    // nothing" and knowing why. randomUUID needs a secure context, which is easy
    // to lose on a plain-http host.
    try {
      addReference(sheet.name, scope === "all" || scope === "shared" ? null : scope, {
        beats: beatSheetRows(sheet, () => newId()),
      })
        .then(setOpenId)
        .catch((err: unknown) => setProblem(String(err)));
    } catch (err) {
      setProblem(String(err));
    }
  };

  const attach = async (ref: GraphNode, file: File): Promise<void> => {
    if (file.size > MAX_FILE_BYTES) {
      setProblem(
        `${file.name} is ${describeSize(file.size)}; the limit is ${describeSize(MAX_FILE_BYTES)}.`,
      );
      return;
    }
    setProblem(null);
    const meta: Attachment = {
      id: newId(),
      name: file.name,
      mime: file.type,
      size: file.size,
    };
    // Bytes first: a record pointing at nothing is worse than no record.
    await putFile(meta.id, file);
    await patchReference(ref.id, { attachments: [...(ref.attachments ?? []), meta] });
    setPresent((p) => ({ ...p, [meta.id]: true }));
  };

  return (
    <main className="tln-library rs-page">
      <div className="tln-library__inner">
        <header className="tln-library__head rs-head">
          <div className="rs-head__info">
            <p className="tln-library__eyebrow">
              <span /> THE STUDY
            </p>
            <h1 className="tln-library__title">Research</h1>
            <p className="tln-library__count">
              Material that informs the work: beat sheets, character references, and field notes.
            </p>
          </div>
          <div className="tln-library__actions rs-head__actions">
            <div className="rs-scope-filter" title="Filter research by story scope">
              <FolderOpen size={15} className="rs-scope-filter__icon" aria-hidden="true" />
              <select
                className="rs-scope-filter__select"
                aria-label="Which story"
                value={scope}
                onChange={(e) => {
                  setChosen(true);
                  setScope(e.target.value);
                }}
              >
                <option value="all">All Stories</option>
                <option value="shared">Shared across stories</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="rs-scope-filter__arrow" aria-hidden="true" />
            </div>
          </div>
        </header>

        {/* Prompts, not doctrine. Applying one makes a note to fill in — it does
            not create scenes, because that commits the story to a shape before
            anything is written. */}
        <div className="tln-sheets rs-blueprints">
          <div className="rs-blueprints__head">
            <span className="tln-sheets__label rs-blueprints__label">
              <Sparkles size={14} aria-hidden="true" /> Start from a beat sheet
            </span>
            <span className="rs-blueprints__hint">
              Prompts, not doctrine. Choose a structure to start scaffolding.
            </span>
          </div>
          <div className="rs-blueprints__cards">
            {BEAT_SHEETS.map((b) => (
              <button
                key={b.id}
                className="tln-btn rs-blueprint-card"
                title={b.source}
                onClick={() => applySheet(b.id)}
              >
                <Layers size={14} className="rs-blueprint-card__icon" aria-hidden="true" />
                <span className="rs-blueprint-card__name">{b.name}</span>
                <span className="rs-blueprint-card__count" aria-hidden="true">
                  {b.beats.length} beats
                </span>
              </button>
            ))}
          </div>
        </div>

        <div
          className={`tln-jot rs-capture${captureActive || draft.trim() ? " rs-capture--active" : ""}`}
        >
          <div className="rs-capture__top">
            <div className="rs-capture__input-wrap">
              <span className="rs-capture__icon-wrap">
                <Plus size={16} aria-hidden="true" />
              </span>
              <input
                ref={composerInputRef}
                className="tln-jot__input rs-capture__input"
                placeholder={
                  scope === "all" || scope === "shared"
                    ? "Title or topic to research (e.g. 1970s dial telephones, Detective interview)…"
                    : `Title or topic for “${titleOf(scope)}”…`
                }
                aria-label="New research item"
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  if (problem) setProblem(null);
                }}
                onFocus={() => setCaptureActive(true)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    add();
                  }
                }}
              />
            </div>
            <button
              className="tln-btn tln-btn--accent rs-capture__btn"
              onClick={add}
              title={draft.trim() ? "Add research note (Enter)" : "Click to type and add note"}
            >
              <Plus size={15} aria-hidden="true" /> Add note
            </button>
          </div>

          {(captureActive || draft.trim().length > 0) && (
            <div className="rs-capture__expanded">
              <textarea
                className="rs-capture__textarea"
                placeholder="Initial notes, quotes, observations, or paste a link (optional)…"
                rows={2}
                value={draftNote}
                onChange={(e) => setDraftNote(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    e.preventDefault();
                    add();
                  }
                }}
              />
              <div className="rs-capture__meta-row">
                <span className="rs-capture__scope-tag">
                  Filing to: <strong>{titleOf(scope === "all" ? undefined : scope)}</strong>
                </span>
                <div className="rs-capture__hints">
                  <span className="rs-capture__hint">Press Enter to add</span>
                  <button
                    type="button"
                    className="tln-btn tln-btn--quiet rs-capture__cancel"
                    onClick={() => {
                      setDraft("");
                      setDraftNote("");
                      setCaptureActive(false);
                    }}
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {references.length > 0 && (
          <div className="rs-toolbar">
            <div className="rs-search">
              <Search size={14} className="rs-search__icon" aria-hidden="true" />
              <input
                className="rs-search__input"
                placeholder="Search research, beats, notes…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search research"
              />
              {query && (
                <button
                  className="rs-search__clear"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                >
                  <X size={13} />
                </button>
              )}
            </div>
            <div className="rs-filters">
              {(
                [
                  { id: "all", label: "All", count: counts.all },
                  { id: "beats", label: "Beat Sheets", count: counts.beats },
                  { id: "notes", label: "Notes", count: counts.notes },
                  { id: "links", label: "Links", count: counts.links },
                  { id: "files", label: "Files", count: counts.files },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  className={`rs-filter-btn${typeFilter === f.id ? " rs-filter-btn--active" : ""}`}
                  onClick={() => setTypeFilter(f.id)}
                >
                  <span>{f.label}</span>
                  <span className="rs-filter-count">{f.count}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {problem && (
          <p className="tln-library__error" role="alert">
            {problem}
          </p>
        )}

        {references.length === 0 ? (
          <section className="tln-library__welcome rs-welcome" aria-labelledby="rs-welcome-title">
            <div className="tln-library__welcome-copy">
              <Compass size={32} strokeWidth={1.25} aria-hidden="true" />
              <h2 id="rs-welcome-title">
                Every story is built
                <br />
                on research.
              </h2>
              <p>
                Collect field notes, interview quotes, articles, and photographs—or scaffold your
                structure from proven screenplay beat sheets.
              </p>
              <div className="rs-welcome__actions">
                <button
                  className="tln-btn tln-btn--accent"
                  onClick={() => applySheet("save-the-cat")}
                >
                  <Sparkles size={14} aria-hidden="true" /> Start with Save the Cat
                </button>
              </div>
            </div>
          </section>
        ) : shown.length === 0 ? (
          <div className="rs-empty">
            <h2>No research matching your filter</h2>
            <p>
              {query
                ? `Nothing found matching “${query}”. Try adjusting your search or clearing the filter.`
                : "No items match the currently selected story or type filter."}
            </p>
            <button
              className="tln-btn"
              onClick={() => {
                setQuery("");
                setTypeFilter("all");
                setScope("all");
              }}
            >
              Reset all filters
            </button>
          </div>
        ) : (
          <ul className="tln-seeds rs-list">
            {shown.map((r) => {
              const open = openId === r.id;
              const isBeatSheet = !!r.beats;
              const hasFiles = (r.attachments?.length ?? 0) > 0;
              const isLink = !!r.url;
              const { done, total } = isBeatSheet ? beatProgress(r.beats!) : { done: 0, total: 0 };
              return (
                <li
                  key={r.id}
                  className={`tln-seed rs-card${open ? " tln-seed--open rs-card--open" : ""}`}
                >
                  <div className="tln-seed__row rs-card__header">
                    <span
                      className="rs-card__type-badge"
                      title={
                        isBeatSheet
                          ? "Beat Sheet"
                          : hasFiles
                            ? "Document with Files"
                            : isLink
                              ? "Web Reference"
                              : "Research Note"
                      }
                    >
                      {isBeatSheet ? (
                        <ListChecks size={15} aria-hidden="true" />
                      ) : isLink ? (
                        <Link2 size={15} aria-hidden="true" />
                      ) : hasFiles ? (
                        <Paperclip size={15} aria-hidden="true" />
                      ) : (
                        <FileText size={15} aria-hidden="true" />
                      )}
                    </span>

                    <div className="rs-card__title-wrap">
                      <button
                        className="tln-seed__title rs-card__title"
                        onClick={() => setOpenId(open ? null : r.id)}
                      >
                        {r.title}
                      </button>

                      <div className="rs-card__meta-chips">
                        {isBeatSheet && (
                          <span
                            className={`rs-chip${done > 0 && done === total ? " rs-chip--done" : ""}`}
                            title={`${done} of ${total} beats completed`}
                          >
                            {done}/{total} beats
                          </span>
                        )}
                        {hasFiles && (
                          <span
                            className="rs-chip"
                            title={`${r.attachments!.length} attachment(s)`}
                          >
                            <Paperclip size={11} aria-hidden="true" />
                            {r.attachments!.length}
                          </span>
                        )}
                        {isLink && (
                          <span className="rs-chip" title={r.url!}>
                            <Link2 size={11} aria-hidden="true" />
                            {(() => {
                              try {
                                return new URL(r.url!).hostname.replace(/^www\./, "");
                              } catch {
                                return "link";
                              }
                            })()}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="rs-card__controls">
                      {/* Attachable after the fact. Without this a sheet created
                          shared could never gain scenes, and one created under the
                          wrong story could never be moved. */}
                      <select
                        className="tln-ref__scope rs-card__scope-select"
                        aria-label={`Which story ${r.title} belongs to`}
                        value={r.parentId ?? ""}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) =>
                          void patchReference(r.id, { parentId: e.target.value || undefined })
                        }
                      >
                        <option value="">Shared</option>
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.title}
                          </option>
                        ))}
                      </select>

                      <button
                        className="tln-btn tln-btn--quiet rs-delete-btn"
                        onClick={() => void deleteReference(r.id)}
                        title="Delete this and any files kept with it"
                      >
                        ✕
                      </button>

                      <span
                        className="rs-card__toggle-icon"
                        onClick={() => setOpenId(open ? null : r.id)}
                        aria-hidden="true"
                      >
                        <ChevronDown size={16} />
                      </span>
                    </div>
                  </div>

                  {/* Attachments preview on collapsed card if any */}
                  {!open && (r.attachments?.length ?? 0) > 0 && (
                    <div className="tln-ref__files">
                      {(r.attachments ?? []).map((a) => (
                        <button
                          key={a.id}
                          className={`tln-ref__file${present[a.id] ? "" : " tln-ref__file--absent"}`}
                          disabled={!present[a.id]}
                          onClick={() => void openAttachment(a)}
                          title={
                            present[a.id]
                              ? `Open ${a.name}`
                              : "Recorded on another device — the file itself is not on this one"
                          }
                        >
                          {a.name} · {describeSize(a.size)}
                          {present[a.id] ? "" : " · elsewhere"}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Expanded Body */}
                  {open && (
                    <div className="rs-card__body">
                      {r.beats ? (
                        <BeatSheet
                          beats={r.beats}
                          scenes={r.parentId ? (scenesByProject[r.parentId] ?? []) : []}
                          onChange={(next: Beat[]) => void patchReference(r.id, { beats: next })}
                        />
                      ) : null}

                      <div className="rs-field">
                        <div className="rs-field__header">
                          <span className="rs-field__label">
                            <Link2 size={13} aria-hidden="true" /> Source Link
                          </span>
                          {r.url && (
                            <a
                              className="tln-btn rs-open-link-btn"
                              href={r.url}
                              target="_blank"
                              rel="noreferrer noopener"
                            >
                              <ExternalLink size={13} aria-hidden="true" /> Open link
                            </a>
                          )}
                        </div>
                        <input
                          className="tln-ref__url rs-field-input"
                          placeholder="https://… (optional)"
                          aria-label="Source link"
                          value={r.url ?? ""}
                          onChange={(e) => void patchReference(r.id, { url: e.target.value })}
                        />
                      </div>

                      <div className="rs-field">
                        <div className="rs-field__header">
                          <span className="rs-field__label">
                            <FileText size={13} aria-hidden="true" />{" "}
                            {r.beats ? "Overall Notes & Thoughts" : "Research Notes & Synthesis"}
                          </span>
                        </div>
                        <textarea
                          className="tln-seed__note rs-field-textarea"
                          rows={r.beats ? 3 : 7}
                          placeholder={
                            r.beats
                              ? "Anything about this sheet as a whole…"
                              : "Notes, quotes, takeaways, observations…"
                          }
                          value={r.synopsis ?? ""}
                          onChange={(e) => void patchReference(r.id, { synopsis: e.target.value })}
                        />
                      </div>

                      {(r.attachments?.length ?? 0) > 0 && (
                        <div className="tln-ref__files">
                          {(r.attachments ?? []).map((a) => (
                            <button
                              key={a.id}
                              className={`tln-ref__file${present[a.id] ? "" : " tln-ref__file--absent"}`}
                              disabled={!present[a.id]}
                              onClick={() => void openAttachment(a)}
                              title={
                                present[a.id]
                                  ? `Open ${a.name}`
                                  : "Recorded on another device — the file itself is not on this one"
                              }
                            >
                              {a.name} · {describeSize(a.size)}
                              {present[a.id] ? "" : " · elsewhere"}
                            </button>
                          ))}
                        </div>
                      )}

                      <div className="tln-ref__row rs-card__footer">
                        <div className="rs-card__footer-actions">
                          <label className="tln-btn rs-attach-btn">
                            <Paperclip size={14} aria-hidden="true" /> Attach a file…
                            <input
                              type="file"
                              hidden
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                e.target.value = "";
                                if (f) void attach(r, f);
                              }}
                            />
                          </label>
                        </div>
                        <span className="tln-ref__hint">
                          Files stay on this device. Notes and links follow the story everywhere.
                        </span>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
