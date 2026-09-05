import type { BoneyardSnapshot, Revision } from "./types";

export function revisionHeads(revisions: Revision[], entityId: string): Revision[] {
  const versions = revisions.filter((r) => r.entityId === entityId);
  const ancestors = new Set(versions.flatMap((r) => r.parents));
  return versions
    .filter((r) => !ancestors.has(r.id))
    .sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
}

export function materialize(revisions: Revision[]): BoneyardSnapshot {
  const result: BoneyardSnapshot = {
    ideas: [],
    thoughts: [],
    collections: [],
    memberships: [],
    connections: [],
    evolutions: [],
    conflicts: [],
    revisions,
  };
  const groups = new Map<string, Revision[]>();
  for (const r of revisions) {
    const group = groups.get(r.entityId) ?? [];
    group.push(r);
    groups.set(r.entityId, group);
  }
  for (const [entityId, versions] of groups) {
    const heads = revisionHeads(versions, entityId);
    const latest = heads.at(-1);
    if (!latest) continue;
    if (heads.length > 1) result.conflicts.push({ entityId, kind: latest.kind, versions: heads });
    switch (latest.kind) {
      case "idea":
        result.ideas.push(latest.value);
        break;
      case "thought":
        result.thoughts.push(latest.value);
        break;
      case "collection":
        result.collections.push(latest.value);
        break;
      case "membership":
        result.memberships.push(latest.value);
        break;
      case "connection":
        result.connections.push(latest.value);
        break;
      case "evolution":
        result.evolutions.push(latest.value);
        break;
    }
  }
  const activity = new Map(result.ideas.map((idea) => [idea.id, idea.updatedAt]));
  for (const thought of result.thoughts)
    if (!thought.deleted)
      activity.set(thought.ideaId, Math.max(activity.get(thought.ideaId) ?? 0, thought.updatedAt));
  result.ideas.sort(
    (a, b) =>
      Number(b.pinned) - Number(a.pinned) || (activity.get(b.id) ?? 0) - (activity.get(a.id) ?? 0),
  );
  result.thoughts.sort((a, b) => a.createdAt - b.createdAt);
  return result;
}
