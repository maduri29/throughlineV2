import { useRouter } from "next/navigation";
import { Activity, Cloud, CloudCheck, Laptop, RefreshCw } from "lucide-react";
import ScriptDownloads from "../views/ScriptDownloads";
import { LENSES, type Lens } from "./navigation";

const SAVE_LABEL: Record<string, string> = {
  booting: "Loading…",
  saved: "Saved on this device",
  saving: "Saving…",
  dirty: "Unsaved edits",
  error: "Save failed — retry with Ctrl+S",
};

interface StoryBarProps {
  projectTitle?: string;
  canUndo: boolean;
  canRedo: boolean;
  status: string;
  syncStatus: string;
  syncMessage: string | null;
  lens: Lens;
  onUndo: () => void;
  onRedo: () => void;
  onOpenDiagnostics: () => void;
  onSelectLens: (lens: Lens) => void;
}

export function StoryBar({
  projectTitle,
  canUndo,
  canRedo,
  status,
  syncStatus,
  syncMessage,
  lens,
  onUndo,
  onRedo,
  onOpenDiagnostics,
  onSelectLens,
}: StoryBarProps) {
  const router = useRouter();

  return (
    <div className="tln-story-bar">
      <div className="tln-story-bar__left">
        <nav className="tln-story-bar__crumbs" aria-label="Story navigation">
          <button className="tln-story-bar__crumb" onClick={() => router.push("/stories")}>
            Stories
          </button>
          <span className="tln-story-bar__crumb-separator" aria-hidden="true">
            /
          </span>
          <span className="tln-story-bar__title" title={projectTitle ?? ""}>
            {projectTitle ?? ""}
          </span>
        </nav>

        <span className="tln-story-bar__divider" aria-hidden="true" />

        <div className="tln-story-bar__actions">
          <span className="tln-tools">
            <button
              className="tln-tool"
              onClick={onUndo}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
              aria-label="Undo"
            >
              <svg
                className="tln-tool__icon"
                viewBox="0 0 16 16"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3.5 6.5h6a3.5 3.5 0 0 1 0 7H7" />
                <path d="M6.5 3.5 3.5 6.5l3 3" />
              </svg>
            </button>
            <button
              className="tln-tool"
              onClick={onRedo}
              disabled={!canRedo}
              title="Redo (Ctrl+Shift+Z)"
              aria-label="Redo"
            >
              <svg
                className="tln-tool__icon"
                viewBox="0 0 16 16"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12.5 6.5h-6a3.5 3.5 0 0 0 0 7H9" />
                <path d="m9.5 3.5 3 3-3 3" />
              </svg>
            </button>
          </span>

          <ScriptDownloads />

          <button
            className="tln-tool"
            onClick={onOpenDiagnostics}
            title="Story Architecture & Health Diagnostics (powered by Effect)"
            aria-label="Story Health Diagnostics"
          >
            <Activity size={15} />
          </button>

          <button
            className="tln-status"
            onClick={() => router.push("/profile#sync")}
            title={
              syncMessage ??
              `${SAVE_LABEL[status] ?? "Saved"} • Cloud: ${syncStatus}. View save and sync status in your profile.`
            }
            aria-label={
              syncMessage ?? `${SAVE_LABEL[status] ?? "Saved on this device"}, cloud ${syncStatus}`
            }
          >
            <span className={`tln-status__part tln-status__local--${status}`}>
              <i className="tln-status__dot" aria-hidden="true" />
              <Laptop size={13} className="tln-status__device-icon" aria-hidden="true" />
              <span className="sr-only">{SAVE_LABEL[status] ?? "Saved"}</span>
            </span>
            <span
              className={`tln-status__cloud tln-status__cloud--${syncStatus}`}
              aria-hidden="true"
            >
              {syncStatus === "syncing" ? (
                <RefreshCw size={12} className="tln-spin" />
              ) : syncStatus === "synced" ? (
                <CloudCheck size={13} />
              ) : (
                <Cloud size={13} />
              )}
            </span>
          </button>
        </div>
      </div>

      <div className="tln-story-bar__right">
        <span className="tln-lens-tabs" role="tablist" aria-label="Story lenses">
          {LENSES.map((l) => (
            <button
              key={l.id}
              role="tab"
              aria-selected={lens === l.id}
              className={`tln-lens-tab${lens === l.id ? " tln-lens-tab--on" : ""}`}
              onClick={() => onSelectLens(l.id)}
            >
              {l.icon}
              <span className="tln-lens-tab__label">{l.label}</span>
            </button>
          ))}
        </span>
      </div>
    </div>
  );
}
