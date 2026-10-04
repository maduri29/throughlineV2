import { BookOpen, ExternalLink, Plus } from "lucide-react";
import { GUIDES } from "../../data/guides";

interface GuideReaderProps {
  guideId: string | null;
  onToggleGuide: (id: string | null) => void;
  onSaveGuide: (id: string) => void;
  scopeTitle: string;
}

export function GuideReader({ guideId, onToggleGuide, onSaveGuide, scopeTitle }: GuideReaderProps) {
  const activeGuide = GUIDES.find((g) => g.id === guideId) ?? null;

  return (
    <div className="tln-sheets rs-guides">
      <div className="rs-blueprints__head">
        <span className="tln-sheets__label rs-blueprints__label">
          <BookOpen size={14} aria-hidden="true" /> Field guides
        </span>
        <span className="rs-blueprints__hint">
          Open one to read, or save it as a note to keep beside the draft.
        </span>
      </div>
      <div className="rs-blueprints__cards">
        {GUIDES.map((g) => (
          <button
            key={g.id}
            className={`tln-btn rs-blueprint-card${guideId === g.id ? " rs-blueprint-card--active" : ""}`}
            title={g.blurb}
            aria-expanded={guideId === g.id}
            onClick={() => onToggleGuide(guideId === g.id ? null : g.id)}
          >
            <BookOpen size={14} className="rs-blueprint-card__icon" aria-hidden="true" />
            <span className="rs-blueprint-card__name">{g.name}</span>
          </button>
        ))}
      </div>
      {activeGuide && (
        <div className="rs-guide-panel">
          <p className="rs-guide-panel__blurb">{activeGuide.blurb}</p>
          <div className="rs-guide-panel__body">{activeGuide.body}</div>
          <div className="rs-guide-panel__actions">
            <button
              className="tln-btn tln-btn--accent"
              onClick={() => onSaveGuide(activeGuide.id)}
              title={`Save “${activeGuide.name}” as a note you can annotate`}
            >
              <Plus size={14} aria-hidden="true" /> Save as note
            </button>
            {(activeGuide.links ?? []).map((l) => (
              <a
                key={l.url}
                className="tln-btn"
                href={l.url}
                target="_blank"
                rel="noreferrer noopener"
              >
                <ExternalLink size={13} aria-hidden="true" /> {l.label}
              </a>
            ))}
            <span className="rs-guide-panel__file-hint">
              Filing to: <strong>{scopeTitle}</strong>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
