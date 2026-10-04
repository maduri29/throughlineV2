// Research: material collected about the work rather than part of it.
//
// Two kinds live here and the distinction is the whole design. Material tied to
// one story sits under it; beat sheets, style notes and anything reusable sits
// loose and is shared by every story.
import {
  ChevronDown,
  Clapperboard,
  Compass,
  FolderOpen,
  Layers,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { BEAT_SHEETS } from "../data/beatsheets";
import { GuideReader } from "./research/GuideReader";
import { ReferenceCard } from "./research/ReferenceCard";
import { ReferenceComposer } from "./research/ReferenceComposer";
import { ResearchShelf, SHELF_ITEMS } from "./research/ResearchShelf";
import { useResearchWorkspace, type ResearchTypeFilter } from "./research/useResearchWorkspace";

export default function ResearchView() {
  const ws = useResearchWorkspace();

  const currentScopeTitle = ws.titleOf(
    ws.scope === "all" || ws.scope === "shared" ? undefined : ws.scope,
  );

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
              Material that informs the work: beat sheets, field guides, field notes — and a
              screenplay shelf.
            </p>
          </div>
          <div className="tln-library__actions rs-head__actions">
            <div className="rs-scope-filter" title="Filter research by story scope">
              <FolderOpen size={15} className="rs-scope-filter__icon" aria-hidden="true" />
              <select
                className="rs-scope-filter__select"
                aria-label="Which story"
                value={ws.scope}
                onChange={(e) => {
                  ws.setChosen(true);
                  ws.setScope(e.target.value);
                }}
              >
                <option value="all">All Stories</option>
                <option value="shared">Shared across stories</option>
                {ws.projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="rs-scope-filter__arrow" aria-hidden="true" />
            </div>
          </div>
        </header>

        {/* Sub-tabs: the writer's own collection vs the Telugu study shelf. */}
        <div className="rs-tabs" role="tablist" aria-label="Research sections">
          <button
            role="tab"
            aria-selected={ws.section === "collection"}
            className={`rs-filter-btn${ws.section === "collection" ? " rs-filter-btn--active" : ""}`}
            onClick={() => ws.setSection("collection")}
          >
            <span>My research</span>
            <span className="rs-filter-count">{ws.inScope.length}</span>
          </button>
          <button
            role="tab"
            aria-selected={ws.section === "telugu"}
            className={`rs-filter-btn${ws.section === "telugu" ? " rs-filter-btn--active" : ""}`}
            onClick={() => ws.setSection("telugu")}
          >
            <Clapperboard size={13} aria-hidden="true" />
            <span>Shelf</span>
            <span className="rs-filter-count">{SHELF_ITEMS.length}</span>
          </button>
        </div>

        {ws.section === "collection" && (
          <>
            {/* Beat sheet scaffolds */}
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
                    onClick={() => ws.applySheet(b.id)}
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

            {/* Field guides reader */}
            <GuideReader
              guideId={ws.guideId}
              onToggleGuide={ws.setGuideId}
              onSaveGuide={ws.saveGuide}
              scopeTitle={currentScopeTitle}
            />

            {/* Reference quick-capture composer */}
            <ReferenceComposer
              inputRef={ws.composerInputRef}
              draft={ws.draft}
              draftNote={ws.draftNote}
              captureActive={ws.captureActive}
              scopeTitle={currentScopeTitle}
              isScoped={ws.scope !== "all" && ws.scope !== "shared"}
              onDraftChange={ws.setDraft}
              onDraftNoteChange={ws.setDraftNote}
              onCaptureActiveChange={ws.setCaptureActive}
              onSubmit={ws.add}
              onClear={() => {
                ws.setDraft("");
                ws.setDraftNote("");
                ws.setCaptureActive(false);
              }}
            />

            {/* Search and type filters */}
            {ws.references.length > 0 && (
              <div className="rs-toolbar">
                <div className="rs-search">
                  <Search size={14} className="rs-search__icon" aria-hidden="true" />
                  <input
                    className="rs-search__input"
                    placeholder="Search research, beats, notes…"
                    value={ws.query}
                    onChange={(e) => ws.setQuery(e.target.value)}
                    aria-label="Search research"
                  />
                  {ws.query && (
                    <button
                      className="rs-search__clear"
                      onClick={() => ws.setQuery("")}
                      aria-label="Clear search"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
                <div className="rs-filters">
                  {(
                    [
                      { id: "all", label: "All", count: ws.counts.all },
                      { id: "beats", label: "Beat Sheets", count: ws.counts.beats },
                      { id: "notes", label: "Notes", count: ws.counts.notes },
                      { id: "links", label: "Links", count: ws.counts.links },
                      { id: "files", label: "Files", count: ws.counts.files },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.id}
                      className={`rs-filter-btn${ws.typeFilter === f.id ? " rs-filter-btn--active" : ""}`}
                      onClick={() => ws.setTypeFilter(f.id as ResearchTypeFilter)}
                    >
                      <span>{f.label}</span>
                      <span className="rs-filter-count">{f.count}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {ws.problem && (
              <p className="tln-library__error" role="alert">
                {ws.problem}
              </p>
            )}

            {ws.references.length === 0 ? (
              <section
                className="tln-library__welcome rs-welcome"
                aria-labelledby="rs-welcome-title"
              >
                <div className="tln-library__welcome-copy">
                  <Compass size={32} strokeWidth={1.25} aria-hidden="true" />
                  <h2 id="rs-welcome-title">
                    Every story is built
                    <br />
                    on research.
                  </h2>
                  <p>
                    Collect field notes, interview quotes, articles, and photographs—or scaffold
                    your structure from proven screenplay beat sheets.
                  </p>
                  <div className="rs-welcome__actions">
                    <button
                      className="tln-btn tln-btn--accent"
                      onClick={() => ws.applySheet("save-the-cat")}
                    >
                      <Sparkles size={14} aria-hidden="true" /> Start with Save the Cat
                    </button>
                  </div>
                </div>
              </section>
            ) : ws.shown.length === 0 ? (
              <div className="rs-empty">
                <h2>No research matching your filter</h2>
                <p>
                  {ws.query
                    ? `Nothing found matching “${ws.query}”. Try adjusting your search or clearing the filter.`
                    : "No items match the currently selected story or type filter."}
                </p>
                <button
                  className="tln-btn"
                  onClick={() => {
                    ws.setQuery("");
                    ws.setTypeFilter("all");
                    ws.setScope("all");
                  }}
                >
                  Reset all filters
                </button>
              </div>
            ) : (
              <ul className="tln-seeds rs-list">
                {ws.shown.map((r) => (
                  <ReferenceCard
                    key={r.id}
                    reference={r}
                    open={ws.openId === r.id}
                    onToggleOpen={() => ws.setOpenId(ws.openId === r.id ? null : r.id)}
                    projects={ws.projects}
                    scenes={r.parentId ? (ws.scenesByProject[r.parentId] ?? []) : []}
                    presenceMap={ws.present}
                    onPatch={ws.patchReference}
                    onDelete={ws.deleteReference}
                    onAttach={ws.attach}
                  />
                ))}
              </ul>
            )}
          </>
        )}

        {ws.section === "telugu" && (
          <ResearchShelf
            shelfWhat={ws.shelfWhat}
            shelfLang={ws.shelfLang}
            onShelfWhatChange={ws.setShelfWhat}
            onShelfLangChange={ws.setShelfLang}
            activeScriptId={ws.teluguId}
            activeBookId={ws.bookId}
            onToggleScript={ws.setTeluguId}
            onToggleBook={ws.setBookId}
            onSaveScript={ws.saveTelugu}
            onSaveBook={ws.saveBook}
            scopeTitle={currentScopeTitle}
          />
        )}
      </div>
    </main>
  );
}
