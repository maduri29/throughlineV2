import { Search } from "lucide-react";
import type { Collection } from "../../data/boneyard/types";

export interface BoneyardToolbarProps {
  query: string;
  onQueryChange: (query: string) => void;
  filter: string;
  onFilterChange: (filter: string) => void;
  collectionId: string;
  onCollectionChange: (collectionId: string) => void;
  activeCollections: Collection[];
  onRevisit: () => void;
  pending: boolean;
}

const FILTER_OPTIONS: Array<[value: string, label: string]> = [
  ["active", "All ideas"],
  ["pinned", "Pinned"],
  ["aside", "Set aside"],
  ["trash", "Trash"],
];

export function BoneyardToolbar({
  query,
  onQueryChange,
  filter,
  onFilterChange,
  collectionId,
  onCollectionChange,
  activeCollections,
  onRevisit,
  pending,
}: BoneyardToolbarProps) {
  return (
    <div className="by-controls">
      <div className="by-search">
        <Search size={16} />
        <input
          aria-label="Search ideas"
          placeholder="Find a thought, phrase, or tag…"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
        />
      </div>
      <div className="by-filters">
        {FILTER_OPTIONS.map(([value, label]) => (
          <button
            key={value}
            className={`by-filter${filter === value ? " by-filter--on" : ""}`}
            aria-pressed={filter === value}
            onClick={() => onFilterChange(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <select
        aria-label="Filter by collection"
        value={collectionId}
        onChange={(e) => onCollectionChange(e.target.value)}
      >
        <option value="">Every collection</option>
        {activeCollections.map((c) => (
          <option key={c.id} value={c.id}>
            {c.title}
          </option>
        ))}
      </select>
      <button className="tln-btn" disabled={pending} onClick={onRevisit}>
        Revisit an idea
      </button>
    </div>
  );
}
