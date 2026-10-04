import type { RefObject } from "react";
import { Plus } from "lucide-react";
import { DraftWarning } from "./Draft";

export interface IdeaCaptureProps {
  composerRef: RefObject<HTMLTextAreaElement | null>;
  text: string;
  onTextChange: (text: string) => void;
  onCapture: () => void;
  pending: boolean;
  draftError: boolean;
}

export function IdeaCapture({
  composerRef,
  text,
  onTextChange,
  onCapture,
  pending,
  draftError,
}: IdeaCaptureProps) {
  return (
    <section className="by-capture" aria-label="Capture an idea">
      <textarea
        ref={composerRef}
        aria-label="New idea"
        placeholder="Leave a thought here. A line, a question, a whole possibility…"
        value={text}
        onChange={(e) => onTextChange(e.target.value)}
        rows={3}
        disabled={pending}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && !e.nativeEvent.isComposing) {
            e.preventDefault();
            if (text.trim()) void onCapture();
          }
        }}
      />
      <div className="by-capture__actions">
        <span>No title or category needed. Ctrl / ⌘ + Enter to keep.</span>
        <button
          className="tln-btn tln-btn--accent"
          disabled={!text.trim() || pending}
          onClick={() => void onCapture()}
        >
          <Plus size={16} /> {pending ? "Saving…" : "Keep idea"}
        </button>
      </div>
      <DraftWarning show={draftError} />
    </section>
  );
}
