# ADR-0007: Automatic sync, and sign-in as the first screen

Status: accepted

Partially supersedes **ADR-0005**. Sync becomes automatic rather than manual, and signing in
becomes the default entry to the app rather than an optional extra. ADR-0005's storage tier,
RLS requirements and secret-key rules are unchanged and still binding.

## Context

Human decision (2026-08-23), reached by working the design tree question by question. The
stated need was specific and narrow: *"I need to save my work so that I can work from multiple
devices at different times."*

That reframes what auth is for. ADR-0005 treated the cloud as a **backup tier** — a copy taken
deliberately, by pressing Push. A backup you must remember to take is adequate for durability
and useless for continuity: edit on the laptop, forget to push, open the phone, edit the stale
copy, push, and the laptop's evening is gone. Not a merge bug — just forgetting.

The deployed app is a **personal instance**. One writer, several machines, sequential use. That
answer is what makes the decisions below reasonable, and what would make most of them wrong for
any other audience. **If the audience ever changes, this ADR is the thing to revisit, not patch.**

## Decisions

1. **Auto-sync**: metadata pulled on open, payload pulled lazily, push debounced after edits.
2. **Sign-in first**, on a real `/signin` route, with an offline escape.
3. **Conflicts fork.** A push is accepted only if the pusher last saw the revision the server
   still holds. A stale push is refused and the refused version is kept as a separate story.
4. **No auto-seeded demo.** `boot()` previously fabricated a story whenever storage was empty;
   under auto-sync that demo would upload and propagate to every device. The sample story
   becomes an explicit action.
5. **Signing in adopts all local stories** automatically.
6. **Sign-out pushes first**, and only a failed push asks for a decision.
7. **Two status indicators**, local and cloud. The local one must not read as an all-clear —
   it says "Saved on this device", never a bare tick.
8. **New signups disabled** at the project. The bundle ships a publishable key by design, so
   without this anyone finding the URL can register into a personal instance.
9. **Bring-your-own project survives**, demoted behind an *Advanced* disclosure. Its
   `validateConfig` guard — which refuses a secret key — is the part worth keeping.

## What this overturns in ADR-0005

> *"Signed-out remains a first-class state. Sync is additive; no feature may become reachable
> only when signed in, or the local-first claim in `CONTEXT.md` becomes false."*

Signed-out is now a **deliberate detour**, not the default. The app still opens, edits, and
exports with no network and no account — that part of the local-first claim holds — but the
first screen asks you to sign in, because for a personal instance whose whole purpose is device
continuity, work stranded on a device you were not signed into is the failure mode.

One consequence must not be soft-pedalled: because signing in adopts every local story
(decision 5), **"continue without signing in" is not a privacy choice.** It means "work offline
for now", and everything written that way uploads at the next sign-in. The UI has to say that
rather than imply otherwise.

ADR-0005's "last-write-wins, not collaboration" is **replaced** by decision 3. Last-write-wins
was defensible when a human chose each push; it is not defensible when the app pushes on its own.

## Why forking rather than merging

The asymmetry is enormous and one-directional. Losing an hour of writing is catastrophic and
unrecoverable — the op-log (ADR-0003) cannot reach a project replaced wholesale. An extra card
on the shelf costs two seconds to delete. Every branch in `data/sync.ts` resolves that
asymmetry the same way, including pulling on top of unsaved edits, which is the same hazard
wearing different clothes.

Real per-scene merging needs CRDTs and its own decision. It is not required here: the stated
use is sequential, across times, by one person.

## How it was validated

Built first as a throwaway prototype — `prototype/sync-machine.html`, a self-contained page
where the machine is driven by hand and every edit is a visible token, so "did work get lost"
is read rather than trusted. Five walkthroughs, all preserving every scene.

**The prototype was not sufficient, and that is worth recording.** Lifting the machine into
`src/data/sync.ts` and sweeping every combination of local and remote state in
`tests/sync.test.ts` found a hole all five hand-written walkthroughs missed: pulling with
unsaved local edits at a revision that had *not* moved fell through to adopt, overwriting those
edits with the very content they were written on top of. Silent loss, no conflict to show for
it. Hand-picked scenarios sample the space; they do not cover it.

## Consequences

- `pushProject` gains optimistic concurrency: it updates conditionally on the revision the
  client last saw, so a stale push affects zero rows and is reported rather than winning.
  The `revision` column and the `touch_project()` trigger from ADR-0005 already exist for this
  and were previously unread.
- The decision logic stays **pure** in `data/sync.ts` and performs no I/O. That separation is
  what makes the sweep above possible, and it is the reason the hole was findable.
- **Stories are URLs, not modes.** `/stories` is the Library and `/stories/<id>` is one
  story, so a story can be linked to, bookmarked, reloaded and reached with the back button.
  The previous `level` state was invisible to all four. Choosing a story is two things — which
  project is loaded and which level is on screen — and while a card only did the first, clicking
  a story appeared to do nothing at all.
- The `[id]` segment is `force-static` with a seeded `generateStaticParams`. The shell is
  byte-identical for every id because the app reads the id in the browser, so without it Next
  would render the segment on demand and put a serverless hop in front of a page the CDN can
  already serve — quietly breaking ADR-0006's "prerenders static" property.
- Storage of `{base, dirty}` per project is local bookkeeping and lives in the IndexedDB meta
  store, not in the graph — it describes this device's relationship to the cloud, not the story.
