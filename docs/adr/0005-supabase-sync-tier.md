# ADR-0005: Supabase as a sync and durability tier above local-first storage

Status: accepted

Supersedes the "no accounts / no cloud" stance recorded in `CONTEXT.md`, `IDEAS.md` §6 and
the wayfinder map's *Out of scope* list. Throughline gains an **optional** account-backed
sync tier: Postgres on Supabase holds a server copy of each story graph, so work survives
losing the machine and follows the writer between devices.

IndexedDB **remains the working store**. Every read and write in the app still hits local
state first; the app opens, edits and exports with no network and no account. Supabase is a
tier above that, not a replacement for it. A signed-out user gets exactly the app that
shipped before this ADR.

## Context

Human decision (2026-08-23), taken after ADR-0004's autosave and the storage-durability work
landed. The trigger was stated as wanting "more consistent and persistent storage". Two
findings shaped the design rather than the request:

- **Changing the browser database does not buy durability.** SQLite-WASM over OPFS is
  frequently recommended as the upgrade from IndexedDB, but OPFS is also origin-private
  browser storage and is equally evictable. It buys *queries*, not *persistence*. The
  earlier `RESEARCH.md` persistence path is therefore not the answer to this problem.
- **Durability against device loss can only come from off-device storage.** Once that is
  accepted, an account is unavoidable, and the local-first stance had to be revisited
  explicitly rather than eroded by accident.

## Considered options

- **Stop at `navigator.storage.persist()` plus the manual JSON envelope** (the state before
  this ADR). Protects against browser eviction and is hand-restorable, but a lost laptop is
  a lost story and backups only happen when the writer remembers. Rejected as insufficient
  by the product owner.
- **File System Access API — the story as a real file in a chosen folder.** Survives
  clearing site data, composes with Dropbox and git, needs no account, and breaks no
  existing decision. Recommended by the agent; **not chosen**, because it does not solve
  device loss or multi-device use. Still worth adding later as a third tier; nothing here
  forecloses it.
- **PowerSync (or ElectricSQL) as a sync engine.** PowerSync is the most mature offline-first
  option for Supabase, but it syncs Postgres against **SQLite** on the client. Throughline
  stores normalized records in IndexedDB (ADR-0001) and already keeps an inverse-operation
  op-log (ADR-0003) that is a natural sync primitive. Adopting PowerSync would mean
  rewriting the storage layer to gain machinery we do not yet need. Rejected as premature;
  reconsider if real-time multi-writer editing (IDEAS Tier 4) becomes a goal.
- **Supabase Postgres + Auth, synced by our own push/pull over the existing envelope.**
  Chosen. Reuses `data/envelope.ts`, leaves ADR-0001 storage untouched, and keeps the
  offline path intact.

## Consequences

- **Row Level Security is not optional.** The publishable key ships inside the client bundle
  by design; a table without RLS is a public API. Every table gets RLS enabled and an
  owner-scoped policy, and the schema migration is written so that enabling RLS and creating
  the policy happen in the same statement block as the table.
- **The `secret` key never enters the repository or the client.** Only the project URL and
  the publishable (`sb_publishable_…`) key are referenced by the app. Legacy `anon` /
  `service_role` keys are deprecated by end of 2026 and are not used.
- **Sync is last-write-wins per project, not per field.** With a single writer per account
  this is honest and predictable. It is explicitly NOT collaboration: two devices editing the
  same project simultaneously will lose one side's edits, and the UI must say so rather than
  implying merge semantics we do not implement. Real multi-writer editing needs CRDTs and a
  separate decision.
- **Signed-out remains a first-class state.** Sync is additive; no feature may become
  reachable only when signed in, or the local-first claim in `CONTEXT.md` becomes false.
- **A pull is never destructive.** It arrives as a *new* local story, re-validated through
  the same `parseEnvelope` importer as a file the user picks, rather than overwriting the
  local project with the same `local_id`. Overwriting would destroy local edits invisibly and
  undo (ADR-0003) cannot reach a replaced project, whereas a duplicate story is visible on
  the shelf and one delete away. The cost — pulling twice gives two copies — is the cheaper
  failure, and is stated in the UI.
- **The client refuses a secret key rather than trusting the paste.** `validateConfig`
  rejects an `sb_secret_` prefix and decodes a legacy JWT to reject `role: service_role`,
  because such a key bypasses RLS entirely and the dashboard shows it beside the publishable
  one. Storing it is the single mistake this tier can invite that fails *silently* and
  exposes every account, so it is guarded in code and covered by tests and a UI assertion.
- ADR-0002 is unaffected: `@supabase/supabase-js` is a browser library, so no Node runtime
  is introduced and the Bun-native toolchain is unchanged.
- The product's positioning changes. "Your unproduced scripts never leave your machine" was
  a genuine differentiator for this audience; it now holds only while signed out. Marketing
  copy and `IDEAS.md` §5 must be updated to say so honestly.
