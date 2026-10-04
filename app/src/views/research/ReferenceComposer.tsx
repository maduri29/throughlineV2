import { type RefObject } from "react";
import { Plus } from "lucide-react";

interface ReferenceComposerProps {
  inputRef: RefObject<HTMLInputElement | null>;
  draft: string;
  draftNote: string;
  captureActive: boolean;
  scopeTitle: string;
  isScoped: boolean;
  onDraftChange: (value: string) => void;
  onDraftNoteChange: (value: string) => void;
  onCaptureActiveChange: (active: boolean) => void;
  onSubmit: () => void;
  onClear: () => void;
}

export function ReferenceComposer({
  inputRef,
  draft,
  draftNote,
  captureActive,
  scopeTitle,
  isScoped,
  onDraftChange,
  onDraftNoteChange,
  onCaptureActiveChange,
  onSubmit,
  onClear,
}: ReferenceComposerProps) {
  const isExpanded = captureActive || draft.trim().length > 0;

  return (
    <div className={`tln-jot rs-capture${isExpanded ? " rs-capture--active" : ""}`}>
      <div className="rs-capture__top">
        <div className="rs-capture__input-wrap">
          <span className="rs-capture__icon-wrap">
            <Plus size={16} aria-hidden="true" />
          </span>
          <input
            ref={inputRef}
            className="tln-jot__input rs-capture__input"
            placeholder={
              !isScoped
                ? "Title or topic to research (e.g. 1970s dial telephones, Detective interview)…"
                : `Title or topic for “${scopeTitle}”…`
            }
            aria-label="New research item"
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            onFocus={() => onCaptureActiveChange(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSubmit();
              }
            }}
          />
        </div>
        <button
          className="tln-btn tln-btn--accent rs-capture__btn"
          onClick={onSubmit}
          title={draft.trim() ? "Add research note (Enter)" : "Click to type and add note"}
        >
          <Plus size={15} aria-hidden="true" /> Add note
        </button>
      </div>

      {isExpanded && (
        <div className="rs-capture__expanded">
          <textarea
            className="rs-capture__textarea"
            placeholder="Initial notes, quotes, observations, or paste a link (optional)…"
            rows={2}
            value={draftNote}
            onChange={(e) => onDraftNoteChange(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                onSubmit();
              }
            }}
          />
          <div className="rs-capture__meta-row">
            <span className="rs-capture__scope-tag">
              Filing to: <strong>{scopeTitle}</strong>
            </span>
            <div className="rs-capture__hints">
              <span className="rs-capture__hint">Press Enter to add</span>
              <button
                type="button"
                className="tln-btn tln-btn--quiet rs-capture__cancel"
                onClick={onClear}
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
