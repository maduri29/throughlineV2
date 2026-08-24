// Orchestration for automatic sync (ADR-0007).
//
// sync.ts decides, cloud.ts performs, this joins them and keeps the per-device
// bookkeeping. Deliberately thin: anything here that grows a branch worth
// reasoning about belongs in sync.ts, where it can be swept exhaustively rather
// than reasoned about by hand — which is how the pull-overwrite hole was found.
import { cloudState, pullProject, pushProject } from "./cloud";
import type { Envelope } from "./envelope";
import { metaGet, metaSet } from "./idb";
import { planPush, type Gate, type LocalSync } from "./sync";
import type { GraphEdge, GraphNode } from "../types";

/**
 * Bookkeeping lives in the meta store, not in the graph.
 *
 * `{base, dirty}` describes *this device's* relationship to the cloud, not
 * anything about the story. Putting it on the project node would sync it, which
 * is both meaningless on another device and a source of spurious edits.
 */
const key = (projectId: string): string => `sync:${projectId}`;

export async function readSync(projectId: string): Promise<LocalSync> {
  // A story we have never recorded is treated as never pushed and unsaved, which
  // is the safe reading: it schedules a push rather than assuming one happened.
  return (await metaGet<LocalSync>(key(projectId))) ?? { base: null, dirty: true };
}

export async function writeSync(projectId: string, meta: LocalSync): Promise<void> {
  await metaSet(key(projectId), meta);
}

export async function markSyncDirty(projectId: string): Promise<void> {
  const cur = await readSync(projectId);
  if (!cur.dirty) await writeSync(projectId, { ...cur, dirty: true });
}

export async function forgetSync(projectId: string): Promise<void> {
  await metaSet(key(projectId), { base: null, dirty: true });
}

/** Conditions sync runs under. `navigator.onLine` is a hint, not a guarantee. */
export async function readGate(): Promise<Gate> {
  const s = await cloudState();
  return {
    online: typeof navigator === "undefined" ? true : navigator.onLine,
    signedIn: s.kind === "signed-in",
  };
}

export type SyncOutcome =
  | { kind: "skipped"; reason: string }
  | { kind: "pushed"; revision: number }
  | { kind: "failed"; error: string }
  /** The cloud moved on. Caller must fork before adopting `remote`. */
  | { kind: "conflict"; remote: Envelope; remoteRevision: number };

/**
 * Push one story.
 *
 * No pre-flight read of the cloud revision: `planPush` is fed what this device
 * last saw, and the conditional update on the server is the authority on whether
 * that is still true. One round trip in the common case, and no window between
 * checking and writing in which another device could slip in.
 */
export async function pushOne(
  project: GraphNode,
  nodes: Record<string, GraphNode>,
  edges: Record<string, GraphEdge>,
): Promise<SyncOutcome> {
  const local = await readSync(project.id);
  const gate = await readGate();
  const plan = planPush(local, local.base === null ? null : { revision: local.base }, gate);

  if (plan.kind === "skip") return { kind: "skipped", reason: plan.reason };
  // planPush cannot see the cloud, so it never returns "fork" here; divergence
  // is reported by the server below. Guard anyway rather than assume.
  if (plan.kind === "fork") {
    return { kind: "failed", error: "Unexpected local fork plan without a cloud read." };
  }

  const expect = plan.kind === "update" ? plan.expect : null;
  const res = await pushProject(project, nodes, edges, expect);

  if (res.ok) {
    await writeSync(project.id, { base: res.revision, dirty: false });
    return { kind: "pushed", revision: res.revision };
  }
  if (!res.stale) return { kind: "failed", error: res.error };

  const remote = await pullProject(project.id);
  if (typeof remote === "string") return { kind: "failed", error: remote };
  return { kind: "conflict", remote, remoteRevision: res.remote };
}
