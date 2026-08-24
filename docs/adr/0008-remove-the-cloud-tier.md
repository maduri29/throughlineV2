# ADR-0008: Remove the Supabase sync tier

Status: accepted

Supersedes **ADR-0005** and **ADR-0007** entirely. Supabase, GitHub sign-in, accounts,
automatic sync, conflict forking and the `/signin` route are removed. Throughline is a
local-first application again, with no network dependency of any kind.

`navigator.storage.persist()` (ADR-0004 era) and the lossless JSON envelope (ADR-0001) remain:
they are how work survives, and neither needs a server.

## Context

Human decision (2026-08-23), after the sync tier repeatedly broke the application in ways that
were only visible to the person using it.

The tier was built carefully — a prototype, a pure decision module, an exhaustive sweep over
every combination of local and remote state — and it still shipped three failures that made the
whole app unusable:

- **A redirect loop.** The root handoff and the sign-in gate were separate effects both calling
  `location.replace`, so at `/` they raced and each hop restarted session restoration, which
  re-raced the check that caused the hop. A page in that loop never finishes booting, so every
  button in the app does nothing — reported three times as three unrelated features being broken.
- **A destructive pull.** Every project predating the tier had no sync record, and the default
  for "no record" looked exactly like a conflict against a cloud row with the same id. Signing in
  and opening an old story replaced its contents with the cloud copy.
- **A permanently dead database connection.** `onversionchange` closed the cached IndexedDB
  handle without clearing the cache, so every later read returned nothing and every write did
  nothing, silently, until a reload.

## What this says about the testing, which is the part worth keeping

Each of those was fixed, and each fix passed. The suite never caught any of them, and the reason
is the same every time: **the whole suite ran signed out.** Signed-in was the only state that
mattered and the only state never exercised, because exercising it needs a real account, a real
session and a real server.

That is the actual argument for removal. It was not that sync is hard; it is that this sync
could not be verified without the thing it depended on, so every change to it was a guess that
happened to pass. A feature whose failure mode is invisible to its own test suite is a feature
that will keep breaking, and the cost of that landed on the writer rather than on CI.

## Decisions

1. Delete `data/cloud.ts`, `data/cloudSync.ts`, `data/sync.ts` and the `@supabase/supabase-js`
   dependency. Delete `supabase/migrations/`.
2. Delete the `/signin` route, `AuthDialog`, `SignInScreen` and `CloudStrip`.
3. Remove all cloud state from the store: `cloud`, `forks`, `syncNow`, `pullCurrent`,
   `syncLibrary`, `adoptLocalStories`, `syncAllNow`, `dismissForks`.
4. The header carries **one** save indicator again. Two reported two guarantees while there was
   a cloud to report on; saying it twice now would be theatre.
5. **The app opens straight onto the shelf.** Nothing stands between a cold load and the work.

## Consequences

- Multi-device continuity — the thing the tier existed for — is gone, and remains the open
  problem. Backup is manual again, via the ADR-0001 envelope.
- The publishable Supabase credentials that were compiled into the bundle are gone with it.
  They were safe by design, but one fewer thing shipped is one fewer thing to reason about.
- A `verify:ui` assertion now checks the app makes **no third-party requests at all**, so a
  remnant of this tier cannot survive quietly.
- Nothing here forecloses persistence. It rules out *this* persistence: an always-on sync tier
  that the app cannot function without and the test suite cannot see.
