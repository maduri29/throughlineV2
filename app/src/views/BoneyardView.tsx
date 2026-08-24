// The boneyard: raw ideas kept before they belong to any project.
//
// This finishes a concept the domain model already had. CONTEXT.md defines a
// Seed as "a raw idea kept before it belongs to any project" and Grew Into as
// "a seed becoming a project or a scene"; the node type, the edge type and its
// legality rules were all in the code, and nothing ever surfaced them.
//
// The design constraint that matters: capture has to cost nothing. An idea you
// have to title, categorise and file is an idea you write down somewhere else.
// So one box, Enter, done — everything else is optional and comes later.
import { useState } from "react";
import { useGraphStore } from "../store";

export default function BoneyardView({ onGrown }: { onGrown: (projectId: string) => void }) {
  const seeds = useGraphStore((s) => s.seeds);
  const addSeed = useGraphStore((s) => s.addSeed);
  const patchSeed = useGraphStore((s) => s.patchSeed);
  const deleteSeed = useGraphStore((s) => s.deleteSeed);
  const growSeed = useGraphStore((s) => s.growSeed);

  const [draft, setDraft] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const jot = (): void => {
    const t = draft.trim();
    if (!t) return;
    void addSeed(t);
    setDraft("");
  };

  return (
    <div className="tln-library">
      <header className="tln-library__head">
        <div>
          <h1 className="tln-library__title">Boneyard</h1>
          <p className="tln-library__count">
            {seeds.length === 0
              ? "Nothing here yet"
              : `${seeds.length} idea${seeds.length === 1 ? "" : "s"} waiting`}
          </p>
        </div>
      </header>

      {/* Capture first, always visible, never behind a button. */}
      <div className="tln-jot">
        <input
          className="tln-jot__input"
          placeholder="A line about something that might be a story…"
          aria-label="New idea"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") jot();
          }}
        />
        <button className="tln-btn tln-btn--accent" disabled={!draft.trim()} onClick={jot}>
          Keep it
        </button>
      </div>

      {seeds.length === 0 ? (
        <p className="tln-boneyard__empty">
          Ideas live here until they are worth building. Nothing kept here belongs to a story yet,
          and nothing here is lost when you decide it is not the one.
        </p>
      ) : (
        <ul className="tln-seeds">
          {seeds.map((s) => {
            const open = openId === s.id;
            return (
              <li key={s.id} className={`tln-seed${open ? " tln-seed--open" : ""}`}>
                <div className="tln-seed__row">
                  <button
                    className="tln-seed__title"
                    onClick={() => setOpenId(open ? null : s.id)}
                    title={open ? "Collapse" : "Add a note"}
                  >
                    {s.title}
                  </button>
                  <button
                    className="tln-btn"
                    onClick={() => void growSeed(s.id).then((id) => id && onGrown(id))}
                    title="Start a story from this idea, keeping the link back to it"
                  >
                    Grow into a story
                  </button>
                  <button
                    className="tln-btn tln-btn--quiet"
                    onClick={() => void deleteSeed(s.id)}
                    title="Throw this idea away"
                  >
                    ✕
                  </button>
                </div>
                {open && (
                  <textarea
                    className="tln-seed__note"
                    rows={4}
                    autoFocus
                    placeholder="What is it? Why might it matter? Anything you would forget by Thursday."
                    value={s.synopsis ?? ""}
                    onChange={(e) => void patchSeed(s.id, { synopsis: e.target.value })}
                  />
                )}
                {!open && s.synopsis ? <p className="tln-seed__preview">{s.synopsis}</p> : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
