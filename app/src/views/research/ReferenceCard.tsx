import { ChevronDown, ExternalLink, FileText, Link2, ListChecks, Paperclip } from "lucide-react";
import { beatProgress } from "../../data/beats";
import { describeSize, openAttachment } from "../../data/files";
import type { Beat, GraphNode } from "../../types";
import BeatSheet from "../BeatSheet";

interface ReferenceCardProps {
  reference: GraphNode;
  open: boolean;
  onToggleOpen: () => void;
  projects: GraphNode[];
  scenes: GraphNode[];
  presenceMap: Record<string, boolean>;
  onPatch: (id: string, patch: Partial<GraphNode>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onAttach: (ref: GraphNode, file: File) => Promise<void>;
}

export function ReferenceCard({
  reference: r,
  open,
  onToggleOpen,
  projects,
  scenes,
  presenceMap,
  onPatch,
  onDelete,
  onAttach,
}: ReferenceCardProps) {
  const isBeatSheet = Boolean(r.beats);
  const hasFiles = (r.attachments?.length ?? 0) > 0;
  const isLink = Boolean(r.url);
  const { done, total } = isBeatSheet ? beatProgress(r.beats!) : { done: 0, total: 0 };

  return (
    <li className={`tln-seed rs-card${open ? " tln-seed--open rs-card--open" : ""}`}>
      <div className="tln-seed__row rs-card__header">
        <span
          className="rs-card__type-badge"
          title={
            isBeatSheet
              ? "Beat Sheet"
              : hasFiles
                ? "Document with Files"
                : isLink
                  ? "Web Reference"
                  : "Research Note"
          }
        >
          {isBeatSheet ? (
            <ListChecks size={15} aria-hidden="true" />
          ) : isLink ? (
            <Link2 size={15} aria-hidden="true" />
          ) : hasFiles ? (
            <Paperclip size={15} aria-hidden="true" />
          ) : (
            <FileText size={15} aria-hidden="true" />
          )}
        </span>

        <div className="rs-card__title-wrap">
          <button className="tln-seed__title rs-card__title" onClick={onToggleOpen}>
            {r.title}
          </button>

          <div className="rs-card__meta-chips">
            {isBeatSheet && (
              <span
                className={`rs-chip${done > 0 && done === total ? " rs-chip--done" : ""}`}
                title={`${done} of ${total} beats completed`}
              >
                {done}/{total} beats
              </span>
            )}
            {hasFiles && (
              <span className="rs-chip" title={`${r.attachments!.length} attachment(s)`}>
                <Paperclip size={11} aria-hidden="true" />
                {r.attachments!.length}
              </span>
            )}
            {isLink && (
              <span className="rs-chip" title={r.url!}>
                <Link2 size={11} aria-hidden="true" />
                {(() => {
                  try {
                    return new URL(r.url!).hostname.replace(/^www\./, "");
                  } catch {
                    return "link";
                  }
                })()}
              </span>
            )}
          </div>
        </div>

        <div className="rs-card__controls">
          <select
            className="tln-ref__scope rs-card__scope-select"
            aria-label={`Which story ${r.title} belongs to`}
            value={r.parentId ?? ""}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => void onPatch(r.id, { parentId: e.target.value || undefined })}
          >
            <option value="">Shared</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>

          <button
            className="tln-btn tln-btn--quiet rs-delete-btn"
            onClick={() => void onDelete(r.id)}
            title="Delete this and any files kept with it"
          >
            ✕
          </button>

          <span className="rs-card__toggle-icon" onClick={onToggleOpen} aria-hidden="true">
            <ChevronDown size={16} />
          </span>
        </div>
      </div>

      {/* Attachments preview on collapsed card if any */}
      {!open && (r.attachments?.length ?? 0) > 0 && (
        <div className="tln-ref__files">
          {(r.attachments ?? []).map((a) => (
            <button
              key={a.id}
              className={`tln-ref__file${presenceMap[a.id] ? "" : " tln-ref__file--absent"}`}
              disabled={!presenceMap[a.id]}
              onClick={() => void openAttachment(a)}
              title={
                presenceMap[a.id]
                  ? `Open ${a.name}`
                  : "Recorded on another device — the file itself is not on this one"
              }
            >
              {a.name} · {describeSize(a.size)}
              {presenceMap[a.id] ? "" : " · elsewhere"}
            </button>
          ))}
        </div>
      )}

      {/* Expanded Body */}
      {open && (
        <div className="rs-card__body">
          {r.beats ? (
            <BeatSheet
              beats={r.beats}
              scenes={scenes}
              onChange={(next: Beat[]) => void onPatch(r.id, { beats: next })}
            />
          ) : null}

          <div className="rs-field">
            <div className="rs-field__header">
              <span className="rs-field__label">
                <Link2 size={13} aria-hidden="true" /> Source Link
              </span>
              {r.url && (
                <a
                  className="tln-btn rs-open-link-btn"
                  href={r.url}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  <ExternalLink size={13} aria-hidden="true" /> Open link
                </a>
              )}
            </div>
            <input
              className="tln-ref__url rs-field-input"
              placeholder="https://… (optional)"
              aria-label="Source link"
              value={r.url ?? ""}
              onChange={(e) => void onPatch(r.id, { url: e.target.value })}
            />
          </div>

          <div className="rs-field">
            <div className="rs-field__header">
              <span className="rs-field__label">
                <FileText size={13} aria-hidden="true" />{" "}
                {r.beats ? "Overall Notes & Thoughts" : "Research Notes & Synthesis"}
              </span>
            </div>
            <textarea
              className="tln-seed__note rs-field-textarea"
              rows={r.beats ? 3 : 7}
              placeholder={
                r.beats
                  ? "Anything about this sheet as a whole…"
                  : "Notes, quotes, takeaways, observations…"
              }
              value={r.synopsis ?? ""}
              onChange={(e) => void onPatch(r.id, { synopsis: e.target.value })}
            />
          </div>

          {(r.attachments?.length ?? 0) > 0 && (
            <div className="tln-ref__files">
              {(r.attachments ?? []).map((a) => (
                <button
                  key={a.id}
                  className={`tln-ref__file${presenceMap[a.id] ? "" : " tln-ref__file--absent"}`}
                  disabled={!presenceMap[a.id]}
                  onClick={() => void openAttachment(a)}
                  title={
                    presenceMap[a.id]
                      ? `Open ${a.name}`
                      : "Recorded on another device — the file itself is not on this one"
                  }
                >
                  {a.name} · {describeSize(a.size)}
                  {presenceMap[a.id] ? "" : " · elsewhere"}
                </button>
              ))}
            </div>
          )}

          <div className="tln-ref__row rs-card__footer">
            <div className="rs-card__footer-actions">
              <label className="tln-btn rs-attach-btn">
                <Paperclip size={14} aria-hidden="true" /> Attach a file…
                <input
                  type="file"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) void onAttach(r, f);
                  }}
                />
              </label>
            </div>
            <span className="tln-ref__hint">
              Files stay on this device. Notes and links follow the story everywhere.
            </span>
          </div>
        </div>
      )}
    </li>
  );
}
