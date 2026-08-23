---
id: T6
title: Script editor and export contract
labels: [wayfinder:grilling]
status: open
assignee:
blocked-by: ["T3", "T2"]
---

## Question

What exactly does the v1 Fountain editor do, scene by scene and project-wide?

Settle at minimum:

- Scene list semantics: ordering source (narrative order field vs episode grouping),
  episode headers as sections, scenes missing required fields.
- Editing surface: per-scene Fountain textarea + live preview pane layout; skeleton generation
  from graph fields (slug from int_ext/location/time-of-day); where script text lives in the
  data model (must match T3's decision).
- Preview renderer scope: exactly the T2 subset; degrade behavior for unknown elements.
- Export: `.fountain` assembly order, title-page sourcing from the project node, filename
  conventions, download mechanism under Bun-served static app.
- Round-trip honesty statement: what importing our own export back would lose (v1 likely
  parse-free import — say so explicitly if so).

Consult Skills: `grilling`, `domain-modeling`. Blocked by T3 (where script text lives) and
T2 (the subset being rendered/emitted).

**Resolution =** editor/export contract section; any deviation from T2's spec recorded back
into that ticket's resolution.
