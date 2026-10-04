import { useMemo, useState } from "react";
import { CHAR_ROLE_SUGGESTIONS } from "../types";
import { useGraphStore } from "../store";
import { characterDetails } from "../data/characters";
import "./characters.css";

type Field =
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
type Draft = { id: string; values: Record<Field, string> } | null;
const fields: Field[] = [
  "title",
  "age",
  "role",
  "synopsis",
  "traits",
  "motivation",
  "conflict",
  "appearance",
  "posterImage",
  "backstory",
  "relationships",
];

export default function CharactersView({ onOpenNode }: { onOpenNode: (id: string) => void }) {
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const projectId = useGraphStore((s) => s.projectId);
  const selection = useGraphStore((s) => s.selection);
  const select = useGraphStore((s) => s.select);
  const addNodeOfType = useGraphStore((s) => s.addNodeOfType);
  const patchNode = useGraphStore((s) => s.patchNode);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(null);
  const [imageError, setImageError] = useState("");
  const [imageBusy, setImageBusy] = useState(false);
  const [castQuery, setCastQuery] = useState("");
  const characters = useMemo(
    () =>
      Object.values(nodes)
        .filter((n) => n.type === "character")
        .sort((a, b) => a.title.localeCompare(b.title)),
    [nodes],
  );
  const fromGraph = selection.find((id) => nodes[id]?.type === "character");
  const visibleCharacters = characters.filter((item) =>
    [item.title, item.role, item.age, item.synopsis, item.traits]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(castQuery.trim().toLowerCase()),
  );
  const activeId =
    fromGraph ??
    (chosenId && nodes[chosenId]?.type === "character" ? chosenId : null) ??
    characters[0]?.id;
  const character = activeId ? nodes[activeId] : undefined;
  const project = projectId ? nodes[projectId] : undefined;
  const details = useMemo(
    () => (project ? characterDetails(project, nodes, edges) : null),
    [project, nodes, edges],
  );
  const context = activeId ? details?.get(activeId) : undefined;

  function edit(id = character?.id) {
    setImageError("");
    const source = id ? useGraphStore.getState().nodes[id] : undefined;
    if (!id || !source) return;
    const values = Object.fromEntries(fields.map((key) => [key, source[key] ?? ""])) as Record<
      Field,
      string
    >;
    setDraft({ id, values });
  }
  function save() {
    if (imageBusy) return;
    if (!draft || !nodes[draft.id]) return;
    const patch = Object.fromEntries(
      fields
        .filter((key) => nodes[draft.id]?.[key] !== draft.values[key])
        .map((key) => [key, draft.values[key]]),
    );
    if (Object.keys(patch).length) patchNode(draft.id, patch);
    setDraft(null);
  }
  function choose(id: string) {
    if (id === activeId || draft) return;
    setDraft(null);
    setChosenId(id);
    select([id]);
  }
  function create() {
    if (draft) return;
    setDraft(null);
    const id = addNodeOfType("character");
    if (id) {
      setChosenId(id);
      select([id]);
      edit(id);
    }
  }
  function value(key: Field) {
    return draft && draft.id === character?.id ? draft.values[key] : (character?.[key] ?? "");
  }
  function change(key: Field, next: string) {
    setDraft((current) =>
      current ? { ...current, values: { ...current.values, [key]: next } } : current,
    );
  }
  async function uploadPoster(file?: File) {
    if (!file || !draft) return;
    const draftId = draft.id;
    setImageError("");
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 10 * 1024 * 1024) {
      setImageError("Choose a JPG, PNG or WebP image under 10 MB.");
      return;
    }
    setImageBusy(true);
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      canvas.width = 480;
      canvas.height = 640;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Image processing unavailable");
      const scale = Math.max(480 / bitmap.width, 640 / bitmap.height);
      ctx.drawImage(
        bitmap,
        (480 - bitmap.width * scale) / 2,
        (640 - bitmap.height * scale) / 2,
        bitmap.width * scale,
        bitmap.height * scale,
      );
      bitmap.close();
      const data = canvas.toDataURL("image/webp", 0.8);
      setDraft((current) =>
        current?.id === draftId
          ? { ...current, values: { ...current.values, posterImage: data } }
          : current,
      );
    } catch {
      setImageError("This image could not be opened. Try another image.");
    } finally {
      setImageBusy(false);
    }
  }
  function poster(title: string, id: string, src?: string) {
    const hue = [...id].reduce((sum, letter) => sum + letter.charCodeAt(0), 0) % 360;
    return (
      <span className="character-poster" style={{ "--poster-hue": hue } as React.CSSProperties}>
        {src ? (
          <img src={src} alt={`${title} poster`} />
        ) : (
          <>
            <svg viewBox="0 0 240 320" aria-hidden="true">
              <circle cx="120" cy="113" r="43" />
              <path d="M30 320v-48c0-62 40-101 90-101s90 39 90 101v48Z" />
            </svg>
            <span className="character-poster__monogram" aria-hidden="true">
              {title
                .split(/\s+/)
                .map((part) => part[0])
                .slice(0, 2)
                .join("") || "?"}
            </span>
          </>
        )}
      </span>
    );
  }
  function field(label: string, key: Field, placeholder: string, rows = 0, list?: string) {
    const props = {
      "aria-label": label,
      value: value(key),
      placeholder,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        change(key, e.target.value),
    };
    return (
      <label className="character-dossier__field">
        <span>{label}</span>
        {rows ? <textarea {...props} rows={rows} /> : <input {...props} list={list} />}
      </label>
    );
  }
  function links(ids: string[], empty: string) {
    return ids.length ? (
      ids.map((id) => (
        <button
          key={id}
          className="character-dossier__link"
          onClick={() => {
            setDraft(null);
            select([id]);
            onOpenNode(id);
          }}
        >
          {nodes[id]?.title ?? id}
        </button>
      ))
    ) : (
      <span className="character-dossier__muted">{empty}</span>
    );
  }
  return (
    <div className="characters-workspace">
      <aside className="characters-roster" aria-label="Character roster">
        <div className="characters-roster__heading">
          <div>
            <span className="characters-roster__eyebrow">Your cast</span>
            <h2>
              Characters <small>{characters.length}</small>
            </h2>
          </div>
          <button
            className="characters-roster__add"
            onClick={create}
            disabled={Boolean(draft)}
            title={draft ? "Save or cancel this profile first" : undefined}
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
              onChange={(event) => setCastQuery(event.target.value)}
            />
          </label>
          {castQuery && (
            <button
              type="button"
              aria-label="Clear character search"
              onClick={() => setCastQuery("")}
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
              disabled={Boolean(draft && item.id !== activeId)}
              title={
                draft && item.id !== activeId ? "Save or cancel this profile first" : undefined
              }
              onClick={() => choose(item.id)}
            >
              {poster(item.title, item.id, item.posterImage)}
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
          {!characters.length && <p className="characters-roster__empty">The cast starts here.</p>}
          {!!characters.length && !visibleCharacters.length && (
            <p className="characters-roster__empty" role="status">
              No characters match “{castQuery}”. Try a name, role or trait.
            </p>
          )}
        </div>
      </aside>
      <main className="character-dossier" aria-label="Character dossier">
        {character ? (
          <div className="character-dossier__inner" key={character.id}>
            <header className="character-dossier__header">
              <div>
                <span className="character-dossier__eyebrow">Character dossier</span>
                <h2>{character.title || "Untitled character"}</h2>
              </div>
              <div className="character-dossier__actions">
                {draft?.id === character.id ? (
                  <>
                    <button
                      type="button"
                      className="character-dossier__cancel"
                      onClick={() => setDraft(null)}
                    >
                      Cancel
                    </button>
                    <button type="button" className="character-dossier__edit" onClick={save}>
                      Save changes
                    </button>
                  </>
                ) : (
                  <button type="button" className="character-dossier__edit" onClick={() => edit()}>
                    Edit profile
                  </button>
                )}
              </div>
            </header>
            <div className="character-identity">
              {poster(character.title, character.id, value("posterImage"))}
              <div>
                <span className="character-dossier__eyebrow">At a glance</span>
                <p>
                  {[character.role, character.age].filter(Boolean).join(" · ") ||
                    "Character profile"}
                </p>
                <span className="character-identity__scenes">
                  {context?.sceneIds.length ?? 0} scenes in this story
                </span>
                {draft?.id === character.id && (
                  <div className="character-poster__controls">
                    <label className="character-poster__upload">
                      {imageBusy ? "Preparing image…" : "Upload poster"}
                      <input
                        aria-label="Upload character poster"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        disabled={imageBusy}
                        onChange={(event) => {
                          void uploadPoster(event.target.files?.[0]);
                          event.target.value = "";
                        }}
                      />
                    </label>
                    {value("posterImage") && (
                      <button type="button" onClick={() => change("posterImage", "")}>
                        Remove image
                      </button>
                    )}
                    <small>JPG, PNG or WebP · cropped to portrait</small>
                    {imageError && <span role="alert">{imageError}</span>}
                  </div>
                )}
              </div>
            </div>
            {draft?.id !== character.id ? (
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
                  ] as Field[]
                ).some((key) => Boolean(character[key]?.trim())) ? (
                  <section className="character-dossier__read" aria-label="Character details">
                    {(
                      [
                        ["Personality & motives", ["traits", "motivation", "conflict"]],
                        ["Appearance & style", ["appearance"]],
                        ["Backstory", ["backstory"]],
                        ["Relationship notes", ["relationships"]],
                      ] as [string, Field[]][]
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
                                        } as Partial<Record<Field, string>>
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
                    {field(
                      "Story role",
                      "role",
                      "Protagonist, foil…",
                      0,
                      "character-role-suggestions",
                    )}
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
                <details
                  className="character-dossier__fold"
                  open={Boolean(character.relationships)}
                >
                  <summary>
                    <span>05</span>
                    <strong>Relationship notes</strong>
                    <small>Private notes on connections</small>
                  </summary>
                  <div className="character-dossier__fold-body">
                    {field(
                      "Relationship notes",
                      "relationships",
                      "Tensions, loyalties, secrets…",
                      3,
                    )}
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
                <div>{links(context?.sceneIds ?? [], "No scenes linked yet")}</div>
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
                        onClick={() => choose(r.otherId)}
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
                <div>{links(context?.themeIds ?? [], "None linked")}</div>
              </div>
              <div className="character-dossier__context-row">
                <strong>Locations</strong>
                <div>{links(context?.locationIds ?? [], "None linked")}</div>
              </div>
            </section>
            <datalist id="character-role-suggestions">
              {CHAR_ROLE_SUGGESTIONS.map((role) => (
                <option key={role} value={role} />
              ))}
            </datalist>
          </div>
        ) : (
          <div className="character-dossier__start">
            <span aria-hidden="true">✦</span>
            <h2>Meet your cast</h2>
            <p>Add a character to start building their story.</p>
            <button onClick={create}>+ New character</button>
          </div>
        )}
      </main>
    </div>
  );
}
