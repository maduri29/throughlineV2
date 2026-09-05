import { useState, useRef, useEffect } from "react";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { useGraphStore } from "../../store";
import { ideaLabel, revisionHeads } from "../../data/boneyard/repository";
import type { Idea } from "../../data/boneyard/types";
import type { BoneyardController } from "./useBoneyard";
import { useDraft, DraftWarning, date } from "./Draft";
import { ThoughtEditor } from "./ThoughtEditor";

export function IdeaDetail({
  idea,
  by,
  onClose,
  onOpen,
  onEvolve,
  onGrown,
}: {
  idea: Idea;
  by: BoneyardController;
  onClose: () => void;
  onOpen: (id: string) => void;
  onEvolve: () => void;
  onGrown: (id: string) => void;
}) {
  const body = useDraft(`throughline:idea:${idea.id}:body`, idea.body);
  const thought = useDraft(`throughline:idea:${idea.id}:thought`);
  const [title, setTitle] = useState(idea.title);
  const [tags, setTags] = useState(idea.tags.join(", "));
  const [connectId, setConnectId] = useState("");
  const [connectionNote, setConnectionNote] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const initialBody = useRef(idea.body);
  const basis = useRef(revisionHeads(by.snapshot.revisions, idea.id).map((r) => r.id));
  useEffect(() => {
    if (idea.body === initialBody.current)
      basis.current = revisionHeads(by.snapshot.revisions, idea.id).map((r) => r.id);
  }, [idea.body, idea.id, by.snapshot.revisions]);
  const projects = useGraphStore((s) => s.projects);
  const thoughts = by.snapshot.thoughts.filter(
    (t) => t.ideaId === idea.id && (showDeleted || !t.deleted),
  );
  const connections = by.snapshot.connections.filter(
    (c) => !c.deleted && (c.from === idea.id || c.to === idea.id),
  );
  const history = by.snapshot.revisions
    .filter((r) => r.entityId === idea.id && r.kind === "idea")
    .sort((a, b) => b.at - a.at);
  const conflicts = by.snapshot.conflicts.filter(
    (c) =>
      c.entityId === idea.id ||
      by.snapshot.thoughts.some((t) => t.id === c.entityId && t.ideaId === idea.id),
  );
  return (
    <section className="by-detail" aria-label="Idea details">
      <div className="by-detail__head">
        <button className="tln-btn by-back" onClick={onClose}>
          <ArrowLeft size={16} /> Back to ideas
        </button>
        <span className="by-meta">{date(idea.createdAt)}</span>
      </div>
      <h2 className="by-detail__title">{ideaLabel(idea)}</h2>
      {conflicts.map((conflict) => (
        <section key={conflict.entityId} className="by-conflict" role="alert">
          <h3>Two versions need your choice</h3>
          <p>Both versions are preserved. Choose one to continue, or copy text from both first.</p>
          {conflict.versions.map((version) => (
            <div key={version.id}>
              <pre>
                {"body" in version.value ? version.value.body : JSON.stringify(version.value)}
              </pre>
              <button
                className="tln-btn"
                disabled={by.pending}
                onClick={() =>
                  void by
                    .run(() => by.resolve(version))
                    .then(async (ok) => {
                      if (ok && version.kind === "idea") {
                        basis.current = await by.currentParents(idea.id);
                        initialBody.current = version.value.body;
                        body.setText(version.value.body);
                        body.markSaved();
                        setTitle(version.value.title);
                        setTags(version.value.tags.join(", "));
                      }
                    })
                }
              >
                Keep this version
              </button>
            </div>
          ))}
        </section>
      ))}
      <label>
        Optional title
        <input
          aria-label="Idea title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Name it when you’re ready"
        />
      </label>
      <label>
        The idea
        <textarea
          aria-label="Idea body"
          rows={7}
          value={body.text}
          onChange={(e) => body.setText(e.target.value)}
        />
      </label>
      <DraftWarning show={body.draftError} />
      <label>
        Optional tags
        <input
          aria-label="Idea tags"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="Separate tags with commas"
        />
      </label>
      <div className="by-actions">
        <button
          className="tln-btn tln-btn--accent"
          disabled={by.pending || !body.text.trim()}
          onClick={() =>
            void by
              .run(() =>
                by.editIdea(
                  idea.id,
                  {
                    title,
                    body: body.text,
                    tags: [
                      ...new Set(
                        tags
                          .split(",")
                          .map((t) => t.trim())
                          .filter(Boolean),
                      ),
                    ],
                  },
                  basis.current,
                ),
              )
              .then(async (ok) => {
                if (ok) {
                  basis.current = await by.currentParents(idea.id);
                  initialBody.current = body.text;
                  body.markSaved();
                }
              })
          }
        >
          Save idea
        </button>
        <button className="tln-btn" disabled={by.pending} onClick={onEvolve}>
          Evolve idea
        </button>
      </div>
      <details className="by-revisions">
        <summary>Original capture & saved versions</summary>
        <h3>Original capture</h3>
        <p className="by-prose">{idea.original}</p>
        {history.slice(0, 20).map((version) => (
          <div key={version.id}>
            <span className="by-meta">{date(version.at)}</span>
            <p className="by-prose">{version.kind === "idea" ? version.value.body : ""}</p>
            <button
              className="tln-btn"
              disabled={by.pending}
              onClick={() =>
                void by
                  .run(() => by.restoreRevision(version))
                  .then(async (ok) => {
                    if (ok && version.kind === "idea") {
                      basis.current = await by.currentParents(idea.id);
                      initialBody.current = version.value.body;
                      body.setText(version.value.body);
                      body.markSaved();
                      setTitle(version.value.title);
                      setTags(version.value.tags.join(", "));
                    }
                  })
              }
            >
              Restore this version
            </button>
          </div>
        ))}
      </details>
      <section className="by-thoughts">
        <h3>Let the thought continue</h3>
        <textarea
          aria-label="Add a thought"
          placeholder="A new angle, a question, something you noticed…"
          value={thought.text}
          onChange={(e) => thought.setText(e.target.value)}
          rows={3}
        />
        <DraftWarning show={thought.draftError} />
        <button
          className="tln-btn"
          disabled={by.pending || !thought.text.trim()}
          onClick={() =>
            void by
              .run(() => by.addThought(idea.id, thought.text))
              .then(async (ok) => {
                if (ok) thought.setText("");
              })
          }
        >
          Add thought
        </button>
        {thoughts.map((entry) => (
          <ThoughtEditor key={entry.id} entry={entry} by={by} />
        ))}
        <label className="by-select">
          <input
            type="checkbox"
            checked={showDeleted}
            onChange={(e) => setShowDeleted(e.target.checked)}
          />{" "}
          Show removed thoughts
        </label>
      </section>
      <details>
        <summary>Explore this idea</summary>
        <ul>
          <li>What interests you here?</li>
          <li>What is missing?</li>
          <li>What changes if the opposite is true?</li>
        </ul>
      </details>
      <section>
        <h3>Collections</h3>
        {by.snapshot.collections
          .filter((c) => !c.deleted)
          .map((c) => (
            <label className="by-select" key={c.id}>
              <input
                type="checkbox"
                disabled={by.pending}
                checked={by.snapshot.memberships.some(
                  (m) => !m.deleted && m.ideaId === idea.id && m.collectionId === c.id,
                )}
                onChange={(e) =>
                  void by.run(() => by.setMembership(idea.id, c.id, e.target.checked))
                }
              />{" "}
              {c.title}
            </label>
          ))}
        {!by.snapshot.collections.some((c) => !c.deleted) && (
          <p className="by-meta">Create a collection above to gather related fragments.</p>
        )}
      </section>
      <section>
        <h3>Connected ideas</h3>
        {connections.map((c) => {
          const other = by.snapshot.ideas.find(
            (i) => i.id === (c.from === idea.id ? c.to : c.from),
          );
          return (
            <div key={c.id} className="by-connection">
              <button className="by-text-button" onClick={() => onOpen(other?.id ?? "")}>
                {other ? ideaLabel(other) : "Unavailable idea"}
              </button>
              <p>{c.note}</p>
              <button
                className="tln-btn"
                disabled={by.pending}
                onClick={() => void by.run(() => by.disconnect(c.id))}
              >
                Remove connection
              </button>
            </div>
          );
        })}
        <select
          aria-label="Connect another idea"
          value={connectId}
          onChange={(e) => setConnectId(e.target.value)}
        >
          <option value="">Choose an idea…</option>
          {by.snapshot.ideas
            .filter((i) => i.id !== idea.id && i.disposition !== "trash")
            .map((i) => (
              <option key={i.id} value={i.id}>
                {ideaLabel(i)}
              </option>
            ))}
        </select>
        <input
          aria-label="Connection reason"
          placeholder="What connects them? (optional)"
          value={connectionNote}
          onChange={(e) => setConnectionNote(e.target.value)}
        />
        <button
          className="tln-btn"
          disabled={!connectId || by.pending}
          onClick={() =>
            void by
              .run(() => by.connect(idea.id, connectId, connectionNote))
              .then(async (ok) => {
                if (ok) {
                  setConnectId("");
                  setConnectionNote("");
                }
              })
          }
        >
          Connect ideas
        </button>
      </section>
      <section>
        <h3>Stories this idea inspired</h3>
        {by.snapshot.evolutions
          .filter((e) => e.sourceIds.includes(idea.id))
          .map((e) => (
            <div className="by-connection" key={e.id}>
              <span>{e.destinationTitle}</span>
              {projects.some((p) => p.id === e.destinationId) ? (
                <button className="tln-btn" onClick={() => onGrown(e.destinationId)}>
                  Open story <ArrowUpRight size={14} />
                </button>
              ) : (
                <p className="by-meta">
                  Destination is not on this device. Its source history is preserved.
                </p>
              )}
            </div>
          ))}
      </section>
      <div className="by-actions by-lifecycle">
        <button
          className="tln-btn"
          disabled={by.pending}
          onClick={() =>
            void by.run(() =>
              by.editIdea(idea.id, {
                disposition: idea.disposition === "active" ? "aside" : "active",
              }),
            )
          }
        >
          {idea.disposition === "active" ? "Set aside" : "Restore to ideas"}
        </button>
        <button
          className="tln-btn"
          disabled={by.pending}
          onClick={() =>
            void by.run(() => by.editIdea(idea.id, { snoozedUntil: Date.now() + 7 * 86400000 }))
          }
        >
          Snooze revisit for a week
        </button>
        {idea.disposition !== "trash" && (
          <button
            className="tln-btn"
            disabled={by.pending}
            onClick={() => void by.run(() => by.editIdea(idea.id, { disposition: "trash" }))}
          >
            Move to trash
          </button>
        )}
      </div>
    </section>
  );
}
