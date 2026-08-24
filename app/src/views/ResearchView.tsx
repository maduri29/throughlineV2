// Research: material collected about the work rather than part of it.
//
// Two kinds live here and the distinction is the whole design. Material tied to
// one story sits under it; beat sheets, style notes and anything reusable sits
// loose and is shared by every story. Forcing everything to belong to a project
// would mean copying a beat sheet each time, and forcing nothing to would lose
// the association that makes a reference worth keeping at all.
import { useEffect, useState } from "react";
import { BEAT_SHEETS, beatSheetBody } from "../data/beatsheets";
import { describeSize, hasBytes, MAX_FILE_BYTES, openAttachment, putFile } from "../data/files";
import { useGraphStore } from "../store";
import type { Attachment, GraphNode } from "../types";

export default function ResearchView() {
  const references = useGraphStore((s) => s.references);
  const projects = useGraphStore((s) => s.projects);
  const addReference = useGraphStore((s) => s.addReference);
  const patchReference = useGraphStore((s) => s.patchReference);
  const deleteReference = useGraphStore((s) => s.deleteReference);

  const [scope, setScope] = useState<string>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [present, setPresent] = useState<Record<string, boolean>>({});

  // Which attachments actually have bytes on this device. Recorded metadata
  // travels with the story; the file itself does not (data/files.ts).
  useEffect(() => {
    let live = true;
    void (async () => {
      const next: Record<string, boolean> = {};
      for (const r of references) {
        for (const a of r.attachments ?? []) next[a.id] = await hasBytes(a.id);
      }
      if (live) setPresent(next);
    })();
    return () => {
      live = false;
    };
  }, [references]);

  const shown = references.filter((r) =>
    scope === "all" ? true : scope === "shared" ? !r.parentId : r.parentId === scope,
  );
  const titleOf = (id: string | undefined): string =>
    projects.find((p) => p.id === id)?.title ?? "Shared";

  const add = (): void => {
    const t = draft.trim();
    if (!t) return;
    void addReference(t, scope === "all" || scope === "shared" ? null : scope);
    setDraft("");
  };

  const applySheet = (sheetId: string): void => {
    const sheet = BEAT_SHEETS.find((b) => b.id === sheetId);
    if (!sheet) return;
    void addReference(sheet.name, scope === "all" || scope === "shared" ? null : scope, {
      synopsis: beatSheetBody(sheet),
    }).then(setOpenId);
  };

  const attach = async (ref: GraphNode, file: File): Promise<void> => {
    if (file.size > MAX_FILE_BYTES) {
      setProblem(
        `${file.name} is ${describeSize(file.size)}; the limit is ${describeSize(MAX_FILE_BYTES)}.`,
      );
      return;
    }
    setProblem(null);
    const meta: Attachment = {
      id: crypto.randomUUID(),
      name: file.name,
      mime: file.type,
      size: file.size,
    };
    // Bytes first: a record pointing at nothing is worse than no record.
    await putFile(meta.id, file);
    await patchReference(ref.id, { attachments: [...(ref.attachments ?? []), meta] });
    setPresent((p) => ({ ...p, [meta.id]: true }));
  };

  return (
    <div className="tln-library">
      <header className="tln-library__head">
        <div>
          <h1 className="tln-library__title">Research</h1>
          <p className="tln-library__count">
            {references.length === 0
              ? "Nothing collected yet"
              : `${references.length} item${references.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <div className="tln-library__actions">
          <select
            className="tln-select"
            aria-label="Which story"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
          >
            <option value="all">Everything</option>
            <option value="shared">Shared across stories</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </div>
      </header>

      <div className="tln-jot">
        <input
          className="tln-jot__input"
          placeholder={
            scope === "all" || scope === "shared"
              ? "A note, a link, something worth keeping…"
              : `Something for “${titleOf(scope)}”…`
          }
          aria-label="New research item"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") add();
          }}
        />
        <button className="tln-btn tln-btn--accent" disabled={!draft.trim()} onClick={add}>
          Add
        </button>
      </div>

      {/* Prompts, not doctrine. Applying one makes a note to fill in — it does
          not create scenes, because that commits the story to a shape before
          anything is written. */}
      <div className="tln-sheets">
        <span className="tln-sheets__label">Start from a beat sheet</span>
        {BEAT_SHEETS.map((b) => (
          <button key={b.id} className="tln-btn" title={b.source} onClick={() => applySheet(b.id)}>
            {b.name}
          </button>
        ))}
      </div>

      {problem && <p className="tln-library__error">{problem}</p>}

      {shown.length === 0 ? (
        <p className="tln-boneyard__empty">
          Anything that informs the work but is not the work: interviews, photographs, a structure
          you want to try, a paragraph you cannot stop thinking about.
        </p>
      ) : (
        <ul className="tln-seeds">
          {shown.map((r) => {
            const open = openId === r.id;
            return (
              <li key={r.id} className={`tln-seed${open ? " tln-seed--open" : ""}`}>
                <div className="tln-seed__row">
                  <button className="tln-seed__title" onClick={() => setOpenId(open ? null : r.id)}>
                    {r.title}
                  </button>
                  <span className="tln-ref__scope">{titleOf(r.parentId)}</span>
                  <button
                    className="tln-btn tln-btn--quiet"
                    onClick={() => void deleteReference(r.id)}
                    title="Delete this and any files kept with it"
                  >
                    ✕
                  </button>
                </div>

                {(r.attachments?.length ?? 0) > 0 && (
                  <div className="tln-ref__files">
                    {(r.attachments ?? []).map((a) => (
                      <button
                        key={a.id}
                        className={`tln-ref__file${present[a.id] ? "" : " tln-ref__file--absent"}`}
                        disabled={!present[a.id]}
                        onClick={() => void openAttachment(a)}
                        title={
                          present[a.id]
                            ? `Open ${a.name}`
                            : "Recorded on another device — the file itself is not on this one"
                        }
                      >
                        {a.name} · {describeSize(a.size)}
                        {present[a.id] ? "" : " · elsewhere"}
                      </button>
                    ))}
                  </div>
                )}

                {open && (
                  <>
                    <input
                      className="tln-ref__url"
                      placeholder="https://… (optional)"
                      aria-label="Source link"
                      value={r.url ?? ""}
                      onChange={(e) => void patchReference(r.id, { url: e.target.value })}
                    />
                    <textarea
                      className="tln-seed__note"
                      rows={8}
                      placeholder="Notes, quotes, a beat sheet you are filling in…"
                      value={r.synopsis ?? ""}
                      onChange={(e) => void patchReference(r.id, { synopsis: e.target.value })}
                    />
                    <div className="tln-ref__row">
                      <label className="tln-btn">
                        Attach a file…
                        <input
                          type="file"
                          hidden
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            e.target.value = "";
                            if (f) void attach(r, f);
                          }}
                        />
                      </label>
                      {r.url ? (
                        <a
                          className="tln-btn"
                          href={r.url}
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                          Open link
                        </a>
                      ) : null}
                      <span className="tln-ref__hint">
                        Files stay on this device. Notes and links follow the story everywhere.
                      </span>
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
