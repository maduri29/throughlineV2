import { useState } from "react";

export function CreateStoryForm({
  pending,
  onCreate,
  onCancel,
}: {
  pending: boolean;
  onCreate: (title: string) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  return (
    <form
      className="tln-library__new"
      aria-label="Create a story"
      onSubmit={(event) => {
        event.preventDefault();
        if (title.trim() && !pending) void onCreate(title);
      }}
    >
      <label htmlFor="story-title">Give your story a working title</label>
      <div className="tln-library__new-fields">
        <input
          id="story-title"
          className="tln-library__new-input"
          autoFocus
          placeholder="Untitled, for now…"
          aria-label="New story title"
          value={title}
          disabled={pending}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape" && !pending) onCancel();
          }}
        />
        <button
          className="tln-btn tln-btn--accent"
          disabled={!title.trim() || pending}
          type="submit"
        >
          {pending ? "Creating…" : "Create"}
        </button>
        <button className="tln-btn" disabled={pending} onClick={onCancel} type="button">
          Cancel
        </button>
      </div>
    </form>
  );
}
