---
id: T5
title: Canvas interaction contract
labels: [wayfinder:grilling]
status: open
assignee:
blocked-by: ["T3"]
---

## Question

What are the exact interaction rules of the story-graph canvas in React Flow terms?

Settle at minimum:

- Custom node/edge rendering contract (what data each reads; selection/hover/filters semantics).
- Connection flow: drag-to-connect affordance, legal-pair enforcement UX, edge-type chooser,
  labeled relationships (relates_to) input pattern.
- Autosave semantics with zustand persist over IndexedDB: write timing, crash safety,
  "saved" indicator truthfulness.
- Undo/redo: in v1 or explicitly deferred to fog? Decide with reasons either way.
- Pan/zoom/fit conventions, double-click-to-add, type filter chips, delete confirmations.
- Accessibility floor for v1 (what is honestly reachable by keyboard alone).

**Locked visual input (2026-08-22):** the human picked the map-rework winner — **Beat
board cards inside Storyline bands + flashback lane, Tidy default, Filters chips**, with
the typed-edge color legend as secondary language (`prototype/map-rework.html` variants
C×A; recorded in map Notes). This contract specifies *that* lens in React Flow terms;
free-form constellation layout is out. The scaffold's `app/src/App.tsx` band layout is the
starting point.

Consult Skills: `grilling`, `domain-modeling`, and `prototype` if an interaction pattern needs
a cheap artifact. Blocked by T3 because legality rules read the locked edge vocabulary.

**Resolution =** canvas contract section + ADRs for any hard-to-reverse choice (undo presence,
autosave strategy).
