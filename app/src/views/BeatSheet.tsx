// A beat sheet: structured rows, with a text view behind a toggle.
//
// Structured is the source of truth. The text view exists because a sheet is
// sometimes faster to restructure as prose, and it round-trips through
// data/beats.ts, whose tests exist precisely because two representations of one
// thing is the usual way to lose data quietly.
import { useState } from "react";
import { beatProgress, mergeBeats, parseBeats, serializeBeats } from "../data/beats";
import type { Beat, GraphNode } from "../types";

export default function BeatSheet({
  beats,
  scenes,
  onChange,
}: {
  beats: Beat[];
  /** Scenes of the story this sheet belongs to; empty when it is shared. */
  scenes: GraphNode[];
  onChange: (next: Beat[]) => void;
}) {
  const [raw, setRaw] = useState<string | null>(null);
  const { done, total } = beatProgress(beats);

  const set = (id: string, patch: Partial<Beat>): void => {
    onChange(beats.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  };

  return (
    <div className="tln-beats">
      <div className="tln-beats__bar">
        <span className="tln-beats__progress">
          <span
            className="tln-beats__fill"
            style={{ width: total === 0 ? "0%" : `${Math.round((done / total) * 100)}%` }}
          />
        </span>
        <span className="tln-beats__count">
          {done} of {total}
        </span>
        <button
          className="tln-btn"
          onClick={() => {
            // Leaving the text view folds it back in; entering it renders from
            // the structured rows, so the two can never drift apart.
            if (raw === null) setRaw(serializeBeats(beats));
            else {
              onChange(mergeBeats(beats, parseBeats(raw), () => crypto.randomUUID()));
              setRaw(null);
            }
          }}
        >
          {raw === null ? "Edit as text" : "Done editing"}
        </button>
      </div>

      {raw !== null ? (
        <>
          <textarea
            className="tln-beats__raw"
            rows={Math.max(8, beats.length + 2)}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            spellCheck={false}
          />
          <p className="tln-ref__hint">
            One beat per line as <code>- [ ] Name</code>; indent below a line to add a note. Links
            to scenes follow the beat&rsquo;s name, so renaming a beat drops its link rather than
            guessing.
          </p>
        </>
      ) : (
        <ul className="tln-beatlist">
          {beats.map((b) => (
            <li key={b.id} className={`tln-beat${b.done ? " tln-beat--done" : ""}`}>
              <label className="tln-beat__check">
                <input
                  type="checkbox"
                  checked={b.done}
                  onChange={(e) => set(b.id, { done: e.target.checked })}
                  aria-label={b.name}
                />
              </label>
              <div className="tln-beat__body">
                <input
                  className="tln-beat__name"
                  value={b.name}
                  onChange={(e) => set(b.id, { name: e.target.value })}
                  aria-label="Beat name"
                />
                <input
                  className="tln-beat__note"
                  placeholder="What happens here?"
                  value={b.note ?? ""}
                  onChange={(e) => set(b.id, { note: e.target.value })}
                  aria-label={`Note for ${b.name}`}
                />
              </div>
              {/* Links to a scene that already exists; nothing is created here.
                  A sheet that invents scenes puts structure in the story before
                  anything is written. */}
              <select
                className="tln-beat__scene"
                value={b.sceneId ?? ""}
                onChange={(e) => set(b.id, { sceneId: e.target.value || undefined })}
                aria-label={`Scene for ${b.name}`}
                disabled={scenes.length === 0}
                title={
                  scenes.length === 0
                    ? "Attach this sheet to a story to link its scenes"
                    : "The scene that fulfils this beat"
                }
              >
                <option value="">{scenes.length === 0 ? "—" : "Not covered"}</option>
                {scenes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
              <button
                className="tln-btn tln-btn--quiet"
                onClick={() => onChange(beats.filter((x) => x.id !== b.id))}
                title="Remove this beat"
              >
                ✕
              </button>
            </li>
          ))}
          <li className="tln-beats__foot">
            <button
              className="tln-btn"
              onClick={() =>
                onChange([...beats, { id: crypto.randomUUID(), name: "New beat", done: false }])
              }
            >
              Add a beat
            </button>
            {/* Said out loud, not left as a disabled dropdown. A shared sheet
                has no scenes to offer, and a control that is dead with no
                explanation reads as a broken feature. */}
            {scenes.length === 0 && (
              <span className="tln-ref__hint">
                Set this sheet to a story above and each beat can point at the scene that covers it.
              </span>
            )}
          </li>
        </ul>
      )}
    </div>
  );
}
