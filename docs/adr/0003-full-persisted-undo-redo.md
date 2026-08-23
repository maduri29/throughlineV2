# ADR-0003: Full persisted undo/redo on the story graph

Status: accepted

Every graph mutation (structure moves, adds, deletes, field edits across all lenses) is
undoable via an unlimited-depth-feel stack with redo (`Ctrl+Z` / `Ctrl+Shift+Z`), and the
history **survives app restarts** by persisting to IndexedDB alongside the project.
Deletion therefore has **no confirm dialog**: deletes are instant with a 5-second undo
toast. History is recorded **per gesture** (a drag = one entry; a connect = one entry;
rapid typing within one field-focus session coalesces into one entry), scoped **per
project**, and **capped** (oldest entries drop beyond 200).

## Context

Human decision during T5 canvas-contract grilling (2026-08-22): chose "full stack" over
single-step undo, then chose "persisted history" over session-only. Both non-default;
consistent with their preference for structure and queryability.

## Considered options

- Single-step undo / deferred post-v1: rejected — insufficient safety once delete confirms
  were also dropped in favor of undo toasts.
- Session-only history: rejected by human.
- Snapshot-per-action persistence: rejected for size; we persist an **inverse-operation op
  log** (serializable JSON per entry) instead of node/edge snapshots.

## Consequences

- Every mutation path must emit an inverse op — this touches the store layer once,
  centrally (actions funnel through a `commit(op)` chokepoint).
- Op-log schema needs a version field; corrupt/truncated tails are discarded on load.
- History is per project and lives in the project's IndexedDB record set; deleting a
  project deletes its history.
- Persisted history makes "revert to just-before-crash" trivially true — pairs with
  ADR-0004's autosave.
