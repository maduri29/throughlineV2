---
id: T5
title: Canvas interaction contract
labels: [wayfinder:grilling]
status: closed
assignee: agent/ox-alpha+human
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

## Resolution

Closed 2026-08-22 after three grilling rounds. The contract, in React Flow terms:

**Visual basis (locked earlier):** Beat-board cards × Storyline episode bands + flashback
lane; Tidy layout default; Filters toolbar; typed-edge color legend as secondary language.

1. **Keyboard scope — navigation + safety keys**: arrows pan; `Tab`/`Shift+Tab` cycle node
   selection; `Enter` moves focus into the Inspector for the selection; `Esc` deselects /
   cancels an in-flight connect; `Delete` deletes the selection (instant, undo toast);
   `Ctrl+S` force-saves (ADR-0004). Node creation and edge wiring remain pointer-driven;
   full keyboard editing is post-v1.
2. **Undo/redo — full stack, persisted** (ADR-0003): per-gesture inverse-op log per project,
   cap 200, survives restarts; `Ctrl+Z` / `Ctrl+Shift+Z`; header controls mirror it.
3. **Autosave — hybrid** (ADR-0004): ~800 ms debounced write-through + manual force-save;
   indicator shows `Saving… → Saved` truthfully.
4. **Connect flow — drag-connect + legality picker**: drag from a node handle onto a target;
   a popover lists only edge types legal for that pair per ADR-0001 (relates_to exposes a
   free-text label there and in the Inspector); `Esc` cancels.
5. **Deletion — instant + undo toast** (5 s), no confirm dialogs anywhere on the canvas;
   safety comes from ADR-0003's undo, not modal friction.
6. **Filters — type toggle chips**: Scene / Character / Location / Theme / Flashback; hiding
   a type hides its nodes *and* their edges; chip state persists locally per project and is
   not part of export.
7. **Add-node — context-aware double-click**: double-click inside an episode band appends a
   Scene to that episode's narrative order end; double-click on the flashback lane offers a
   flashback scene (negative storyDay); non-scene nodes are born from the left rail/toolbar,
   not the canvas.
8. **Multi-select — shift+click and marquee box**, both; Delete/move act on all selected.
9. **Pan/zoom — React Flow defaults**: wheel zooms to cursor, drag empty space pans, fit
   control included, zoom clamped 0.25×–2.5×.
10. **Selection semantics**: single or multi selection feeds one Inspector; edges selectable;
    selecting an edge shows its type (changeable within legality) and, for relates_to, its
    label field.

**Accessibility floor (honest v1 statement):** navigating, inspecting, selecting, and
deleting the graph is fully keyboard-reachable; creating nodes and wiring edges requires a
pointer. That is the shipped floor, not an accident.

ADRs: **ADR-0003** (full persisted undo/redo), **ADR-0004** (hybrid autosave).
