# ADR-0004: Hybrid autosave — debounced write-through plus manual force-save

Status: accepted

Work persists continuously: ~800 ms after the last change, the graph writes through to
IndexedDB and the header indicator flips `Saving… → Saved`. In addition, `Ctrl+S` (and a
header button) forces an immediate save regardless of debounce state, giving writers a
ceremony-free default with an explicit "safe now" ritual. Because IndexedDB commits are
atomic, an interrupted write leaves the previous good state intact.

## Context

Human decision during T5 grilling (2026-08-22) — picked the hybrid over pure-debounce and
pure-explicit models.

## Consequences

- The dirty-dot appears only between change and completed write (or on write failure),
  not as a standing "unsaved" guilt marker.
- Force-save doubles as a flush point before export operations (Fountain export in v1
  always exports the saved state).
- Save indicator must reflect promise truthfully: `Saving…` only while a write is in
  flight, `Saved` only after the IndexedDB transaction resolves.
