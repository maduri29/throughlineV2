import { useState } from "react";
export const date = (timestamp: number | null) =>
  timestamp
    ? new Date(timestamp).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Earlier idea";
function readDraft(key: string, fallback: string) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}
export function useDraft(key: string, fallback = "") {
  const [text, updateText] = useState(() => readDraft(key, fallback));
  const [draftError, setDraftError] = useState(false);
  function setText(value: string) {
    updateText(value);
    try {
      if (value) localStorage.setItem(key, value);
      else localStorage.removeItem(key);
      setDraftError(false);
    } catch {
      setDraftError(true);
    }
  }
  function markSaved() {
    try {
      localStorage.removeItem(key);
    } catch {
      /* Persisted content is already safe in IndexedDB. */
    }
  }
  return { text, setText, draftError, markSaved };
}
export function DraftWarning({ show }: { show: boolean }) {
  return show ? (
    <p role="alert" className="by-warning">
      Draft recovery is unavailable. Keep this page open until you save.
    </p>
  ) : null;
}
