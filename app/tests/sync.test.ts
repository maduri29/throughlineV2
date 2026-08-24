// The sync decisions (ADR-0007), lifted from prototype/sync-machine.html.
//
// The prototype proved five hand-driven scenarios. These tests cover the space
// those scenarios sample: the last one sweeps every combination of local and
// remote state and asserts the property the whole design rests on — no plan
// ever replaces local work without first setting a copy of it aside.
import { expect, test } from "bun:test";
import {
  cloudLabel,
  cloudStatus,
  forkTitle,
  planPull,
  planPush,
  unsyncedCount,
  type Gate,
  type LocalSync,
  type RemoteSync,
} from "../src/data/sync";

const ON: Gate = { online: true, signedIn: true };

/* ---------------------------------------------------------------- gating -- */

test("nothing syncs while signed out", () => {
  expect(planPush({ base: null, dirty: true }, null, { online: true, signedIn: false })).toEqual({
    kind: "skip",
    reason: "not signed in",
  });
});

test("nothing syncs while offline — work waits, it is not lost", () => {
  const plan = planPush(
    { base: 1, dirty: true },
    { revision: 1 },
    { online: false, signedIn: true },
  );
  expect(plan).toEqual({ kind: "skip", reason: "offline" });
});

/* ------------------------------------------------------------------ push -- */

test("first push creates the cloud copy", () => {
  expect(planPush({ base: null, dirty: true }, null, ON)).toEqual({ kind: "create" });
});

test("a clean story pushes nothing", () => {
  expect(planPush({ base: 3, dirty: false }, { revision: 3 }, ON)).toEqual({
    kind: "skip",
    reason: "up to date",
  });
});

test("push updates only when the cloud is where we left it", () => {
  expect(planPush({ base: 3, dirty: true }, { revision: 3 }, ON)).toEqual({
    kind: "update",
    expect: 3,
  });
});

test("push forks when the cloud has moved on — the case this design exists for", () => {
  expect(planPush({ base: 3, dirty: true }, { revision: 5 }, ON)).toEqual({
    kind: "fork",
    saw: 3,
    remote: 5,
  });
});

test("a story created independently on two devices forks, never overwrites", () => {
  // base=null normally means "new", but the cloud already has this id: the two
  // sides diverged, so treating it as a create would clobber the other device.
  expect(planPush({ base: null, dirty: true }, { revision: 2 }, ON)).toEqual({
    kind: "fork",
    saw: null,
    remote: 2,
  });
});

/* ------------------------------------------------------------------ pull -- */

test("pull adopts freely when there are no local edits at risk", () => {
  expect(planPull({ base: 2, dirty: false }, { revision: 7 }, ON)).toEqual({
    kind: "adopt",
    revision: 7,
  });
});

test("pull forks rather than dropping unsaved local edits", () => {
  expect(planPull({ base: 2, dirty: true }, { revision: 7 }, ON)).toEqual({
    kind: "fork",
    saw: 2,
    remote: 7,
  });
});

test("pull skips a story the cloud does not have", () => {
  expect(planPull({ base: null, dirty: true }, null, ON)).toEqual({
    kind: "skip",
    reason: "not in the cloud",
  });
});

/* --------------------------------------------------------------- labels --- */

test("a fork keeps the original title findable", () => {
  const t = forkTitle("Neon Harvest", new Date("2026-08-23T14:32:00"));
  expect(t.startsWith("Neon Harvest")).toBe(true);
  expect(t).toContain("unsynced copy");
});

test("the cloud indicator never claims saved for work only on this device", () => {
  const off = cloudStatus({ base: null, dirty: true }, ON, false);
  expect(off).toBe("local-only");
  expect(cloudLabel(off).toLowerCase()).not.toContain("saved");
  expect(cloudLabel("synced")).toBe("In your account");
});

test("unsyncedCount sees both never-pushed and edited-since", () => {
  expect(
    unsyncedCount([
      { base: 1, dirty: false },
      { base: 1, dirty: true },
      { base: null, dirty: false },
    ]),
  ).toBe(2);
});

/* ------------------------------------------------------------- invariant -- */

test("no push or pull plan ever replaces local work without forking first", () => {
  const locals: LocalSync[] = [];
  for (const base of [null, 1, 2, 3] as Array<number | null>) {
    for (const dirty of [true, false]) locals.push({ base, dirty });
  }
  const remotes: RemoteSync[] = [null, { revision: 1 }, { revision: 2 }, { revision: 3 }];

  let forks = 0;
  for (const local of locals) {
    for (const remote of remotes) {
      const push = planPush(local, remote, ON);
      const pull = planPull(local, remote, ON);

      // A push that writes must be writing on top of exactly what it last saw.
      if (push.kind === "update") expect(local.base).toBe(push.expect);
      // A create must never land on an existing cloud copy.
      if (push.kind === "create") expect(remote).toBeNull();
      // Adopting overwrites local content, so it is only legal with nothing dirty.
      if (pull.kind === "adopt") expect(local.dirty).toBe(false);

      // Whenever local work exists and the cloud disagrees, the answer is a fork.
      const conflict = remote !== null && local.base !== remote.revision;
      if (conflict && local.dirty) {
        expect(push.kind).toBe("fork");
        expect(pull.kind).toBe("fork");
        forks++;
      }
      if (push.kind === "fork") forks++;
    }
  }
  expect(forks).toBeGreaterThan(0); // the sweep actually exercised the branch
});
