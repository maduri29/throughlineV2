// The shelf: every story on this machine, and the way in to each one.
//
// Cards carry enough to choose between them without opening them — how big the
// story is, and whether it exists anywhere but this browser. A shelf of
// title-only cards makes you open things just to remember what they are.
import { type ChangeEvent, useCallback, useEffect, useState } from "react";
import { describeUsage } from "../data/durability";
import { dbGetAll } from "../data/idb";
import { scopeToProject } from "../data/scopes";
import { useGraphStore } from "../store";
import type { GraphEdge, GraphNode } from "../types";
import Logo from "./Logo";

type Stat = { scenes: number; characters: number };

/**
 * `onOpen` exists because choosing a story is two things at once: which project
 * is loaded (store) and which level is on screen (the route). Without it,
 * picking a card swapped the project underneath a Library that stayed put — from
 * the outside, clicking a story did nothing at all.
 */
export default function LibraryView({ onOpen }: { onOpen: (id: string) => void }) {
  const projects = useGraphStore((s) => s.projects);
  const switchProject = useGraphStore((s) => s.switchProject);
  const createProject = useGraphStore((s) => s.createProject);
  const importProject = useGraphStore((s) => s.importProject);
  const openSample = useGraphStore((s) => s.openSample);
  const durability = useGraphStore((s) => s.durability);

  const [title, setTitle] = useState("");
  const [naming, setNaming] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [stats, setStats] = useState<Record<string, Stat>>({});

  /**
   * Read the whole graph once to size each story.
   *
   * The store only ever holds the open project, so there is no cheaper source
   * for "how big is that other one". Fine for a personal shelf; if this ever has
   * to scale, the counts belong on the project node, written as it changes.
   */
  const loadStats = useCallback(async () => {
    const [nodesArr, edgesArr] = await Promise.all([
      dbGetAll<GraphNode>("nodes"),
      dbGetAll<GraphEdge>("edges"),
    ]);
    const allNodes: Record<string, GraphNode> = {};
    for (const n of nodesArr) allNodes[n.id] = n;
    const allEdges: Record<string, GraphEdge> = {};
    for (const e of edgesArr) allEdges[e.id] = e;

    const next: Record<string, Stat> = {};
    for (const p of projects) {
      const scoped = scopeToProject(allNodes, allEdges, p.id);
      const owned = Object.values(scoped.nodes);
      next[p.id] = {
        scenes: owned.filter((n) => n.type === "scene").length,
        characters: owned.filter((n) => n.type === "character").length,
      };
    }
    setStats(next);
  }, [projects]);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    void loadStats();
  }, [loadStats]);

  const onImport = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    event.target.value = ""; // let the same file be chosen twice
    if (!file) return;
    setImportError(null);
    void file.text().then(async (text) => {
      setImportError(await importProject(text));
    });
  };

  // Every one of these writes to IndexedDB. Fire-and-forget made a failed write
  // indistinguishable from a dead button, which is how it was reported.
  const create = (): void => {
    const name = title.trim();
    if (!name) return;
    createProject(name)
      .then(onOpen)
      .catch((err: unknown) => setImportError(`Could not create the story — ${String(err)}`));
    setTitle("");
    setNaming(false);
  };

  const sample = (): void => {
    setImportError(null);
    openSample()
      .then((id) => id && onOpen(id))
      .catch((err: unknown) => setImportError(`Could not open the sample — ${String(err)}`));
  };

  const empty = projects.length === 0;

  return (
    <div className="tln-library">
      <header className="tln-library__head">
        <div>
          <h1 className="tln-library__title">Your stories</h1>
          <p className="tln-library__count">
            {empty ? "Nothing here yet" : `${projects.length} on this machine`}
          </p>
        </div>
        {!empty && (
          <div className="tln-library__actions">
            <label className="tln-btn">
              Import backup…
              <input type="file" accept=".json,application/json" hidden onChange={onImport} />
            </label>
            <button className="tln-btn tln-btn--accent" onClick={() => setNaming(true)}>
              New story
            </button>
          </div>
        )}
      </header>

      {naming && (
        <div className="tln-library__new">
          <input
            className="tln-library__new-input"
            autoFocus
            placeholder="What is it called?"
            aria-label="New story title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") create();
              if (e.key === "Escape") {
                setNaming(false);
                setTitle("");
              }
            }}
          />
          <button className="tln-btn tln-btn--accent" disabled={!title.trim()} onClick={create}>
            Create
          </button>
          <button
            className="tln-btn"
            onClick={() => {
              setNaming(false);
              setTitle("");
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {importError && <p className="tln-library__error">Import failed — {importError}</p>}

      {empty ? (
        <div className="tln-empty">
          <span className="tln-empty__mark" aria-hidden="true">
            <Logo size={38} />
          </span>
          <h2 className="tln-empty__head">Start a story</h2>
          <p className="tln-empty__body">
            A story here is one thing seen from several angles: scenes on a map, a cast, a timeline,
            and the script itself.
          </p>
          <div className="tln-empty__actions">
            <button className="tln-btn tln-btn--accent" onClick={() => setNaming(true)}>
              New story
            </button>
            <button className="tln-btn" onClick={sample}>
              Open the sample story
            </button>
            <label className="tln-btn">
              Import backup…
              <input type="file" accept=".json,application/json" hidden onChange={onImport} />
            </label>
          </div>
        </div>
      ) : (
        <div className="tln-library__grid">
          {projects.map((p) => {
            const st = stats[p.id];
            return (
              <button
                key={p.id}
                className="tln-storycard"
                onClick={() => void switchProject(p.id).then(() => onOpen(p.id))}
              >
                <span className="tln-storycard__title">{p.title}</span>
                <span className="tln-storycard__by">{p.author ? `by ${p.author}` : "—"}</span>
                <span className="tln-storycard__stats">
                  {st ? `${st.scenes} scene${st.scenes === 1 ? "" : "s"}` : "…"}
                  {st && st.characters > 0 ? ` · ${st.characters} in the cast` : ""}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Where the work actually lives. Said plainly rather than left to be
          discovered when a browser clears its storage. */}
      <p className="tln-library__storage">
        {durability === null
          ? "Checking storage…"
          : durability.persisted
            ? `Stored in this browser, protected from automatic cleanup${
                describeUsage(durability) ? ` · ${describeUsage(durability)}` : ""
              }`
            : "Stored in this browser — not yet protected from automatic cleanup. Keep a backup."}
      </p>
    </div>
  );
}
