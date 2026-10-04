import { useEffect, useState } from "react";
import { checkTursoConfigured, getLastSyncedAt } from "../data/sync";
import { useGraphStore } from "../store";

export default function SyncModal({ onClose }: { onClose: () => void }) {
  const syncStatus = useGraphStore((s) => s.syncStatus);
  const syncMessage = useGraphStore((s) => s.syncMessage);
  const syncNow = useGraphStore((s) => s.syncNow);
  const [configured, setConfigured] = useState<boolean | null>(null);
  useEffect(() => {
    void checkTursoConfigured().then(setConfigured);
  }, []);
  const lastSynced = getLastSyncedAt();
  return (
    <div className="tln-dialog-scrim" onClick={onClose}>
      <div
        className="tln-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Cloud Sync"
      >
        <header className="tln-dialog__head">
          <h2 className="tln-dialog__title">Your private cloud sync</h2>
          <button className="tln-btn tln-btn--quiet" onClick={onClose} aria-label="Close dialog">
            ✕
          </button>
        </header>
        <div className="tln-dialog__body">
          <p className="tln-sync-desc">
            Your stories and Boneyard sync with your signed-in account. Sign in with the same
            account on another device to access your work.
          </p>
          {configured === false && (
            <p role="status">
              Cloud sync is unavailable. Your work continues to save on this device. Contact the
              workspace owner to connect cloud storage.
            </p>
          )}
          <div className="tln-sync-meta">
            <span className="tln-sync-meta__item">
              Last synced:{" "}
              <strong>{lastSynced ? new Date(lastSynced).toLocaleTimeString() : "Never"}</strong>
            </span>
            {syncMessage && (
              <span
                role="status"
                className={"tln-sync-meta__msg tln-sync-meta__msg--" + syncStatus}
              >
                {syncMessage}
              </span>
            )}
          </div>
        </div>
        <footer className="tln-dialog__foot">
          <button
            className="tln-btn tln-btn--accent"
            disabled={syncStatus === "syncing" || configured !== true}
            onClick={() => void syncNow()}
          >
            {syncStatus === "syncing" ? "Syncing…" : "Sync now"}
          </button>
        </footer>
      </div>
    </div>
  );
}
