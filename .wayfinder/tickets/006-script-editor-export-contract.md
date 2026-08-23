---
id: T6
title: Script editor and export contract
labels: [wayfinder:grilling]
status: closed
assignee: agent/ox-alpha+human
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

## Resolution

Closed 2026-08-22 after one grilling round plus a layout probe
(`prototype/script-editor.html`, three switchable variants; human picked **Split**).

1. **Scene list semantics — parent-container order, movie-friendly**: the screenplay follows
   each scene's parent container's list order — an **episode** for series projects, **the
   project itself** for features (ADR-0001 `contains` already permits project→scene). This is
   the same draggable narrativeOrder shown as Map bands; one order, one source of truth.
   Episode headers export as Fountain section markers (`# EPISODE ONE — RISE`); features emit
   no section headers.
2. **Editing surface — Split view**: Fountain textarea left, live T2-subset preview right,
   draggable divider clamped 15–85%, preview collapsible for distraction-free drafting.
   One fragment per scene; fragment text lives on the scene node per ADR-0001's normalized
   stores.
3. **Skeleton generation**: new fragments open with the synced slug as locked first line plus
   a **full template** — bracketed hint blocks (`[ACTION — …]`, example cue with
   parenthetical + dialogue hints) that render visibly highlighted in preview and are meant
   to be overwritten. Flashback scenes auto-insert immediately before their `flashback_of`
   target at creation; afterwards they are ordinary list entries.
4. **Slug ownership — graph-owned, auto-synced**: `INT./EXT. LOCATION - TIME` regenerates from
   scene fields whenever they change; it is not hand-editable in v1. Missing fields degrade
   explicitly (`UNTITLED` location / omitted time segment) with an Inspector nudge until set.
5. **Preview renderer scope**: exactly the T2 subset; unknown elements degrade per T2's rules.
6. **Export assembly**: title page sourced from the project node (title, author, contact,
   format), then containers in library order → scenes in list order, slug line synced at
   export time. UTF-8, LF, filename `<kebab-case-title>.fountain`; download via Blob URL +
   anchor click under Bun-served static app (no server round-trip).
7. **Round-trip honesty statement**: v1 is **export-only**. Importing our own `.fountain`
   back is parse-free-deferred to post-v1 and would lose graph links (`flashback_of`,
   `appears_in`, …), scene metadata, and ordering — the `.fountain` file is a projection,
   never the source of truth.

No deviations from T2's subset spec were needed.
