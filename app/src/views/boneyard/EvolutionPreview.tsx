import { useState, useRef, useEffect } from "react";
import { useGraphStore } from "../../store";
import { uuidv7 } from "../../data/uuid";
import { ideaLabel } from "../../data/boneyard/repository";
import type { BoneyardController } from "./useBoneyard";

export function EvolutionPreview({
  sourceIds,
  by,
  onClose,
  onGrown,
}: {
  sourceIds: string[];
  by: BoneyardController;
  onClose: () => void;
  onGrown: (id: string) => void;
}) {
  const sources = by.snapshot.ideas.filter((i) => sourceIds.includes(i.id));
  const projects = useGraphStore((s) => s.projects);
  const [title, setTitle] = useState(sources.length === 1 ? ideaLabel(sources[0]!) : "");
  const [summary, setSummary] = useState(sources.map((i) => i.body).join("\n\n"));
  const [destination, setDestination] = useState("");
  const [result, setResult] = useState("");
  const [operationId] = useState(uuidv7);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="by-evolve"
      onCancel={(event) => {
        if (by.pending) event.preventDefault();
        else onClose();
      }}
    >
      <h2>
        {result ? "The idea has somewhere new to go." : "Evolve without leaving the idea behind"}
      </h2>
      {result ? (
        <>
          <p>Your original ideas and thoughts are still here.</p>
          <div className="by-actions">
            <button className="tln-btn tln-btn--accent" onClick={() => onGrown(result)}>
              Open story
            </button>
            <button className="tln-btn" onClick={onClose}>
              Keep exploring
            </button>
          </div>
        </>
      ) : (
        <>
          <p>
            {sources.length} source idea{sources.length === 1 ? "" : "s"}. Review the material
            before creating anything.
          </p>
          <ul>
            {sources.map((i) => (
              <li key={i.id}>{ideaLabel(i)}</li>
            ))}
          </ul>
          <label>
            Destination
            <select
              aria-label="Evolution destination"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
            >
              <option value="">Create a new story</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            {destination ? "Reference title" : "Story title"}
            <input
              aria-label="Evolution title"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label>
            Material to bring across
            <textarea
              aria-label="Evolution summary"
              rows={7}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
          </label>
          <p className="by-meta">
            {destination
              ? "Adds an idea reference to this story. Existing scenes stay as they are."
              : "Starts a story with this summary. Follow-up thoughts stay in Boneyard."}
          </p>
          {by.error && (
            <p role="alert" className="by-error">
              {by.error}
            </p>
          )}
          <div className="by-actions">
            <button
              className="tln-btn tln-btn--accent"
              disabled={by.pending || !title.trim()}
              onClick={() =>
                void by.run(async () => {
                  setResult(
                    await by.evolve({
                      operationId,
                      sourceIds,
                      title,
                      summary,
                      ...(destination ? { destinationId: destination } : {}),
                    }),
                  );
                })
              }
            >
              {by.pending ? "Creating…" : "Confirm evolution"}
            </button>
            <button className="tln-btn" disabled={by.pending} onClick={onClose}>
              Cancel
            </button>
          </div>
        </>
      )}
    </dialog>
  );
}
