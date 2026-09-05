import { useCallback, useEffect, useRef, useState } from "react";
import { useGraphStore } from "../../store";
import { uuidv7 } from "../../data/uuid";
import {
  CHANGE_EVENT,
  evolveIdeas,
  exportBoneyard,
  importBoneyard,
  loadBoneyard,
  revisionHeads,
  saveEntity,
} from "../../data/boneyard/repository";
import type {
  BoneyardSnapshot,
  Collection,
  EvolutionInput,
  Idea,
  Revision,
} from "../../data/boneyard/types";

const EMPTY: BoneyardSnapshot = {
  ideas: [],
  thoughts: [],
  collections: [],
  memberships: [],
  connections: [],
  evolutions: [],
  conflicts: [],
  revisions: [],
};
export function useBoneyard() {
  const [snapshot, setSnapshot] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const graphSeeds = useGraphStore((s) => s.seeds);
  useEffect(() => {
    let active = true;
    let generation = 0;
    async function refresh() {
      const current = ++generation;
      try {
        const next = await loadBoneyard();
        if (active && current === generation) setSnapshot(next);
      } catch (cause) {
        if (active) setError(String(cause));
      } finally {
        if (active) setLoading(false);
      }
    }
    void refresh();
    const handle = () => {
      void refresh();
    };
    window.addEventListener(CHANGE_EVENT, handle);
    window.addEventListener("focus", handle);
    return () => {
      active = false;
      window.removeEventListener(CHANGE_EVENT, handle);
      window.removeEventListener("focus", handle);
    };
  }, [graphSeeds]);
  const run = useCallback(async (action: () => Promise<unknown>) => {
    if (busy.current) return false;
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      await action();
      setSnapshot(await loadBoneyard());
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      return false;
    } finally {
      busy.current = false;
      setPending(false);
    }
  }, []);
  const parents = (id: string) => revisionHeads(snapshot.revisions, id).map((r) => r.id);
  const idea = (id: string) => {
    const found = snapshot.ideas.find((i) => i.id === id);
    if (!found) throw new Error("Idea not found.");
    return found;
  };
  async function editIdea(id: string, patch: Partial<Idea>, basis?: string[]) {
    const current = idea(id);
    await saveEntity(
      "idea",
      {
        ...current,
        ...patch,
        id,
        original: current.original,
        createdAt: current.createdAt,
        updatedAt: Date.now(),
      },
      basis ?? parents(id),
    );
  }
  return {
    currentParents: async (id: string) =>
      revisionHeads((await loadBoneyard()).revisions, id).map((r) => r.id),
    snapshot,
    loading,
    error,
    pending,
    run,
    capture: async (body: string) => {
      if (!body.trim()) throw new Error("Write a thought first.");
      const id = uuidv7();
      const now = Date.now();
      await saveEntity(
        "idea",
        {
          id,
          title: "",
          body,
          original: body,
          tags: [],
          pinned: false,
          disposition: "active",
          createdAt: now,
          updatedAt: now,
        },
        [],
      );
      return id;
    },
    editIdea,
    addThought: async (ideaId: string, body: string) => {
      idea(ideaId);
      if (!body.trim()) throw new Error("Write a thought first.");
      const now = Date.now();
      await saveEntity(
        "thought",
        { id: uuidv7(), ideaId, body, createdAt: now, updatedAt: now, deleted: false },
        [],
      );
    },
    editThought: async (id: string, body: string, deleted = false, basis?: string[]) => {
      const entry = snapshot.thoughts.find((t) => t.id === id);
      if (!entry) throw new Error("Thought not found.");
      await saveEntity(
        "thought",
        { ...entry, body, deleted, updatedAt: Date.now() },
        basis ?? parents(id),
      );
    },
    createCollection: async (title: string) => {
      if (!title.trim()) throw new Error("Name the collection.");
      await saveEntity(
        "collection",
        { id: uuidv7(), title: title.trim(), description: "", deleted: false },
        [],
      );
    },
    editCollection: async (id: string, patch: Partial<Collection>) => {
      const current = snapshot.collections.find((c) => c.id === id);
      if (!current) throw new Error("Collection not found.");
      await saveEntity("collection", { ...current, ...patch, id }, parents(id));
    },
    setMembership: async (ideaId: string, collectionId: string, present: boolean) => {
      idea(ideaId);
      const id = `member:${collectionId}:${ideaId}`;
      await saveEntity("membership", { id, ideaId, collectionId, deleted: !present }, parents(id));
    },
    connect: async (from: string, to: string, note: string) => {
      idea(from);
      idea(to);
      if (from === to) throw new Error("Choose another idea.");
      const pair = [from, to].sort();
      const id = `link:${pair.join(":")}`;
      await saveEntity(
        "connection",
        { id, from: pair[0]!, to: pair[1]!, note, deleted: false },
        parents(id),
      );
    },
    disconnect: async (id: string) => {
      const current = snapshot.connections.find((c) => c.id === id);
      if (current) await saveEntity("connection", { ...current, deleted: true }, parents(id));
    },
    evolve: (input: EvolutionInput) => evolveIdeas(input),
    resolve: async (version: Revision) => {
      await saveEntity(version.kind, version.value, parents(version.entityId));
    },
    restoreRevision: async (version: Revision) => {
      const value =
        version.kind === "idea" ? { ...version.value, updatedAt: Date.now() } : version.value;
      await saveEntity(version.kind, value, parents(version.entityId));
    },
    exportBackup: async () => {
      const url = URL.createObjectURL(
        new Blob([await exportBoneyard()], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `boneyard-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    importBackup: async (file: File) => {
      if (file.size > 20_000_000) throw new Error("Backup exceeds 20 MB.");
      await importBoneyard(await file.text());
    },
    revisit: async () => {
      const now = Date.now();
      const candidate = snapshot.ideas
        .filter(
          (i) =>
            i.disposition === "active" &&
            (i.snoozedUntil ?? 0) <= now &&
            (!i.lastShownAt || now - i.lastShownAt > 86400000),
        )
        .sort((a, b) => (a.lastShownAt ?? a.updatedAt) - (b.lastShownAt ?? b.updatedAt))[0];
      if (!candidate) return null;
      await saveEntity("idea", { ...candidate, lastShownAt: now }, parents(candidate.id));
      return candidate.id;
    },
  };
}
export type BoneyardController = ReturnType<typeof useBoneyard>;
