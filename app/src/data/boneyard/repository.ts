import { dbGetAll, dbTransaction } from "../idb";
import { uuidv7 } from "../uuid";
import { useGraphStore } from "../../store";
import type { GraphEdge, GraphNode } from "../../types";
import { materialize, revisionHeads } from "./model";
import { parseRevisions, validateHistory } from "./validation";
import type { EntityMap, EvolutionInput, Idea, Kind, Revision } from "./types";

export const CHANGE_EVENT = "throughline:boneyard-changed";
function notify() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CHANGE_EVENT));
}
export function ideaLabel(idea: Idea): string {
  return (
    idea.title.trim() ||
    idea.body
      .split(/\r?\n/)
      .find((line) => line.trim())
      ?.trim()
      .slice(0, 100) ||
    "Untitled idea"
  );
}
function seedNode(idea: Idea): GraphNode {
  const legacySynopsis = idea.body.startsWith(`${idea.title}\n\n`)
    ? idea.body.slice(idea.title.length + 2)
    : undefined;
  return {
    id: idea.id,
    type: "seed",
    title: ideaLabel(idea),
    ...(idea.updatedAt === 0
      ? legacySynopsis
        ? { synopsis: legacySynopsis }
        : {}
      : { synopsis: idea.body }),
  };
}
function revision<K extends Kind>(kind: K, value: EntityMap[K], parents: string[] = []): Revision {
  return { id: uuidv7(), entityId: value.id, kind, parents, at: Date.now(), value } as Revision;
}

/** An append-only revision store preserves concurrent branches instead of replacing text. */
export async function mergeRevisions(input: Revision[]): Promise<void> {
  const incoming = parseRevisions(input);
  let projected: Idea[] = [];
  await dbTransaction(["boneyard", "nodes"], (tx) => {
    const store = tx.objectStore("boneyard");
    const read = store.getAll();
    read.onsuccess = () => {
      try {
        const existing = parseRevisions(read.result);
        const all = new Map(existing.map((r) => [r.id, r]));
        for (const r of incoming) {
          const prior = all.get(r.id);
          if (prior && JSON.stringify(prior) !== JSON.stringify(r))
            throw new Error("A revision ID was reused with different content.");
          all.set(r.id, r);
        }
        const combined = [...all.values()];
        validateHistory(combined);
        const existingIds = new Set(existing.map((r) => r.id));
        for (const r of incoming) if (!existingIds.has(r.id)) store.add(r);
        projected = materialize(combined).ideas;
        for (const idea of projected) tx.objectStore("nodes").put(seedNode(idea));
      } catch {
        tx.abort();
      }
    };
  });
  useGraphStore.setState({
    seeds: projected.filter((idea) => idea.disposition !== "trash").map(seedNode),
  });
  notify();
}

export async function loadBoneyard() {
  const [records, nodes, edges] = await Promise.all([
    dbGetAll<Revision>("boneyard"),
    dbGetAll<GraphNode>("nodes"),
    dbGetAll<GraphEdge>("edges"),
  ]);
  const known = new Set(records.filter((r) => r.kind === "idea").map((r) => r.entityId));
  const migration: Revision[] = [];
  for (const seed of nodes.filter((n) => n.type === "seed" && !n.parentId && !known.has(n.id))) {
    const body = seed.synopsis ? `${seed.title}\n\n${seed.synopsis}` : seed.title;
    const value: Idea = {
      id: seed.id,
      title: seed.title,
      body,
      original: body,
      tags: seed.sparkType ? [seed.sparkType] : [],
      pinned: false,
      disposition: "active",
      createdAt: null,
      updatedAt: 0,
    };
    const hash = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(JSON.stringify(value)),
    );
    const digest = Array.from(new Uint8Array(hash))
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("");
    migration.push({
      id: `legacy:${seed.id}:${digest}`,
      entityId: seed.id,
      kind: "idea",
      parents: [],
      at: 0,
      value,
    });
  }
  const knownEvolutions = new Set(
    records.filter((r) => r.kind === "evolution").map((r) => r.entityId),
  );
  for (const edge of edges.filter((e) => e.type === "grew_into")) {
    const entityId = `legacy-evolution:${edge.id}`;
    const project = nodes.find((n) => n.id === edge.to && n.type === "project");
    if (
      !project ||
      knownEvolutions.has(entityId) ||
      records.some(
        (r) =>
          r.kind === "evolution" &&
          r.value.destinationId === project.id &&
          r.value.sourceIds.includes(edge.from),
      )
    )
      continue;
    migration.push({
      id: entityId,
      entityId,
      kind: "evolution",
      parents: [],
      at: 0,
      value: {
        id: entityId,
        sourceIds: [edge.from],
        destinationId: project.id,
        destinationTitle: project.title,
        summary: "",
        createdAt: 0,
      },
    });
  }
  if (migration.length) await mergeRevisions(migration);
  return materialize(migration.length ? await dbGetAll<Revision>("boneyard") : records);
}

export async function saveEntity<K extends Kind>(kind: K, value: EntityMap[K], parents: string[]) {
  await mergeRevisions([revision(kind, value, parents)]);
}

export async function evolveIdeas(input: EvolutionInput): Promise<string> {
  let destinationId = "";
  await dbTransaction(["boneyard", "nodes", "edges"], (tx) => {
    const read = tx.objectStore("boneyard").getAll();
    read.onsuccess = () => {
      try {
        const snapshot = materialize(parseRevisions(read.result));
        const prior = snapshot.evolutions.find((e) => e.id === input.operationId);
        if (prior) {
          destinationId = prior.destinationId;
          return;
        }
        const sourceIds = [...new Set(input.sourceIds)];
        if (
          !sourceIds.length ||
          sourceIds.some(
            (id) => !snapshot.ideas.some((i) => i.id === id && i.disposition !== "trash"),
          )
        )
          throw new Error("Choose available source ideas.");
        if (!input.title.trim()) throw new Error("Give the destination a title.");
        destinationId = input.destinationId ?? uuidv7();
        const write = () => {
          const referenceId = input.destinationId ? uuidv7() : undefined;
          const destination: GraphNode = referenceId
            ? {
                id: referenceId,
                type: "reference",
                parentId: destinationId,
                title: input.title.trim(),
                synopsis: input.summary,
              }
            : {
                id: destinationId,
                type: "project",
                title: input.title.trim(),
                synopsis: input.summary,
              };
          destination.ideaSources = sourceIds.map((id) => {
            const source = snapshot.ideas.find((i) => i.id === id)!;
            return { id, title: ideaLabel(source), body: source.body };
          });
          tx.objectStore("nodes").put(destination);
          for (const sourceId of sourceIds)
            tx.objectStore("edges").put({
              id: uuidv7(),
              type: "grew_into",
              from: sourceId,
              to: destinationId,
            } satisfies GraphEdge);
          tx.objectStore("boneyard").add(
            revision("evolution", {
              id: input.operationId,
              sourceIds,
              destinationId,
              destinationTitle: input.title.trim(),
              summary: input.summary,
              createdAt: Date.now(),
              ...(referenceId ? { referenceId } : {}),
            }),
          );
        };
        if (input.destinationId) {
          const target = tx.objectStore("nodes").get(input.destinationId);
          target.onsuccess = () => {
            if (target.result?.type === "project") write();
            else tx.abort();
          };
        } else write();
      } catch {
        tx.abort();
      }
    };
  });
  const nodes = await dbGetAll<GraphNode>("nodes");
  useGraphStore.setState({
    projects: nodes.filter((n) => n.type === "project"),
    references: nodes.filter((n) => n.type === "reference"),
  });
  notify();
  return destinationId;
}

export async function exportBoneyard(): Promise<string> {
  await loadBoneyard();
  return JSON.stringify(
    {
      format: "throughline-boneyard",
      version: 1,
      exportedAt: Date.now(),
      revisions: await dbGetAll<Revision>("boneyard"),
    },
    null,
    2,
  );
}
export async function importBoneyard(text: string): Promise<void> {
  if (text.length > 20_000_000) throw new Error("This backup is too large (20 MB maximum).");
  const data: unknown = JSON.parse(text);
  if (
    !data ||
    typeof data !== "object" ||
    !("format" in data) ||
    data.format !== "throughline-boneyard" ||
    !("version" in data) ||
    data.version !== 1 ||
    !("revisions" in data)
  )
    throw new Error("Choose a Throughline Boneyard backup. Story backups belong in Stories.");
  await mergeRevisions(parseRevisions(data.revisions));
}
export { revisionHeads };
