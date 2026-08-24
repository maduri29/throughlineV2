// Library (T4 level 1): all stories on this machine; open, create, back up.
import { type ChangeEvent, useState } from "react";
import { describeUsage } from "../data/durability";
import { useGraphStore } from "../store";
import SyncPanel from "./SyncPanel";

export default function LibraryView({ onSignIn }: { onSignIn: () => void }) {
  const projects = useGraphStore((s) => s.projects);
  const switchProject = useGraphStore((s) => s.switchProject);
  const createProject = useGraphStore((s) => s.createProject);
  const importProject = useGraphStore((s) => s.importProject);
  const openSample = useGraphStore((s) => s.openSample);
  const durability = useGraphStore((s) => s.durability);
  const [title, setTitle] = useState("");
  const [importError, setImportError] = useState<string | null>(null);

  const onImport = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    event.target.value = ""; // let the same file be chosen twice
    if (!file) return;
    setImportError(null);
    void file.text().then(async (text) => {
      setImportError(await importProject(text));
    });
  };

  return (
    <div className="tln-library">
      <h1 className="tln-library__head">Your stories</h1>

      <div className="tln-library__bar">
        <label className="tln-btn">
          Import backup…
          <input type="file" accept=".json,application/json" hidden onChange={onImport} />
        </label>
        {/* Storage lives in this browser. Say so plainly rather than implying
            a cloud that does not exist. */}
        {projects.length === 0 && (
          <button className="tln-btn" onClick={() => void openSample()}>
            Open the sample story
          </button>
        )}
        <span className="tln-library__note">
          {durability === null
            ? "Checking storage…"
            : durability.persisted
              ? `Stored in this browser, protected from automatic cleanup${
                  describeUsage(durability) ? ` · ${describeUsage(durability)}` : ""
                }`
              : "Stored in this browser — not yet protected from automatic cleanup. Export a backup."}
        </span>
      </div>

      {importError && <p className="tln-library__error">Import failed — {importError}</p>}
      <div className="tln-library__grid">
        {projects.map((p) => (
          <button key={p.id} className="tln-storycard" onClick={() => void switchProject(p.id)}>
            <span className="tln-storycard__title">{p.title}</span>
            <span className="tln-storycard__by">
              {p.author ? `by ${p.author}` : "untitled author"}
            </span>
          </button>
        ))}
        <div className="tln-storycard tln-storycard--new">
          <input
            className="tln-storycard__input"
            placeholder="New story title…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && title.trim()) {
                void createProject(title.trim());
                setTitle("");
              }
            }}
          />
          <button
            className="tln-btn"
            disabled={!title.trim()}
            onClick={() => {
              if (!title.trim()) return;
              void createProject(title.trim());
              setTitle("");
            }}
          >
            Create
          </button>
        </div>
      </div>

      <SyncPanel onSignIn={onSignIn} />
    </div>
  );
}
