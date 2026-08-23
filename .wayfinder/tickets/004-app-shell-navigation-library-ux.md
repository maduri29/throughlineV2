---
id: T4
title: App shell, navigation and library UX contract
labels: [wayfinder:grilling]
status: closed
assignee: agent/ox-alpha+human
blocked-by: []
---

## Question

What is the application's shape when you open it? Settle:

- Navigation IA: view switching (map / timeline / characters / script) — tab state vs router;
  where the library screen sits; what "opening a project" means concretely.
- Library screen contract: create/rename/duplicate/delete project flows, last-opened memory,
  demo-project seeding for first run, import/export entry points.
- Global chrome: top bar contents per view, inspector panel behavior across views, keyboard map
  (which prototype shortcuts survive), toasts.
- Empty states catalog for v1 (no projects, empty graph, no scenes yet, broken import file).

Consult Skills: `grilling`, `domain-modeling`; if UI-fidelity questions dominate, use
`prototype` skill for a cheap clickable stub before deciding. The prototype's shell is the
baseline to evolve, not preserve.

## Resolution

Closed 2026-08-22 across two grilling rounds with the human (second round completed under
T5 once its keyboard question was un-parked):

- **Shell IA**: two-level — **Library ↔ Workspace**. Workspace switches lenses
  (Map / Timeline / Characters / Script) via **tab state, no router**; lens choice is
  per-project UI state. Opening a project = entering Workspace with that project loaded.
- **Library**: create / rename / duplicate / delete projects; remembers last-opened;
  **auto-seeds the HIGH WATER demo project on first run**; import/export entry points live
  here (export envelope per ADR-0001).
- **Global chrome**: top bar = library button · project title · lens tabs · autosave
  indicator (ADR-0004) · undo/redo controls (ADR-0003). Inspector is a right panel in all
  lenses; toasts carry undo affordances for destructive actions.
- **Keyboard scope** (the parked item, settled in T5 Round 1): *navigation + safety keys* —
  pan/zoom/select by keyboard and wheel, `Esc` deselects, `Delete` on selection (undo toast,
  no dialog); node creation and edge wiring stay pointer-driven. Full keyboard editing is
  explicitly post-v1.

Remaining detail work (empty-state catalog wording, rename flows) happens in the execution
phase against this contract.
