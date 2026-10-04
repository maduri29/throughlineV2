import { useState, type FormEvent } from "react";
import type { Collection } from "../../data/boneyard/types";
import { CollectionEditor } from "./CollectionEditor";
import type { BoneyardController } from "./useBoneyard";

export interface CollectionsSectionProps {
  by: BoneyardController;
  activeCollections: Collection[];
  deletedCollections: Collection[];
  selectedCollectionId: string;
  onCollectionRemoved: (id: string) => void;
}

export function CollectionsSection({
  by,
  activeCollections,
  deletedCollections,
  selectedCollectionId,
  onCollectionRemoved,
}: CollectionsSectionProps) {
  const [collectionTitle, setCollectionTitle] = useState("");

  const handleCreate = (e: FormEvent) => {
    e.preventDefault();
    void by
      .run(() => by.createCollection(collectionTitle))
      .then((ok) => {
        if (ok) setCollectionTitle("");
      });
  };

  return (
    <details className="by-collections">
      <summary>
        Collections <span>{activeCollections.length}</span>
      </summary>
      <form className="by-actions" onSubmit={handleCreate}>
        <input
          aria-label="New collection name"
          placeholder="A loose collection…"
          value={collectionTitle}
          onChange={(e) => setCollectionTitle(e.target.value)}
        />
        <button className="tln-btn" disabled={!collectionTitle.trim() || by.pending}>
          Create collection
        </button>
      </form>
      {activeCollections.map((c) => (
        <CollectionEditor
          key={c.id}
          collection={c}
          by={by}
          onRemoved={() => {
            if (selectedCollectionId === c.id) onCollectionRemoved(c.id);
          }}
        />
      ))}
      {deletedCollections.map((c) => (
        <p key={c.id}>
          {c.title}{" "}
          <button
            className="tln-btn"
            disabled={by.pending}
            onClick={() => void by.run(() => by.editCollection(c.id, { deleted: false }))}
          >
            Restore collection
          </button>
        </p>
      ))}
    </details>
  );
}
