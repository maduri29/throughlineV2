// Automatic cloud sync decisions (ADR-0007).
//
// This module is the state machine validated in `prototype/sync-machine.html`,
// lifted out of it. Everything here is PURE: it decides what should happen, and
// cloud.ts performs it. The split is deliberate — the dangerous logic is the
// deciding, and keeping it free of network and storage is what makes it
// testable at the level where losing an evening's work would actually show up.
//
// The rule the whole design rests on: a push is accepted only if the pusher
// last saw the revision the server still holds. A stale push is REFUSED, and
// the refused version is kept as a separate story rather than discarded.
// Losing an hour of writing is catastrophic; an extra card on the shelf is two
// seconds of annoyance. Every branch below resolves that asymmetry the same way.

/** What this device knows about a story's relationship to the cloud. */
export type LocalSync = {
  /** Revision this device last successfully exchanged, or null if never pushed. */
  base: number | null;
  /** Local edits exist that the cloud has not accepted. */
  dirty: boolean;
};

/** What the cloud reports for a story. Null when it has never been pushed. */
export type RemoteSync = { revision: number } | null;

export type PushPlan =
  /** Nothing to send. */
  | { kind: "skip"; reason: string }
  /** No cloud copy yet; insert one. */
  | { kind: "create" }
  /** Update, but only if the cloud is still at `expect`. */
  | { kind: "update"; expect: number }
  /** The cloud moved on. Keep ours aside, take theirs. */
  | { kind: "fork"; saw: number | null; remote: number };

export type PullPlan =
  | { kind: "skip"; reason: string }
  /** Take the cloud copy wholesale; nothing local is at risk. */
  | { kind: "adopt"; revision: number }
  /** Cloud moved on AND we have unsaved edits. Keep ours aside, take theirs. */
  | { kind: "fork"; saw: number | null; remote: number };

/** Conditions under which sync must not run at all. */
export type Gate = { online: boolean; signedIn: boolean };

/**
 * Decide what pushing this story should do.
 *
 * Note `create` is returned only when the cloud has no copy. A device holding
 * base=null for a story the cloud *does* know about has diverged (it was
 * created independently on two devices, or the local record was rebuilt), and
 * that is a fork, not an overwrite.
 */
export function planPush(local: LocalSync, remote: RemoteSync, gate: Gate): PushPlan {
  if (!gate.signedIn) return { kind: "skip", reason: "not signed in" };
  if (!gate.online) return { kind: "skip", reason: "offline" };
  // Nothing dirty means nothing to send, whatever `base` says. The `base !== null`
  // clause this replaced made a not-yet-downloaded story (a library placeholder,
  // which is `{base: null, dirty: false}`) fall through to `create` and collide
  // with the cloud copy it was standing in for.
  if (!local.dirty) return { kind: "skip", reason: "up to date" };

  if (remote === null) return { kind: "create" };
  if (local.base === remote.revision) return { kind: "update", expect: remote.revision };
  return { kind: "fork", saw: local.base, remote: remote.revision };
}

/**
 * Decide what pulling this story should do.
 *
 * Pulling on top of unsaved local edits is the same hazard as a stale push —
 * taking the cloud copy would silently drop whatever is on this device — so it
 * resolves the same way rather than inventing a second policy.
 */
export function planPull(local: LocalSync, remote: RemoteSync, gate: Gate): PullPlan {
  if (!gate.signedIn) return { kind: "skip", reason: "not signed in" };
  if (!gate.online) return { kind: "skip", reason: "offline" };
  if (remote === null) return { kind: "skip", reason: "not in the cloud" };

  // Same revision means the cloud holds nothing we do not already have, whether
  // or not we have unsaved edits on top. Adopting here would overwrite those
  // edits with content identical to what they were written on top of — silent
  // loss with no conflict to show for it. Found by the exhaustive sweep in
  // tests/sync.test.ts; every hand-written scenario missed it.
  if (remote.revision === local.base) return { kind: "skip", reason: "up to date" };

  if (local.dirty) return { kind: "fork", saw: local.base, remote: remote.revision };
  return { kind: "adopt", revision: remote.revision };
}

/**
 * Name for the copy kept aside after a conflict.
 *
 * Timestamped rather than device-named: the app has no reliable device
 * identity, and a week later "which of these two is which" is answered by when
 * it happened, not by a machine name the writer never chose.
 */
export function forkTitle(title: string, when: Date = new Date()): string {
  const stamp = when.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${title} (unsynced copy · ${stamp})`;
}

/** Whether signing out would strand work (ADR-0007: push first, warn on failure). */
export function unsyncedCount(all: Iterable<LocalSync>): number {
  let n = 0;
  for (const s of all) if (s.dirty || s.base === null) n++;
  return n;
}

/* ------------------------------------------------------------------ status -- */

/** Cloud-side status for one story, for the indicator pair (ADR-0007 decision 10). */
export type CloudStatus = "off" | "offline" | "local-only" | "pending" | "syncing" | "synced";

export function cloudStatus(local: LocalSync, gate: Gate, inFlight: boolean): CloudStatus {
  if (!gate.signedIn) return "off";
  if (inFlight) return "syncing";
  if (!gate.online) return local.dirty || local.base === null ? "offline" : "synced";
  if (local.base === null) return "local-only";
  return local.dirty ? "pending" : "synced";
}

/** Writer-facing label. Deliberately never says "saved" for local-only state. */
export function cloudLabel(status: CloudStatus): string {
  switch (status) {
    case "off":
      return "Not syncing";
    case "offline":
      return "Offline — will sync";
    case "local-only":
      return "This device only";
    case "pending":
      return "Syncing soon";
    case "syncing":
      return "Syncing…";
    case "synced":
      return "In your account";
  }
}
