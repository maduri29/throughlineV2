---
id: T2
title: Fountain subset specification
labels: [wayfinder:research]
status: closed
assignee: agent/fountain-researcher
blocked-by: []
---

## Question

Which precise subset of the Fountain syntax does Throughline v1 parse (preview) and emit
(export)? Research against primary sources (fountain.io syntax reference; the fountain
GitHub org specs if needed) and write `research/fountain-subset.md` in the repo covering:

- Title page keys we will emit (Title, Credit, Author, Draft date, Contact) and parse-order rules.
- Element grammar we support in v1: scene headings (INT./EXT./EST/I/E., forced with `.`),
  action, character cues (uppercase + forced `@`), parentheticals, dialogue, transitions
  (`CUT TO:`, forced `>`), dual dialogue?, centered text?, notes/boneyards?
- Explicitly-out elements (and how the preview degrades when encountering them).
- Export assembly rules: slug line construction from graph fields, scene ordering, blank-line
  conventions, Unicode considerations.
- A tiny conformance fixture set (input → expected element list) usable later as bun tests.

*Charting-session note:* a researcher may already have produced this asset before formal
claiming; if `research/fountain-subset.md` exists, verify it against sources rather than redoing.

## Resolution

Closed by agent/fountain-researcher (2026-08-22). Asset: **`research/fountain-subset.md`** —
all claims cited live to fountain.io/syntax/ (spec v1.1), the FAQ, and the official
Brick-&-Steel sample; 9 conformance fixtures ready to become bun tests.

Verdicts: **full support** = title page, scene headings (auto prefixes + forced `.` + `#n#`
numbers), action (+ `!`), character cues (uppercase rule + forced `@`), parentheticals,
dialogue, transitions (`TO:` + forced `>`), centered `>…<`. **Graceful degradation** (parsed,
badged, round-tripped intact): dual dialogue `^`, notes `[[…]]`, sections/synopses `#`/`=`,
lyrics `~`, page breaks `===`. Nothing rejected; boneyard exclusion is spec conformance.
Key rulings: heading > transition > cue precedence; mid-line `INT.` can never head;
bare `23` = Action while forced `@23` honored. Export: slug `{PREFIX} {LOCATION} - {TIME}`,
exactly one empty line between elements, zero typographic substitution, UTF-8/LF,
`<kebab-title>.fountain`.

Unblocks **Script editor & export contract**.
