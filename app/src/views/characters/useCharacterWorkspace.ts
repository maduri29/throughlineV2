import { useMemo, useState } from "react";
import { characterDetails } from "../../data/characters";
import { useGraphStore } from "../../store";
import { processPosterImage } from "./posterImage";
import type { CharacterDraft, CharacterField } from "./CharacterDossier";

const FIELDS: CharacterField[] = [
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

export function useCharacterWorkspace() {
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const projectId = useGraphStore((s) => s.projectId);
  const selection = useGraphStore((s) => s.selection);
  const select = useGraphStore((s) => s.select);
  const addNodeOfType = useGraphStore((s) => s.addNodeOfType);
  const patchNode = useGraphStore((s) => s.patchNode);

  const [chosenId, setChosenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CharacterDraft>(null);
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
  const lowerCastQuery = useMemo(() => castQuery.trim().toLowerCase(), [castQuery]);

  const visibleCharacters = useMemo(
    () =>
      characters.filter(
        (item) =>
          !lowerCastQuery ||
          [item.title, item.role, item.age, item.synopsis, item.traits]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(lowerCastQuery),
      ),
    [characters, lowerCastQuery],
  );

  const activeId =
    fromGraph ??
    (chosenId && nodes[chosenId]?.type === "character" ? chosenId : null) ??
    characters[0]?.id ??
    null;

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
    const values = Object.fromEntries(FIELDS.map((key) => [key, source[key] ?? ""])) as Record<
      CharacterField,
      string
    >;
    setDraft({ id, values });
  }

  function save() {
    if (imageBusy) return;
    if (!draft || !nodes[draft.id]) return;
    const patch = Object.fromEntries(
      FIELDS.filter((key) => nodes[draft.id]?.[key] !== draft.values[key]).map((key) => [
        key,
        draft.values[key],
      ]),
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

  function changeField(key: CharacterField, next: string) {
    setDraft((current) =>
      current ? { ...current, values: { ...current.values, [key]: next } } : current,
    );
  }

  async function uploadPoster(file?: File) {
    if (!file || !draft) return;
    const draftId = draft.id;
    setImageError("");
    setImageBusy(true);
    try {
      const dataUrl = await processPosterImage(file);
      setDraft((current) =>
        current?.id === draftId
          ? { ...current, values: { ...current.values, posterImage: dataUrl } }
          : current,
      );
    } catch (err) {
      setImageError(err instanceof Error ? err.message : "This image could not be opened.");
    } finally {
      setImageBusy(false);
    }
  }

  return {
    nodes,
    characters,
    visibleCharacters,
    activeId,
    character,
    context,
    details,
    draft,
    setDraft,
    imageBusy,
    imageError,
    castQuery,
    setCastQuery,
    edit,
    save,
    choose,
    create,
    changeField,
    uploadPoster,
    select,
  };
}
