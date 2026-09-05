import { useState } from "react";
import type { BoneyardController } from "./useBoneyard";

export function CollectionEditor({
  collection,
  by,
  onRemoved,
}: {
  collection: import("../../data/boneyard/types").Collection;
  by: BoneyardController;
  onRemoved: () => void;
}) {
  const [title, setTitle] = useState(collection.title);
  const [description, setDescription] = useState(collection.description);
  return (
    <details className="by-collection-editor">
      <summary>{collection.title}</summary>
      <label>
        Name
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label>
        Description
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <div className="by-actions">
        <button
          className="tln-btn"
          disabled={by.pending || !title.trim()}
          onClick={() =>
            void by.run(() => by.editCollection(collection.id, { title, description }))
          }
        >
          Save collection
        </button>
        <button
          className="tln-btn"
          disabled={by.pending}
          onClick={() =>
            void by
              .run(() => by.editCollection(collection.id, { deleted: true }))
              .then((ok) => {
                if (ok) onRemoved();
              })
          }
        >
          Remove collection, keep ideas
        </button>
      </div>
    </details>
  );
}
