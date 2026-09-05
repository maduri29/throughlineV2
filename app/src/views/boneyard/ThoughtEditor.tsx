import { revisionHeads } from "../../data/boneyard/repository";
import { useState, useRef, useEffect } from "react";
import type { Thought } from "../../data/boneyard/types";
import type { BoneyardController } from "./useBoneyard";
import { useDraft, DraftWarning, date } from "./Draft";

export function ThoughtEditor({ entry, by }: { entry: Thought; by: BoneyardController }) {
  const draft = useDraft(`throughline:thought:${entry.id}`, entry.body);
  const [editing, setEditing] = useState(false);
  const basis = useRef(revisionHeads(by.snapshot.revisions, entry.id).map((r) => r.id));
  useEffect(() => {
    if (!editing) basis.current = revisionHeads(by.snapshot.revisions, entry.id).map((r) => r.id);
  }, [editing, entry.id, by.snapshot.revisions]);
  return (
    <article className="by-thought">
      <p className="by-meta">
        {date(entry.createdAt)} {entry.updatedAt > entry.createdAt ? "· edited" : ""}{" "}
        {entry.deleted ? "· removed" : ""}
      </p>
      {editing ? (
        <>
          <textarea
            aria-label="Edit thought"
            value={draft.text}
            onChange={(e) => draft.setText(e.target.value)}
          />
          <DraftWarning show={draft.draftError} />
          <button
            className="tln-btn"
            disabled={by.pending || !draft.text.trim()}
            onClick={() =>
              void by
                .run(() => by.editThought(entry.id, draft.text, false, basis.current))
                .then((ok) => {
                  if (ok) {
                    draft.markSaved();
                    setEditing(false);
                  }
                })
            }
          >
            Save thought
          </button>
        </>
      ) : (
        <p className="by-prose">{entry.body}</p>
      )}
      <div className="by-actions">
        {!entry.deleted && (
          <button className="tln-btn" onClick={() => setEditing(!editing)}>
            {editing ? "Cancel edit" : "Edit thought"}
          </button>
        )}
        <button
          className="tln-btn"
          disabled={by.pending}
          onClick={() => void by.run(() => by.editThought(entry.id, entry.body, !entry.deleted))}
        >
          {entry.deleted ? "Restore thought" : "Remove thought"}
        </button>
      </div>
    </article>
  );
}
