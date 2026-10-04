import type { GraphEdge, GraphNode } from "../types";

export type CloudRecord = {
  kind: "nodes" | "edges";
  id: string;
  data: GraphNode | GraphEdge | null;
  version: number;
};
export type CloudChange = Omit<CloudRecord, "version"> & { baseVersion: number };
export type CloudConflict = CloudRecord & { local: GraphNode | GraphEdge | null };
export const recordKey = (record: Pick<CloudRecord, "kind" | "id">) =>
  `${record.kind}:${record.id}`;
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonical(item)]),
    );
  return value;
}
export const sameContent = (a: unknown, b: unknown): boolean =>
  JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

export function changedRecords(
  nodes: GraphNode[],
  edges: GraphEdge[],
  baseline: CloudRecord[],
): CloudChange[] {
  const prior = new Map(baseline.map((r) => [recordKey(r), r]));
  const current: CloudRecord[] = [
    ...nodes.map((data) => ({ kind: "nodes" as const, id: data.id, data, version: 0 })),
    ...edges.map((data) => ({ kind: "edges" as const, id: data.id, data, version: 0 })),
  ];
  const changes: CloudChange[] = [];
  for (const record of current) {
    const key = recordKey(record);
    const base = prior.get(key);
    if (!base || !sameContent(base.data, record.data))
      changes.push({
        kind: record.kind,
        id: record.id,
        data: record.data,
        baseVersion: base?.version ?? 0,
      });
    prior.delete(key);
  }
  for (const record of prior.values())
    if (record.data !== null)
      changes.push({ kind: record.kind, id: record.id, data: null, baseVersion: record.version });
  return changes;
}
