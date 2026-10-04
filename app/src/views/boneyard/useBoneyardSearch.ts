import { useMemo, useState } from "react";
import type { Idea, Membership, Thought } from "../../data/boneyard/types";

export interface UseBoneyardSearchOptions {
  ideas: Idea[];
  thoughts: Thought[];
  memberships: Membership[];
}

export function useBoneyardSearch({ ideas, thoughts, memberships }: UseBoneyardSearchOptions) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("active");
  const [collectionId, setCollectionId] = useState("");
  const [visibleLimit, setVisibleLimit] = useState(100);

  const term = query.trim().toLocaleLowerCase();

  const thoughtsByIdea = useMemo(() => {
    const grouped = new Map<string, Thought[]>();
    for (const thought of thoughts) {
      if (!thought.deleted) {
        const list = grouped.get(thought.ideaId) ?? [];
        list.push(thought);
        grouped.set(thought.ideaId, list);
      }
    }
    return grouped;
  }, [thoughts]);

  const searchIndex = useMemo(
    () =>
      new Map(
        ideas.map((idea) => [
          idea.id,
          [
            idea.title,
            idea.body,
            ...idea.tags,
            ...(thoughtsByIdea.get(idea.id) ?? []).map((t) => t.body),
          ]
            .join("\n")
            .toLocaleLowerCase(),
        ]),
      ),
    [ideas, thoughtsByIdea],
  );

  const matches = useMemo(() => {
    return ideas.filter((idea) => {
      if (
        filter === "pinned"
          ? !idea.pinned || idea.disposition !== "active"
          : idea.disposition !== filter
      ) {
        return false;
      }
      if (
        collectionId &&
        !memberships.some(
          (m) => !m.deleted && m.ideaId === idea.id && m.collectionId === collectionId,
        )
      ) {
        return false;
      }
      return !term || !!searchIndex.get(idea.id)?.includes(term);
    });
  }, [ideas, filter, collectionId, memberships, term, searchIndex]);

  return {
    query,
    setQuery,
    filter,
    setFilter,
    collectionId,
    setCollectionId,
    visibleLimit,
    setVisibleLimit,
    term,
    thoughtsByIdea,
    searchIndex,
    matches,
  };
}
