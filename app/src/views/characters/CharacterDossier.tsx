import type React from "react";
import { CHAR_ROLE_SUGGESTIONS, type GraphNode } from "../../types";
import type { CharacterDetail } from "../../data/characters";
import { CharacterPoster } from "./CharacterPoster";

export type CharacterField =
  | "title"
  | "age"
  | "role"
  | "synopsis"
  | "traits"
  | "motivation"
  | "conflict"
  | "appearance"
  | "posterImage"
  | "backstory"
  | "relationships";

export type CharacterDraft = { id: string; values: Record<CharacterField, string> } | null;

interface CharacterDossierProps {
  character: GraphNode | undefined;
  draft: CharacterDraft;
  context: CharacterDetail | undefined;
  nodes: Record<string, GraphNode>;
  imageBusy: boolean;
  imageError: string;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onCreate: () => void;
  onChoose: (id: string) => void;
  onOpenNode: (id: string) => void;
  onChangeField: (key: CharacterField, value: string) => void;
  onUploadPoster: (file?: File) => void;
  onDelete?: () => void;
}

export function CharacterDossier({
  character,
  draft,
  context,
  nodes,
  imageBusy,
  imageError,
  onEdit,
  onCancel,
  onSave,
  onCreate,
  onChoose,
  onOpenNode,
  onChangeField,
  onUploadPoster,
  onDelete,
}: CharacterDossierProps) {
  if (!character) {
    return (
      <main className="character-dossier" aria-label="Character dossier">
        <div className="character-dossier__start">
          <span aria-hidden="true">✦</span>
          <h2>Meet your cast</h2>
          <p>Add a character to start building their story.</p>
          <button onClick={onCreate}>+ New character</button>
        </div>
      </main>
    );
  }

  const isEditing = draft?.id === character.id;

  const value = (key: CharacterField) => (isEditing ? draft.values[key] : (character[key] ?? ""));

  const field = (
    label: string,
    key: CharacterField,
    placeholder: string,
    rows = 0,
    list?: string,
  ) => {
    const props = {
      "aria-label": label,
      value: value(key),
      placeholder,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        onChangeField(key, e.target.value),
    };
    return (
      <label className="character-dossier__field">
        <span>{label}</span>
        {rows ? <textarea {...props} rows={rows} /> : <input {...props} list={list} />}
      </label>
    );
  };

  const renderLinks = (ids: string[], empty: string) => {
    return ids.length ? (
      ids.map((id) => (
        <button key={id} className="character-dossier__link" onClick={() => onOpenNode(id)}>
          {nodes[id]?.title ?? id}
        </button>
      ))
    ) : (
      <span className="character-dossier__muted">{empty}</span>
    );
  };

  return (
    <main className="character-dossier" aria-label="Character dossier">
      <div className="character-dossier__inner" key={character.id}>
        <header className="character-dossier__header">
          <div>
            <span className="character-dossier__eyebrow">Character dossier</span>
            <h2>{character.title || "Untitled character"}</h2>
          </div>
          <div className="character-dossier__actions">
            {isEditing ? (
              <>
                <button type="button" className="character-dossier__cancel" onClick={onCancel}>
                  Cancel
                </button>
                <button type="button" className="character-dossier__edit" onClick={onSave}>
                  Save changes
                </button>
              </>
            ) : (
              <>
                {onDelete && (
                  <button
                    type="button"
                    className="character-dossier__cancel"
                    style={{ color: "var(--danger)" }}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Delete character "${character.title || "Untitled"}"? This cannot be undone.`,
                        )
                      ) {
                        onDelete();
                      }
                    }}
                  >
                    Delete
                  </button>
                )}
                <button type="button" className="character-dossier__edit" onClick={onEdit}>
                  Edit profile
                </button>
              </>
            )}
          </div>
        </header>

        <div className="character-identity">
          <CharacterPoster id={character.id} title={character.title} src={value("posterImage")} />
          <div>
            <span className="character-dossier__eyebrow">At a glance</span>
            <p>
              {[character.role, character.age].filter(Boolean).join(" · ") || "Character profile"}
            </p>
            <span className="character-identity__scenes">
              {context?.sceneIds.length ?? 0} scenes in this story
            </span>
            {isEditing && (
              <div className="character-poster__controls">
                <label className="character-poster__upload">
                  {imageBusy ? "Preparing image…" : "Upload poster"}
                  <input
                    aria-label="Upload character poster"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={imageBusy}
                    onChange={(event) => {
                      onUploadPoster(event.target.files?.[0]);
                      event.target.value = "";
                    }}
                  />
                </label>
                {value("posterImage") && (
                  <button type="button" onClick={() => onChangeField("posterImage", "")}>
                    Remove image
                  </button>
                )}
                <small>JPG, PNG or WebP · cropped to portrait</small>
                {imageError && <span role="alert">{imageError}</span>}
              </div>
            )}
          </div>
        </div>

        {!isEditing ? (
          <>
            {character.synopsis ? (
              <p className="character-dossier__summary">{character.synopsis}</p>
            ) : (
              <p className="character-dossier__summary character-dossier__summary--empty">
                Add an introduction to bring this character into focus.
              </p>
            )}
            {(
              [
                "traits",
                "motivation",
                "conflict",
                "appearance",
                "backstory",
                "relationships",
              ] as CharacterField[]
            ).some((key) => Boolean(character[key]?.trim())) ? (
              <section className="character-dossier__read" aria-label="Character details">
                {(
                  [
                    ["Personality & motives", ["traits", "motivation", "conflict"]],
                    ["Appearance & style", ["appearance"]],
                    ["Backstory", ["backstory"]],
                    ["Relationship notes", ["relationships"]],
                  ] as [string, CharacterField[]][]
                ).map(
                  ([heading, keys]) =>
                    keys.some((key) => character[key]?.trim()) && (
                      <div className="character-dossier__read-group" key={heading}>
                        <h3>{heading}</h3>
                        {keys
                          .filter((key) => character[key]?.trim())
                          .map((key) => (
                            <div className="character-dossier__read-item" key={key}>
                              <strong>
                                {
                                  (
                                    {
                                      traits: "Traits & voice",
                                      motivation: "Motivation",
                                      conflict: "Inner conflict or flaw",
                                      appearance: "Appearance",
                                      backstory: "Backstory",
                                      relationships: "Relationship notes",
                                    } as Partial<Record<CharacterField, string>>
                                  )[key]
                                }
                              </strong>
                              <p>{character[key]}</p>
                            </div>
                          ))}
                      </div>
                    ),
                )}
              </section>
            ) : null}
          </>
        ) : (
          <>
            <section className="character-dossier__section" aria-label="Essentials">
              <div className="character-dossier__section-heading">
                <span>01</span>
                <h3>Essentials</h3>
              </div>
              <div className="character-dossier__grid">
                {field("Name", "title", "Character name")}
                {field("Age", "age", "e.g. late 30s, unknown")}
                {field("Story role", "role", "Protagonist, foil…", 0, "character-role-suggestions")}
                <div className="character-dossier__wide">
                  {field("Short summary", "synopsis", "Who are they in this story?", 2)}
                </div>
              </div>
            </section>
            <details
              className="character-dossier__fold"
              open={Boolean(character.traits || character.motivation || character.conflict)}
            >
              <summary>
                <span>02</span>
                <strong>Personality & motives</strong>
                <small>What drives them</small>
              </summary>
              <div className="character-dossier__fold-body">
                {field("Traits & voice", "traits", "How do they think, speak, or behave?", 2)}
                {field("Motivation", "motivation", "What do they want?", 2)}
                {field("Inner conflict or flaw", "conflict", "What gets in their way?", 2)}
              </div>
            </details>
            <details className="character-dossier__fold" open={Boolean(character.appearance)}>
              <summary>
                <span>03</span>
                <strong>Appearance & style</strong>
                <small>How they present</small>
              </summary>
              <div className="character-dossier__fold-body">
                {field(
                  "Appearance & style",
                  "appearance",
                  "Distinctive details, movement, clothing…",
                  3,
                )}
              </div>
            </details>
            <details className="character-dossier__fold" open={Boolean(character.backstory)}>
              <summary>
                <span>04</span>
                <strong>Backstory</strong>
                <small>What shaped them</small>
              </summary>
              <div className="character-dossier__fold-body">
                {field("Backstory", "backstory", "The history that matters to this story…", 4)}
              </div>
            </details>
            <details className="character-dossier__fold" open={Boolean(character.relationships)}>
              <summary>
                <span>05</span>
                <strong>Relationship notes</strong>
                <small>Private notes on connections</small>
              </summary>
              <div className="character-dossier__fold-body">
                {field("Relationship notes", "relationships", "Tensions, loyalties, secrets…", 3)}
              </div>
            </details>
          </>
        )}

        <section className="character-dossier__context" aria-label="Story context">
          <div className="character-dossier__section-heading">
            <span>↗</span>
            <h3>In the story</h3>
          </div>
          <div className="character-dossier__context-row">
            <strong>
              Scenes <em>{context?.sceneIds.length ?? 0}</em>
            </strong>
            <div>{renderLinks(context?.sceneIds ?? [], "No scenes linked yet")}</div>
          </div>
          {context?.firstSceneId && (
            <p className="character-dossier__first-last">
              First: {nodes[context.firstSceneId]?.title}
              {context.lastSceneId && context.lastSceneId !== context.firstSceneId
                ? ` · Last: ${nodes[context.lastSceneId]?.title}`
                : ""}
            </p>
          )}
          <div className="character-dossier__context-row">
            <strong>Relations</strong>
            <div>
              {context?.relations.length ? (
                context.relations.map((r) => (
                  <button
                    key={r.otherId}
                    className="character-dossier__link"
                    onClick={() => onChoose(r.otherId)}
                  >
                    {nodes[r.otherId]?.title ?? r.otherId}
                    {r.label ? <em> · {r.label}</em> : null}
                  </button>
                ))
              ) : (
                <span className="character-dossier__muted">No relations linked yet</span>
              )}
            </div>
          </div>
          <div className="character-dossier__context-row">
            <strong>Themes</strong>
            <div>{renderLinks(context?.themeIds ?? [], "None linked")}</div>
          </div>
          <div className="character-dossier__context-row">
            <strong>Locations</strong>
            <div>{renderLinks(context?.locationIds ?? [], "None linked")}</div>
          </div>
        </section>

        <datalist id="character-role-suggestions">
          {CHAR_ROLE_SUGGESTIONS.map((role) => (
            <option key={role} value={role} />
          ))}
        </datalist>
      </div>
    </main>
  );
}
