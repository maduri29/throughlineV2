# Wayfinder Map — Throughline v1

> Local-markdown tracker convention: this folder (`.wayfinder/`) is the tracker.
> The map is `map.md`; tickets live in `tickets/NNN-slug.md`.
> A ticket is **claimed** when its front-matter `assignee:` is set (do this BEFORE working it).
> Blocking = the `blocked-by:[ids]` front-matter array; a ticket is on the **frontier** when open,
> unassigned, and every blocker is closed. Closing = set `status: closed` and append a
> `## Resolution` section to the ticket body, then add one line under the map's
> *Decisions so far*. Refer to tickets by title, never bare id.

## Destination

A locked, build-ready **v1 specification** for Throughline — every architectural decision
resolved and written down (CONTEXT.md glossary + ADRs + verified toolchain recipes) such that
an execution session can build the app without making further decisions: a Pure-Bun,
local-first story-graph app (graph canvas, dual-order timeline, characters lens, inspector,
multi-project library) with a Fountain textarea editor and `.fountain` export.

## Notes

- **Product**: Throughline — brainstorm ideas → shape into films/series → organize characters,
  scenes, locations, themes, timelines on a visual graph → write screenplay. Behavioral
  reference implementation: `prototype/throughline.html` (vanilla, validated). Product rationale:
  `IDEAS.md`; market/toolchain research: `RESEARCH.md`.
- **Stack pins (verified 2026-08-22)**: Bun **1.4.0** — *native fullstack, NO Vite, NO Node runtime*
  (`Bun.serve` + HTML imports in dev with `--hot`, `bun build` for prod). TypeScript **^7.0.2**
  (bin is `tsc`; typecheck script `tsc --noEmit`, near-instant). oxfmt **0.64.x** (`.oxfmtrc.json`).
  oxlint **1.79.x** (`.oxlintrc.json`; listing `plugins` overwrites defaults — include
  react/unicorn/typescript/oxc explicitly). React **19** + `@xyflow/react` **12.11.x** +
  zustand (state layer) over a custom **normalized IndexedDB** adapter per ADR-0001
  (the earlier idb-keyval plan is dropped).
- **Repo location**: the repo lives at **`C:\Users\madur\work\throughline`** — scaffolded
  COPY-first at `C:\dev\throughline` (T7), then moved to `work\throughline` at human request
  same day. This is the live repo and tracker source of truth; future sessions run from
  here. The OneDrive folder is a frozen snapshot pending deletion.
- **Map lens direction (human review of `prototype/map-rework.html`, 2026-08-22)**:
  **Beat board × Storyline** — rich light-theme beat cards living in permanent episode
  bands + flashback lane, Tidy layout default with a Filters toolbar; the Constellation's
  typed-edge color legend carries over as secondary language. Feeds T5.
- **Scope fence (v1)**: graph canvas (typed nodes/edges) · dual-order timeline · characters lens ·
  inspector · multi-project library · IndexedDB persistence · Fountain textarea+preview editor ·
  `.fountain` export. Nothing else.
- **HITL tickets**: consult the Skill tool for `grilling` + `domain-modeling` (and `prototype`
  where the ticket names UI fidelity). Facts are the agent's job — dispatch researchers;
  decisions are the human's.

## Decisions so far

<!-- one line per closed ticket: - [Title](tickets/…md): gist -->

- [Fountain subset specification](tickets/002-fountain-subset-specification.md): v1 parses/previews/emits the full core grammar with graceful degradation for dual dialogue, notes, sections; 9 conformance fixtures ready — asset `research/fountain-subset.md`.
- [Lock the story-graph data model](tickets/003-lock-story-graph-data-model.md): 12 typed edges, UUIDv7 identity, structured story time `{storyDay,tod,eraLabel}`, normalized IndexedDB stores; artifacts `CONTEXT.md` + `docs/adr/0001-story-graph-data-model.md`.
- [Prove Bun-native fullstack with React Flow](tickets/001-prove-bun-native-fullstack.md): all milestones passed on Bun 1.4.0 — dev-HMR zero-restart, prod build, TS7 strict + oxfmt/oxlint gates; recipe `research/bun-native-proof.md`, decision `docs/adr/0002-pure-bun-native-toolchain.md`.
- [Scaffold recipe — relocate and stand up](tickets/007-scaffold-recipe-relocate-and-stand-up.md): executed directly after two failed runners; COPY-first relocation (live repo now `C:\Users\madur\work\throughline`), app/ per proof recipe, HIGH WATER seed, full gate + dev/prod runtime proofs green — log `SCAFFOLD.md`.
- [App shell, navigation and library UX contract](tickets/004-app-shell-navigation-library-ux.md): two-level Library↔Workspace, lens tabs as state (no router), auto-seeded HIGH WATER demo, keyboard = navigation + safety keys; detail flows land in execution phase.
- [Canvas interaction contract](tickets/005-canvas-interaction-contract.md): Beat×Storyline in React Flow terms — drag-connect legality picker, instant delete + undo toast, type-toggle filters, context-aware double-click add, shift+click & marquee multi-select, RF-default pan/zoom, honest a11y floor; ADRs `docs/adr/0003-full-persisted-undo-redo.md` + `docs/adr/0004-hybrid-autosave.md`.

## Not yet specified

- Visual polish/theming system (tokens, dark/light) — sharpens after shell/navigation contract.
- Error-handling & empty-state catalog — graduates from library + editor contracts.
- ~~Accessibility baseline~~ — floor settled by T5: nav/inspect/select/delete fully
  keyboard-reachable; creation is pointer-first (post-v1 candidate).
- Testing strategy (bun test scope: unit parser/store vs none-for-v1) — after scaffold proves.
- ~~Undo/redo depth~~ — settled by T5 / ADR-0003: full stack, persisted per project.
- Performance targets for large graphs (500+ nodes) — post-v1 unless spec demands.

## Out of scope

- `.fdx` import/export (ruled out Round 1 scope fence).
- AI assistance in any form (post-v1).
- CodeMirror or custom block-based screenplay editor — block editor is the named **post-v1
  fast-follow**; textarea+preview ships in v1.
- Realtime collaboration / CRDT sync / cloud accounts.
- Mobile-native packaging; PWA/desktop wrappers undecided until after v1 ships.
