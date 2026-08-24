// Library (T4 level 1): all stories on this machine; open, create, back up.
import { type ChangeEvent, useState } from "react";
import { describeUsage } from "../data/durability";
import { useGraphStore } from "../store";
import SyncPanel from "./SyncPanel";

/**
 * `onOpen` exists because choosing a story is two things at once: which project
 * is loaded (store) and which level is on screen (App). Without it, picking a
 * card swapped the project underneath a Library that stayed put — from the
 * outside, clicking a story did nothing at all.
 */
export default function LibraryView({
  onSignIn,
  onOpen,
}: {
  onSignIn: () => void;
  onOpen: (id: string) => void;
}) {
  const projects = useGraphStore((s) => s.projects);
  const switchProject = useGraphStore((s) => s.switchProject);
  const createProject = useGraphStore((s) => s.createProject);
  const importProject = useGraphStore((s) => s.importProject);
  const openSample = useGraphStore((s) => s.openSample);
  const forks = useGraphStore((s) => s.forks);
  const dismissForks = useGraphStore((s) => s.dismissForks);
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
          <button
            className="tln-btn"
            onClick={() => void openSample().then((id) => id && onOpen(id))}
          >
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

      {/* A conflict leaves an extra card on the shelf. Unexplained, that reads as
          a bug; explained, it reads as the app having saved you from one. */}
      {Object.keys(forks).length > 0 && (
        <div className="tln-library__forks">
          <p className="tln-library__forks-head">
            {Object.keys(forks).length === 1 ? "A copy was" : "Copies were"} kept aside
          </p>
          <p className="tln-library__forks-body">
            Another device had already saved{" "}
            {[...new Set(Object.values(forks))].map((t) => `“${t}”`).join(", ")}. Rather than
            overwrite what you wrote here, your version was kept as a separate story marked{" "}
            <em>unsynced copy</em>. Nothing was lost — merge what you want and delete the rest.
          </p>
          <button className="tln-btn" onClick={() => void dismissForks()}>
            Got it
          </button>
        </div>
      )}
      <div className="tln-library__grid">
        {projects.map((p) => (
          <button
            key={p.id}
            className="tln-storycard"
            onClick={() => void switchProject(p.id).then(() => onOpen(p.id))}
          >
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
                void createProject(title.trim()).then(onOpen);
                setTitle("");
              }
            }}
          />
          <button
            className="tln-btn"
            disabled={!title.trim()}
            onClick={() => {
              if (!title.trim()) return;
              void createProject(title.trim()).then(onOpen);
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
