import { useEffect, useState } from "react";
import { useGraphStore } from "./store";
import MapView from "./views/MapView";
import TimelineView from "./views/TimelineView";
import CharactersView from "./views/CharactersView";
import ScriptView from "./views/ScriptView";
import LibraryView from "./views/LibraryView";
import Inspector from "./views/Inspector";
import ConnectionAdd from "./views/ConnectionAdd";
import Palette from "./views/Palette";

const SAVE_LABEL: Record<string, string> = {
  booting: "Loading…",
  saved: "Saved ✓",
  saving: "Saving…",
  dirty: "Unsaved edits",
  error: "Save failed — retry with Ctrl+S",
};

type Lens = "map" | "timeline" | "characters" | "script";

const LENSES: Array<[Lens, string]> = [
  ["map", "Map"],
  ["timeline", "Timeline"],
  ["characters", "Characters"],
  ["script", "Script"],
];

export default function App() {
  const status = useGraphStore((s) => s.status);
  const canUndo = useGraphStore((s) => s.canUndo);
  const canRedo = useGraphStore((s) => s.canRedo);
  const undo = useGraphStore((s) => s.undo);
  const redo = useGraphStore((s) => s.redo);
  const forceSave = useGraphStore((s) => s.forceSave);
  const projectId = useGraphStore((s) => s.projectId);
  const [lens, setLens] = useState<Lens>("map");
  const [level, setLevel] = useState<"library" | "workspace">("workspace");
  const [paletteOpen, setPaletteOpen] = useState(false);

  /** Palette jump: pick the lens that shows the node best. */
  const jumpTo = (id: string, type: string): void => {
    setLevel("workspace");
    setLens(type === "character" ? "characters" : "map");
    useGraphStore.getState().select([id]);
  };

  useEffect(() => {
    void useGraphStore.getState().boot();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void forceSave();
      } else if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      } else if (mod && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
      } else if (
        (mod && e.shiftKey && e.key.toLowerCase() === "z") ||
        (mod && e.key.toLowerCase() === "y")
      ) {
        e.preventDefault();
        redo();
      }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [undo, redo, forceSave]);

  const project = projectId ? useGraphStore.getState().nodes[projectId] : undefined;

  return (
    <div className="tln-app">
      <header className="tln-header">
        <button
          className="tln-btn"
          onClick={() => setLevel((l) => (l === "workspace" ? "library" : "workspace"))}
          title="Library / Workspace"
        >
          {level === "workspace" ? "⌂" : "↩"}
        </button>
        <strong>Throughline</strong>
        <span className="tln-header__sub">
          {level === "workspace" ? (project?.title ?? "") : "Library"}
        </span>
        <span className={`tln-save tln-save--${status}`}>
          {status === "error"
            ? `Error: ${useGraphStore.getState().bootError ?? "unknown"}`
            : SAVE_LABEL[status]}
        </span>
        <button className="tln-btn" onClick={undo} disabled={!canUndo} title="Ctrl+Z">
          ↶
        </button>
        <button className="tln-btn" onClick={redo} disabled={!canRedo} title="Ctrl+Shift+Z">
          ↷
        </button>
        <span className="tln-lens-tabs">
          {LENSES.map(([id, label]) => (
            <button
              key={id}
              className={`tln-lens-tab${lens === id ? " tln-lens-tab--on" : ""}`}
              onClick={() => setLens(id)}
            >
              {label}
            </button>
          ))}
        </span>
      </header>

      {level === "library" ? (
        <LibraryView />
      ) : (
        <div className="tln-workspace">
          <div className="tln-workspace__lens">
            {lens === "map" ? <MapView /> : null}
            {lens === "timeline" ? <TimelineView /> : null}
            {lens === "characters" ? <CharactersView /> : null}
            {lens === "script" ? <ScriptView /> : null}
          </div>
          {lens !== "script" && lens !== "characters" ? (
            <div className="tln-dock">
              <Inspector />
              <ConnectionAdd />
            </div>
          ) : null}
        </div>
      )}
      <Palette open={paletteOpen} onClose={() => setPaletteOpen(false)} onJump={jumpTo} />
    </div>
  );
}
