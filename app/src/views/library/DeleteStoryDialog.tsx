import { useEffect, useRef } from "react";
import { Trash2 } from "lucide-react";

export function DeleteStoryDialog({
  title,
  pending,
  error,
  onCancel,
  onConfirm,
}: {
  title: string;
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="tln-delete-project"
      aria-labelledby="delete-project-title"
      aria-describedby="delete-project-description"
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onCancel();
      }}
    >
      <span className="tln-delete-project__icon">
        <Trash2 size={24} aria-hidden="true" />
      </span>
      <h2 id="delete-project-title">Delete “{title}”?</h2>
      <p id="delete-project-description">
        This removes the project and its owned scenes, characters and notes. Shared research and
        Boneyard ideas stay in your workspace. The deletion will sync to your other devices.
      </p>
      <p className="tln-delete-project__warning">
        This cannot be undone here. Download a story backup first if you want to keep a copy.
      </p>
      {error && <p role="alert">{error}</p>}
      <div className="tln-delete-project__actions">
        <button className="tln-btn" autoFocus disabled={pending} onClick={onCancel}>
          Cancel
        </button>
        <button
          className="tln-btn tln-btn--danger"
          disabled={pending}
          onClick={() => void onConfirm()}
        >
          {pending ? "Deleting…" : "Delete project"}
        </button>
      </div>
    </dialog>
  );
}
