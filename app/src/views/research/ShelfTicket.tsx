import {
  shelfCategoryLabel,
  type SeriesSpotlight,
  type ShelfBook,
  type TeluguScript,
} from "../../data/teluguScripts";

const flipKeys =
  (flip: () => void) =>
  (e: {
    key: string;
    target: EventTarget | null;
    currentTarget: EventTarget | null;
    preventDefault: () => void;
  }) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      flip();
    }
  };

interface ShelfBookTicketProps {
  book: ShelfBook;
  flipped: boolean;
  onFlip: () => void;
  onSave: (bookId: string) => void;
  scopeTitle: string;
}

export function ShelfBookTicket({
  book,
  flipped,
  onFlip,
  onSave,
  scopeTitle,
}: ShelfBookTicketProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-expanded={flipped}
      aria-label={`${book.title} — flip for details`}
      title={`${book.title} — ${book.author}`}
      className={`tln-btn rs-blueprint-card rs-ticket${flipped ? " rs-ticket--flip" : ""}`}
      onClick={onFlip}
      onKeyDown={flipKeys(onFlip)}
    >
      <div className="rs-ticket__face rs-ticket__front" aria-hidden={flipped}>
        <span className="rs-ticket__poster" aria-hidden="true">
          {book.title.charAt(0)}
          {book.posterUrl && (
            <img
              src={book.posterUrl}
              alt=""
              loading="lazy"
              onError={(e) => e.currentTarget.remove()}
            />
          )}
        </span>
        <span className="rs-ticket__main">
          <span className="rs-ticket__title">
            {book.title} <span>· {book.year}</span>
          </span>
          <span className="rs-ticket__by">{book.author}</span>
          <span className="rs-ticket__chips">
            <span className="rs-chip">{book.lang} · Books</span>
            <span className="rs-chip">{book.detail}</span>
          </span>
        </span>
        <span className="rs-ticket__stub" aria-hidden="true">
          <small>READ</small>
          <b>BOOK</b>
        </span>
      </div>
      <div className="rs-ticket__face rs-ticket__back" aria-hidden={!flipped}>
        <p className="rs-ticket__kicker">
          {book.lang} · Books · {book.source}
        </p>
        <p className="rs-ticket__meta">
          {book.author} · {book.year} · {book.detail}
        </p>
        <p className="rs-ticket__log">{book.blurb}</p>
        <p className="rs-ticket__why">
          <b>Why read it:</b> {book.why}
        </p>
        <div className="rs-ticket__actions">
          <a
            className="tln-btn tln-btn--accent"
            href={book.pageUrl}
            target="_blank"
            rel="noreferrer noopener"
            onClick={(e) => e.stopPropagation()}
          >
            Open book page ↗
          </a>
          <button
            className="tln-btn"
            title={`Save as note to ${scopeTitle}`}
            onClick={(e) => {
              e.stopPropagation();
              onSave(book.id);
            }}
          >
            + Save
          </button>
        </div>
      </div>
    </div>
  );
}

interface ShelfScriptTicketProps {
  script: TeluguScript | SeriesSpotlight;
  flipped: boolean;
  onFlip: () => void;
  onSave: (scriptId: string) => void;
  scopeTitle: string;
}

export function ShelfScriptTicket({
  script,
  flipped,
  onFlip,
  onSave,
  scopeTitle,
}: ShelfScriptTicketProps) {
  const cat = shelfCategoryLabel(script);
  return (
    <div
      role="button"
      tabIndex={0}
      aria-expanded={flipped}
      aria-label={`${script.title} (${script.year}) — flip for details`}
      title={`${script.title} (${script.year}) — ${script.format}`}
      className={`tln-btn rs-blueprint-card rs-ticket${flipped ? " rs-ticket--flip" : ""}`}
      onClick={onFlip}
      onKeyDown={flipKeys(onFlip)}
    >
      <div className="rs-ticket__face rs-ticket__front" aria-hidden={flipped}>
        <span className="rs-ticket__poster" aria-hidden="true">
          {script.title.charAt(0)}
          {script.posterUrl && (
            <img
              src={script.posterUrl}
              alt=""
              loading="lazy"
              onError={(e) => e.currentTarget.remove()}
            />
          )}
        </span>
        <span className="rs-ticket__main">
          <span className="rs-ticket__title">
            {script.title} <span>· {script.year}</span>
          </span>
          <span className="rs-ticket__by">{script.writer}</span>
          <span className="rs-ticket__chips">
            <span className="rs-chip">{cat}</span>
            <span className="rs-chip">{script.format}</span>
          </span>
        </span>
        <span className="rs-ticket__stub" aria-hidden="true">
          <small>{"episodes" in script ? "EPs" : "READ"}</small>
          <b>{"episodes" in script ? script.episodes : script.year}</b>
        </span>
      </div>
      <div className="rs-ticket__face rs-ticket__back" aria-hidden={!flipped}>
        <p className="rs-ticket__kicker">
          {cat} · {script.source}
        </p>
        <p className="rs-ticket__meta">Directed by {script.director}</p>
        <p className="rs-ticket__log">{script.logline}</p>
        <p className="rs-ticket__why">
          <b>Why study it:</b> {script.studyNote}
        </p>
        <div className="rs-ticket__actions">
          <a
            className="tln-btn tln-btn--accent"
            href={script.pageUrl}
            target="_blank"
            rel="noreferrer noopener"
            onClick={(e) => e.stopPropagation()}
          >
            Open script ↗
          </a>
          {script.pdfUrl && script.pdfUrl !== script.pageUrl && (
            <a
              className="tln-btn"
              href={script.pdfUrl}
              target="_blank"
              rel="noreferrer noopener"
              onClick={(e) => e.stopPropagation()}
            >
              PDF
            </a>
          )}
          <button
            className="tln-btn"
            title={`Save as note to ${scopeTitle}`}
            onClick={(e) => {
              e.stopPropagation();
              onSave(script.id);
            }}
          >
            + Save
          </button>
        </div>
      </div>
    </div>
  );
}
