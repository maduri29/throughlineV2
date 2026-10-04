import { useEffect } from "react";

interface GlobalShortcutsOptions {
  onSave: () => void | Promise<void>;
  onTogglePalette: () => void;
  onUndo: () => void;
  onRedo: () => void;
}

export function useGlobalShortcuts({
  onSave,
  onTogglePalette,
  onUndo,
  onRedo,
}: GlobalShortcutsOptions) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void onSave();
      } else if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onTogglePalette();
      } else if (
        e.defaultPrevented ||
        (e.target instanceof HTMLElement &&
          e.target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]'))
      ) {
        // Text fields and the screenplay editor own their own undo history.
        return;
      } else if (mod && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        onUndo();
      } else if (
        (mod && e.shiftKey && e.key.toLowerCase() === "z") ||
        (mod && e.key.toLowerCase() === "y")
      ) {
        e.preventDefault();
        onRedo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSave, onTogglePalette, onUndo, onRedo]);
}
