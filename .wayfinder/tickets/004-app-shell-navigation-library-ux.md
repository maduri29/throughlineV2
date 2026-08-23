---
id: T4
title: App shell, navigation and library UX contract
labels: [wayfinder:grilling]
status: open
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

**Resolution =** a written UX contract section (in the spec doc this map converges on) +
any ADR-worthy choice (e.g. tab-state vs router) gets its own ADR.
