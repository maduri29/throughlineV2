import { useEffect } from "react";
import { useGraphStore } from "./store";
import MapView from "./views/MapView";

const SAVE_LABEL: Record<string, string> = {
  booting: "Loading…",
  saved: "Saved ✓",
  saving: "Saving…",
  dirty: "Unsaved edits",
  error: "Save failed — retry with Ctrl+S",
};

export default function App() {
  const status = useGraphStore((s) => s.status);
  const canUndo = useGraphStore((s) => s.canUndo);
  const canRedo = useGraphStore((s) => s.canRedo);
  const undo = useGraphStore((s) => s.undo);
  const redo = useGraphStore((s) => s.redo);
  const forceSave = useGraphStore((s) => s.forceSave);

  useEffect(() => {
    void useGraphStore.getState().boot();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void forceSave();
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

  return (
    <div className="tln-app">
      <header className="tln-header">
        <strong>Throughline</strong>
        <span className="tln-header__sub">HIGH WATER</span>
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
      </header>
      <MapView />
    </div>
  );
}
