import { useEffect, useState } from "react";
import {
  checkTursoConfigured,
  getLastSyncedAt,
  getSyncConflicts,
  resolveSyncConflicts,
} from "../../data/sync";
import type { CloudConflict } from "../../data/sync-protocol";
import { useGraphStore } from "../../store";

export default function SyncSettings() {
  const syncStatus = useGraphStore((s) => s.syncStatus);
  const syncMessage = useGraphStore((s) => s.syncMessage);
  const [conflicts, setConflicts] = useState<CloudConflict[]>([]);
  const [resolving, setResolving] = useState(false);
  const [resolutionError, setResolutionError] = useState("");
  const [configured, setConfigured] = useState<boolean | null>(null);
  useEffect(() => {
    void checkTursoConfigured().then(setConfigured);
  }, []);
  useEffect(() => {
    void getSyncConflicts().then(setConflicts);
  }, [syncStatus]);
  async function resolve(choice: "local" | "cloud") {
    setResolving(true);
    setResolutionError("");
    try {
      if (useGraphStore.getState().status === "booting") await useGraphStore.getState().boot();
      await useGraphStore.getState().forceSave();
      await resolveSyncConflicts(choice);
      window.location.assign("/stories");
    } catch {
      setResolutionError(
        "Could not resolve these versions. Your local work is preserved. Try again.",
      );
      setResolving(false);
    }
  }
  const lastSynced = getLastSyncedAt();
  return (
    <section id="sync" className="profile-section" aria-labelledby="sync-heading">
      <h2 id="sync-heading">Save and sync</h2>
      <p>
        {configured === null
          ? "Checking cloud storage…"
          : configured
            ? "Your work saves on this device and syncs automatically while your workspace is open. Sign in with the same account on another device to access your private work."
            : "Cloud sync is unavailable. Your work saves on this device. Cloud storage needs to be connected before your work can sync across devices."}
      </p>
      <p className="auth-help">
        Stories, characters, relationships and saved Boneyard ideas are stored in your private
        browser database and, when connected, your private account in Turso. Uploaded PDFs and
        images, unsent drafts and undo history stay on this device. Exported backups contain writing
        data and attachment details, not the uploaded file bytes.
      </p>
      {conflicts.length > 0 && (
        <div role="alert">
          <h3>Choose which version to keep</h3>
          <p>
            {conflicts.length} record(s) were also changed on another device. Neither version has
            been discarded. Download both versions before choosing; a recovery copy is also kept on
            this device.
          </p>
          <ul>
            {conflicts.map((r) => (
              <li key={`${r.kind}:${r.id}`}>
                {r.data && "title" in r.data ? r.data.title || r.id : r.id} ({r.kind})
              </li>
            ))}
          </ul>
          <button
            className="tln-btn"
            onClick={() => {
              const url = URL.createObjectURL(
                new Blob([JSON.stringify(conflicts, null, 2)], { type: "application/json" }),
              );
              const link = document.createElement("a");
              link.href = url;
              link.download = "story-lane-sync-conflicts.json";
              link.click();
              setTimeout(() => URL.revokeObjectURL(url), 10000);
            }}
          >
            Download both versions
          </button>
          <button className="tln-btn" disabled={resolving} onClick={() => void resolve("local")}>
            Keep this device’s versions
          </button>
          <button className="tln-btn" disabled={resolving} onClick={() => void resolve("cloud")}>
            Use cloud versions
          </button>
          {resolutionError && <p>{resolutionError}</p>}
        </div>
      )}
      <p>Last synced: {lastSynced ? new Date(lastSynced).toLocaleString() : "Never"}</p>
      {syncMessage && <p role="status">{syncMessage}</p>}
      <button
        className="tln-btn"
        disabled={
          configured !== true || syncStatus === "syncing" || resolving || conflicts.length > 0
        }
        onClick={() =>
          void (async () => {
            if (useGraphStore.getState().status === "booting")
              await useGraphStore.getState().boot();
            await useGraphStore.getState().forceSave();
            await useGraphStore.getState().syncNow();
          })()
        }
      >
        {syncStatus === "syncing" ? "Syncing…" : "Sync now"}
      </button>
    </section>
  );
}
