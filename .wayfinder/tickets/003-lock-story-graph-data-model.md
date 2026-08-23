---
id: T3
title: Lock the story-graph data model
labels: [wayfinder:grilling]
status: closed
assignee: agent/ox-alpha+human
blocked-by: []
---

## Question

What is the canonical domain model — the nouns, their fields, and the typed edge vocabulary —
that every view (map, timeline, characters, inspector, editor, library) reads and writes?

Settle at minimum:

- Entity fields, finalized: seed/idea, project (format enum), episode, scene (incl.
  `int_ext`, time-of-day, narrative order vs story time representation, flashback flag,
  attached Fountain text), character (role/want/wound/arc), location, theme.
- Edge vocabulary + directionality rules + which (from-type,to-type) pairs are legal
  (start from the prototype's `edgeOptions` table; challenge it).
- Multi-project library schema: IndexedDB object stores, key design, project metadata record,
  delete/import/export semantics, schema versioning field for future migrations.
- Identity: id format, collision policy across imported projects.
- Write the glossary to `CONTEXT.md` (glossary ONLY — no implementation) and record the model
  as `docs/adr/0001-story-graph-data-model.md`.

Consult Skills: `grilling`, `domain-modeling`. The prototype (`prototype/throughline.html`)
is the starting point to challenge, not gospel.

## Resolution

Closed by agent/ox-alpha+human (2026-08-22). Human decisions (grilling round):
**fully structured story time** · **12-type edge vocabulary** (the prototype's 11 plus a
dedicated Sets Up/Pays Off connection) · **UUIDv7 identity** · **normalized IndexedDB stores**
(overriding the blob-per-project recommendation — queryability prioritized).

Artifacts:
- **`CONTEXT.md`** — glossary only: story material, story-time terms (Narrative Order,
  Story Day, Time of Day, Era Label, Flashback-as-link), all twelve connections, lens/app terms.
- **`docs/adr/0001-story-graph-data-model.md`** — normative: store layout (`projects`,
  `nodes`, `edges`, `settings`; `projectId` indexes), edge legality table, structured time
  triple `{storyDay, tod, eraLabel}`, timeline sort rules, flashback lane derived by
  traversing Flashback Of edges (boolean flag deliberately abolished), export/import envelope,
  idb-keyval dropped in favor of a custom normalized adapter under Zustand.

Supersessions recorded: prototype regex story-time sorting and boolean flashback flag.
Unblocks **Canvas interaction contract** and **Script editor & export contract**.
