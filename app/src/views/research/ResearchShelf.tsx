import { ChevronDown, Clapperboard, Globe } from "lucide-react";
import {
  SHELF_BOOKS,
  SERIES_SPOTLIGHT,
  TELUGU_SCRIPTS,
  type SeriesSpotlight,
  type ShelfBook,
  type ShelfKind,
  type TeluguScript,
  shelfCategoryOf,
} from "../../data/teluguScripts";
import { ShelfBookTicket, ShelfScriptTicket } from "./ShelfTicket";

export const SHELF_ITEMS: (TeluguScript | SeriesSpotlight | ShelfBook)[] = [
  ...TELUGU_SCRIPTS,
  ...SERIES_SPOTLIGHT,
  ...SHELF_BOOKS,
];

const SHELF_KIND_OPTIONS = (["movie", "series", "book"] as const).map((kind) => ({
  key: kind,
  label: kind === "movie" ? "Movies" : kind === "series" ? "Web series" : "Books",
  count: SHELF_ITEMS.filter(
    (t: TeluguScript | SeriesSpotlight | ShelfBook) => shelfCategoryOf(t).kind === kind,
  ).length,
}));

const SHELF_LANG_OPTIONS: { key: string; label: string; count: number }[] = Array.from(
  new Set(
    SHELF_ITEMS.map((t: TeluguScript | SeriesSpotlight | ShelfBook) => shelfCategoryOf(t).lang),
  ),
).map((lang) => ({
  key: lang,
  label: lang,
  count: SHELF_ITEMS.filter(
    (t: TeluguScript | SeriesSpotlight | ShelfBook) => shelfCategoryOf(t).lang === lang,
  ).length,
}));

interface ResearchShelfProps {
  shelfWhat: "all" | ShelfKind;
  shelfLang: string;
  onShelfWhatChange: (what: "all" | ShelfKind) => void;
  onShelfLangChange: (lang: string) => void;
  activeScriptId: string | null;
  activeBookId: string | null;
  onToggleScript: (id: string | null) => void;
  onToggleBook: (id: string | null) => void;
  onSaveScript: (id: string) => void;
  onSaveBook: (id: string) => void;
  scopeTitle: string;
}

export function ResearchShelf({
  shelfWhat,
  shelfLang,
  onShelfWhatChange,
  onShelfLangChange,
  activeScriptId,
  activeBookId,
  onToggleScript,
  onToggleBook,
  onSaveScript,
  onSaveBook,
  scopeTitle,
}: ResearchShelfProps) {
  const inShelf = (t: TeluguScript | SeriesSpotlight | ShelfBook): boolean => {
    const c = shelfCategoryOf(t);
    return (
      (shelfWhat === "all" || c.kind === shelfWhat) && (shelfLang === "all" || c.lang === shelfLang)
    );
  };

  const shelfMovies = TELUGU_SCRIPTS.filter(inShelf);
  const shelfSeries = SERIES_SPOTLIGHT.filter(inShelf);
  const shelfBooks = SHELF_BOOKS.filter(inShelf);
  const shelfVisible = shelfMovies.length + shelfSeries.length + shelfBooks.length;

  return (
    <div className="tln-sheets rs-guides rs-telugu">
      <div className="rs-blueprints__head">
        <span className="tln-sheets__label rs-blueprints__label">
          <Clapperboard size={14} aria-hidden="true" /> Screenplay study shelf
        </span>
        <span className="rs-blueprints__hint">
          Scripts, series and craft books — filter by what and language, open to read.
        </span>
      </div>
      <div className="rs-telugu__filtersbar">
        <div className="rs-telugu__filter">
          <label htmlFor="rs-telugu-what">What</label>
          <div className="rs-scope-filter" title="Show one kind of shelf item">
            <Clapperboard size={15} className="rs-scope-filter__icon" aria-hidden="true" />
            <select
              id="rs-telugu-what"
              className="rs-scope-filter__select"
              aria-label="What kind"
              value={shelfWhat}
              onChange={(e) => onShelfWhatChange(e.target.value as "all" | ShelfKind)}
            >
              <option value="all">Everything ({SHELF_ITEMS.length})</option>
              {SHELF_KIND_OPTIONS.map((k) => (
                <option key={k.key} value={k.key}>
                  {k.label} ({k.count})
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="rs-scope-filter__arrow" aria-hidden="true" />
          </div>
        </div>
        <div className="rs-telugu__filter">
          <label htmlFor="rs-telugu-lang">Language</label>
          <div className="rs-scope-filter" title="Show one language">
            <Globe size={15} className="rs-scope-filter__icon" aria-hidden="true" />
            <select
              id="rs-telugu-lang"
              className="rs-scope-filter__select"
              aria-label="Language"
              value={shelfLang}
              onChange={(e) => onShelfLangChange(e.target.value)}
            >
              <option value="all">All languages ({SHELF_ITEMS.length})</option>
              {SHELF_LANG_OPTIONS.map((l) => (
                <option key={l.key} value={l.key}>
                  {l.label} ({l.count})
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="rs-scope-filter__arrow" aria-hidden="true" />
          </div>
        </div>
        <span className="rs-telugu__count" aria-live="polite">
          Showing <strong>{shelfVisible}</strong> of {SHELF_ITEMS.length}
        </span>
      </div>

      {shelfMovies.length > 0 && (
        <>
          <div className="rs-blueprints__head rs-telugu__sechead">
            <span className="tln-sheets__label rs-blueprints__label">Movies</span>
            <span className="rs-blueprints__hint">
              Shooting scripts & transcripts, shared by makers — free to read.
            </span>
          </div>
          <div className="rs-blueprints__cards">
            {shelfMovies.map((script) => (
              <ShelfScriptTicket
                key={script.id}
                script={script}
                flipped={activeScriptId === script.id}
                onFlip={() => onToggleScript(activeScriptId === script.id ? null : script.id)}
                onSave={onSaveScript}
                scopeTitle={scopeTitle}
              />
            ))}
          </div>
        </>
      )}

      {shelfSeries.length > 0 && (
        <>
          <div className="rs-blueprints__head rs-telugu__sechead">
            <span className="tln-sheets__label rs-blueprints__label">Web series</span>
            <span className="rs-blueprints__hint">
              No Telugu series scripts are shared publicly yet — this Hindi landmark teaches serial
              structure instead.
            </span>
          </div>
          <div className="rs-blueprints__cards">
            {shelfSeries.map((series) => (
              <ShelfScriptTicket
                key={series.id}
                script={series}
                flipped={activeScriptId === series.id}
                onFlip={() => onToggleScript(activeScriptId === series.id ? null : series.id)}
                onSave={onSaveScript}
                scopeTitle={scopeTitle}
              />
            ))}
          </div>
        </>
      )}

      {shelfBooks.length > 0 && (
        <>
          <div className="rs-blueprints__head rs-telugu__sechead">
            <span className="tln-sheets__label rs-blueprints__label">Books</span>
            <span className="rs-blueprints__hint">
              Craft books to own or borrow — publishers and bookshops, never piracy.
            </span>
          </div>
          <div className="rs-blueprints__cards">
            {shelfBooks.map((book) => (
              <ShelfBookTicket
                key={book.id}
                book={book}
                flipped={activeBookId === book.id}
                onFlip={() => onToggleBook(activeBookId === book.id ? null : book.id)}
                onSave={onSaveBook}
                scopeTitle={scopeTitle}
              />
            ))}
          </div>
        </>
      )}

      {shelfVisible === 0 && (
        <div className="rs-empty">
          <h2>Nothing on this shelf combination</h2>
          <p>Try widening the filters — every language pairs with something.</p>
          <button
            className="tln-btn"
            onClick={() => {
              onShelfWhatChange("all");
              onShelfLangChange("all");
            }}
          >
            Reset filters
          </button>
        </div>
      )}
    </div>
  );
}
