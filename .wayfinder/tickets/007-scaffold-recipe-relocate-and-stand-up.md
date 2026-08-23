---
id: T7
title: Scaffold recipe — relocate repo and stand up the app package
labels: [wayfinder:task]
status: closed
assignee: agent/ox-alpha
blocked-by: ["T1"]
---

## Question

What is the verified, copy-exact procedure to go from this folder to a runnable
`C:\dev\throughline` checkout of Throughline?

Execute (AFK) and document:

1. Relocate the repo (docs, `prototype/`, `.wayfinder/`) to `C:\dev\throughline`.
2. Create the app package (`app/`) using T1's proven recipe verbatim (scripts, TS7 strict
   tsconfig, oxfmt/oxlint configs, Bun server entry with HTML import).
3. Seed the store with a TypeScript port of the HIGH WATER demo data (clearly marked
   throwaway pending the final model).
4. Run the whole quality gate end-to-end with proof outputs.

## Resolution

Closed by **agent/ox-alpha directly** (2026-08-22) after two delegated runners died without
producing anything. Full log: **`SCAFFOLD.md`** at repo root.

- **Relocation — COPY-first deviation:** repo artifacts copied to `C:\dev\throughline`
  (+ git init) instead of moved, because the live session still runs from the OneDrive cwd.
  OneDrive folder is now a frozen pre-relocation snapshot; switchover/deletion awaits human
  blessing. From now on `.wayfinder/` in `C:\dev\throughline` is the tracker source of truth.
- **App package** built per `research/bun-native-proof.md`: aggregate `check` script,
  TS7 strict tsconfig with `types:["bun"]`, ambient `bun-html.d.ts`, oxfmt ignorePatterns
  set before first run, oxlint four plugins, `Bun.serve` + HTML imports dev server (:4517),
  static dist server (:4518).
- **Skeleton UI** renders the locked Map direction — Beat-board cards × Storyline episode
  bands + flashback lane + typed-edge colors — over the seeded graph; zustand persisted to
  IndexedDB via idb-keyval (normalized ADR-0001 adapter lands during build).
- **Seed**: HIGH WATER, 26 nodes / 40 edges (15 scenes D1–D12 across RISE/PRESSURE/BREACH,
  flashbacks D-9/D-2, 4 characters, 4 locations, 2 themes, 12-edge vocabulary exercised),
  local uuidv7(), marked throwaway.
- **Proofs**: install 39 pkgs/3.37s · `bun run check` exit 0 (fmt+lint+tsc strict) ·
  build 144 modules/68ms (0.57MB JS + merged CSS) · dev 200 + `/boot` pid + headless DOM
  markers · static 200/asset 200/404 + headless DOM markers.

Unblocks nothing further in wayfinder — this closes the last open task ticket; remaining
work is grilling contracts (T4 keyboard remainder, T5, T6) then the execution phase.

**Addendum (same day):** relocated again at human request — live repo is now
`C:\Users\madur\work\throughline` (git history intact, `abcacc4`). `SCAFFOLD.md` at repo
root carries the full log with updated paths.
