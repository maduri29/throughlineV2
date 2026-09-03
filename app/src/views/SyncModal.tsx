import { useEffect, useState } from "react";
import { checkTursoConfigured, getLastSyncedAt, getSyncKey, setSyncKey } from "../data/sync";
import { useGraphStore } from "../store";

export default function SyncModal({ onClose }: { onClose: () => void }) {
  const syncStatus = useGraphStore((s) => s.syncStatus);
  const syncMessage = useGraphStore((s) => s.syncMessage);
  const syncNow = useGraphStore((s) => s.syncNow);

  const [keyInput, setKeyInput] = useState(getSyncKey());
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void checkTursoConfigured().then(setConfigured);
  }, []);

  const lastSynced = getLastSyncedAt();
  const lastSyncedStr = lastSynced ? new Date(lastSynced).toLocaleTimeString() : "Never";

  const handleSave = () => {
    setSyncKey(keyInput);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    if (keyInput.trim()) {
      void syncNow();
    }
  };

  const handleGenerate = () => {
    const randomKey = `tl-${Math.random().toString(36).slice(2, 8)}-${Math.random().toString(36).slice(2, 8)}`;
    setKeyInput(randomKey);
  };

  return (
    <div className="tln-dialog-scrim" onClick={onClose}>
      <div
        className="tln-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Cloud Sync"
      >
        <header className="tln-dialog__head">
          <h2 className="tln-dialog__title">Cross-Device Sync (Turso)</h2>
          <button className="tln-btn tln-btn--quiet" onClick={onClose} aria-label="Close dialog">
            ✕
          </button>
        </header>

        <div className="tln-dialog__body">
          {configured === false && (
            <div className="tln-sync-alert">
              <strong>⚠️ Turso Not Configured on Server</strong>
              <p>
                Add <code>TURSO_DATABASE_URL</code> and <code>TURSO_AUTH_TOKEN</code> to your{" "}
                <code>.env.local</code> file to enable cloud sync.
              </p>
            </div>
          )}

          <p className="tln-dialog__desc">
            Keep your boneyard sparks and story graphs synchronized across devices using a private
            passphrase key. Enter the same key on each device to share your work.
          </p>

          <div className="tln-field">
            <label className="tln-field__label" htmlFor="sync-key-input">
              Your Sync Key / Passphrase
            </label>
            <div className="tln-sync-input-row">
              <input
                id="sync-key-input"
                className="tln-jot__input"
                type="text"
                placeholder="e.g. my-secret-novel-key"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
              />
              <button className="tln-btn" onClick={handleGenerate} title="Generate random key">
                Random
              </button>
            </div>
          </div>

          <div className="tln-sync-meta">
            <span className="tln-sync-meta__item">
              Last synced: <strong>{lastSyncedStr}</strong>
            </span>
            {syncMessage && (
              <span className={`tln-sync-meta__msg tln-sync-meta__msg--${syncStatus}`}>
                {syncMessage}
              </span>
            )}
          </div>
        </div>

        <footer className="tln-dialog__foot">
          <button
            className="tln-btn"
            disabled={!keyInput.trim() || syncStatus === "syncing" || configured === false}
            onClick={() => void syncNow()}
          >
            {syncStatus === "syncing" ? "Syncing…" : "Sync Now"}
          </button>
          <button className="tln-btn tln-btn--accent" onClick={handleSave}>
            {saved ? "Saved ✓" : "Save Key"}
          </button>
        </footer>
      </div>
    </div>
  );
}
