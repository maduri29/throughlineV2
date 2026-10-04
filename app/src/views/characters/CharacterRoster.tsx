import type { CharacterDetail } from "../../data/characters";
import type { GraphNode } from "../../types";
import { CharacterPoster } from "./CharacterPoster";

interface CharacterRosterProps {
  charactersCount: number;
  visibleCharacters: GraphNode[];
  activeId: string | null;
  draftActive: boolean;
  castQuery: string;
  onCastQueryChange: (q: string) => void;
  onCreate: () => void;
  onChoose: (id: string) => void;
  details: Map<string, CharacterDetail> | null | undefined;
}

export function CharacterRoster({
  charactersCount,
  visibleCharacters,
  activeId,
  draftActive,
  castQuery,
  onCastQueryChange,
  onCreate,
  onChoose,
  details,
}: CharacterRosterProps) {
  return (
    <aside className="characters-roster" aria-label="Character roster">
      <div className="characters-roster__heading">
        <div>
          <span className="characters-roster__eyebrow">Your cast</span>
          <h2>
            Characters <small>{charactersCount}</small>
          </h2>
        </div>
        <button
          className="characters-roster__add"
          onClick={onCreate}
          disabled={draftActive}
          title={draftActive ? "Save or cancel this profile first" : undefined}
        >
          + Add
        </button>
      </div>

      <div className="characters-roster__search">
        <label>
          <span aria-hidden="true">⌕</span>
          <input
            aria-label="Find a character"
            placeholder="Find a character…"
            value={castQuery}
            onChange={(event) => onCastQueryChange(event.target.value)}
          />
        </label>
        {castQuery && (
          <button
            type="button"
            aria-label="Clear character search"
            onClick={() => onCastQueryChange("")}
          >
            ×
          </button>
        )}
      </div>

      <div className="characters-roster__list">
        {visibleCharacters.map((item) => (
          <button
            key={item.id}
            className={`characters-roster__item${item.id === activeId ? " is-selected" : ""}`}
            aria-current={item.id === activeId ? "true" : undefined}
            disabled={draftActive && item.id !== activeId}
            title={
              draftActive && item.id !== activeId ? "Save or cancel this profile first" : undefined
            }
            onClick={() => onChoose(item.id)}
          >
            <CharacterPoster id={item.id} title={item.title} src={item.posterImage} />
            {item.id === activeId && (
              <span className="characters-roster__selected" aria-hidden="true">
                Viewing
              </span>
            )}
            <span className="characters-roster__copy">
              <strong>{item.title || "Untitled character"}</strong>
              <small>
                {[item.role, item.age].filter(Boolean).join(" · ") || "Add character details"}
              </small>
              <span className="characters-roster__meta">
                {details?.get(item.id)?.sceneIds.length ?? 0} scenes
              </span>
              {item.synopsis && <span className="characters-roster__intro">{item.synopsis}</span>}
            </span>
          </button>
        ))}

        {charactersCount === 0 && <p className="characters-roster__empty">The cast starts here.</p>}
        {charactersCount > 0 && visibleCharacters.length === 0 && (
          <p className="characters-roster__empty" role="status">
            No characters match “{castQuery}”. Try a name, role or trait.
          </p>
        )}
      </div>
    </aside>
  );
}
