# Throughline v1 — Fountain Subset Specification

**Ticket:** T2 · **Primary sources:** syntax reference <https://fountain.io/syntax/> (self-labeled "1.1 – March 14, 2014" in its changelog), FAQ <https://fountain.io/faq/>, official sample <https://fountain.io/_downloads/Brick-&-Steel.fountain> (verified valid UTF-8 at fetch time). The GitHub `fountain` org contains only a `.github` repo (<https://api.github.com/orgs/fountain/repos>); fountain.io is the sole canonical spec home.

## 0. Verdict

Throughline v1 **fully supports** (parse → preview → export): title pages (our five keys plus tolerant passthrough of unknown keys), scene headings (automatic `INT/EXT/EST/I-E` detection, forced `.`, `#…#` scene numbers), action (incl. forced `!`), character cues (uppercase rule + forced `@`), parentheticals, dialogue, transitions (auto `TO:` + forced `>`), and centered text `>…<` (defined by the spec as an Action variant). **Parsed with graceful preview degradation:** dual dialogue `^` (modeled as paired cues, previewed stacked with a "dual" badge instead of side-by-side columns, re-emitted intact), notes `[[…]]` (hidden from formatted preview as comment chips, preserved in export), sections `#`/synopses `=` (extracted into outline/graph data, hidden from script body, preserved in export), lyrics `~` and page breaks `===` (trivial styled renderings). **Nothing is rejected:** boneyard `/* … */` content is excluded from preview/export because the spec itself ignores it "completely on formatted output" — that is conformance, not degradation; v1 still round-trips the raw span. Unknown constructs fall back to Action per the spec's error-handling rule ("When in doubt, Fountain returns text as Action").

## 1. Title page

- Optional, always first in the document; format `key: value`; keys may contain spaces and must end with a colon ([syntax §Title Page](https://fountain.io/syntax/#title-page)).
- Values are inline with the key **or** indented on following lines — indent = 3+ spaces **or a tab** — allowing multiple values per key (the official sample uses tabs).
- **Keys we emit, in order:** `Title:`, `Credit:`, `Author:`, `Draft date:`, `Contact:` (multi-line values tab-indented). Spec-recommended rendering: Title/Credit/Author centered; Draft date/Contact lower-left.
- Parsing: read `key: value` lines until the **first blank line**, treating indented lines as continuations of the previous key. Unknown keys are captured as metadata but ignored in render (spec: unsupported keys "will be ignored"). A lone `Draft date: …` line is a valid title page. An implicit page break follows the block ("just drop down two lines").

## 2. Supported element grammar

| Element | Exact textual marker ([syntax](https://fountain.io/syntax/)) |
|---|---|
| Scene heading | Blank line before **and** after; line *begins* (case-insensitive) with `INT`, `EXT`, `EST`, `INT./EXT`, `INT/EXT`, or `I/E` **followed by a dot or a space**. Forced: single leading `.` + alphanumeric (dot removed in output). Optional scene number: alphanumerics/dashes/periods wrapped in `#`, e.g. `#1A#`. Uppercase recommended, not required. |
| Action | Any paragraph matching no other element; forced with leading `!`. Leading tabs/spaces retained (tab → 4 spaces); every carriage return is intentional. |
| Character | Line entirely uppercase, one empty line before, **none after**, ≥1 alphabetical character. Forced with leading `@` (removed; mixed case preserved). Same-line extensions like `(O.S.)` may be any case (new in 1.1). |
| Parenthetical | Line wrapped in `(` `)` following a Character or Dialogue element. |
| Dialogue | Any text following a Character or Parenthetical; single newline inside = forced line break. |
| Transition | Uppercase, empty line before **and** after, ending in `TO:`. Forced with leading `>`. Escape hatches: leading `.` forces a heading; a space after the colon demotes to Action. |
| Dual dialogue | Caret `^` as the **last character** after the second cue of a matched pair; any spaces before it are ignored. |

Recognized out-of-set markers: centered `>text<` (leading spaces not preserved); note `[[…]]` inline or standalone (empty lines around a standalone note are removed); boneyard `/* … */` (only construct allowed to span blank lines); section = line starting with one or more `#`; synopsis = single line starting with `=`; lyric = leading `~`; page break = line of 3+ `=` alone.

## 3. Ambiguity rulings

1. **ALL-CAPS action mistaken for a cue.** Apply the spec order literally: heading-prefix match wins, then transition (`…TO:` with blank line after), then the cue rule. A line that passes only the cue rule becomes a cue even if semantically action; writers force Action with `!` (the spec's own example: `!SCANNING THE AISLES…`). Our preview flags auto-detected cues whose line contains lowercase-triggering punctuation? **No — no heuristics beyond spec**; the preview shows a "cue?" affordance only.
2. **`INT.` inside action text.** Heading detection is anchored at line start ("a line beginning with any of the following…") *and* requires a following blank line; mid-sentence `INT.` can never produce a heading.
3. **Numbers-only character names.** Spec: names "must include at least one alphabetical character. 'R2D2' works, but '23' does not." Bare `23` therefore parses as Action; explicit `@23` is honored (force overrides the heuristic — documented Throughline decision where the spec is silent).
4. **Precise cue heuristic.** A cue is: entire line uppercase (digits/punctuation allowed), ≥1 letter `A–Z`, exactly one empty line before it, a non-empty line immediately after it; leading indentation ignored. Note (deprecated in 1.1): two trailing spaces no longer force Action — do not implement.

## 4. Export assembly rules

- **Slug template:** `{PREFIX} {LOCATION} - {TIME}` where PREFIX ∈ `INT.` `EXT.` `EST.` `INT./EXT.` (graph field, default `INT.`), LOCATION uppercased free text, TIME uppercased (default `DAY`); optional scene number appended as `#{n}#`.
- **Separation: exactly one empty line between adjacent elements** (i.e., `\n\n`). This is the minimum conformant spacing: headings and transitions demand blank neighbors, and since Action treats every carriage return as intent, emitting extra blanks would fabricate paragraph breaks. Never emit blank lines inside dialogue (we do not use the two-space continuation trick).
- **Title-page termination:** one blank line after the last key, then the first scene heading (implicit page break per spec).
- **Unicode/em-dash policy:** zero typographic transformation — Fountain performs no smart-quote/em-dash substitution ("however you type your apostrophes, quotes, dashes, and dots, that's how they'll wind up in the screenplay"). We never rewrite `--` to `—`; user Unicode passes through; files written UTF-8 without BOM, LF endings (import normalizes CRLF).
- **Filename:** `<title-in-kebab-case>.fountain`, ASCII-folded; extension authority is the FAQ: "UTF-8 text files with the extension .fountain, .txt, or .spmd."

## 5. Conformance fixtures

### F1 — Plain scene + dialogue
```fountain
EXT. BRICK'S PATIO - DAY

STEEL
Beer's ready!
```
```json
[{"type":"scene_heading","text":"EXT. BRICK'S PATIO - DAY"},
 {"type":"character","text":"STEEL"},
 {"type":"dialogue","text":"Beer's ready!"}]
```

### F2 — Forced heading + forced action
```fountain
.SNIPER SCOPE POV

!SCANNING THE AISLES...
```
```json
[{"type":"scene_heading","text":"SNIPER SCOPE POV","forced":true},
 {"type":"action","text":"SCANNING THE AISLES...","forced":true}]
```

### F3 — Forced character (mixed case)
```fountain
@McCLANE
Yippie ki-yay!
```
```json
[{"type":"character","text":"McCLANE","forced":true},
 {"type":"dialogue","text":"Yippie ki-yay!"}]
```

### F4 — Parenthetical between cue and dialogue
```fountain
STEEL
(beer raised)
To retirement.
```
```json
[{"type":"character","text":"STEEL"},
 {"type":"parenthetical","text":"(beer raised)"},
 {"type":"dialogue","text":"To retirement."}]
```

### F5 — Auto and forced transitions
```fountain
They speed off.

CUT TO:

>Burn to White.
```
```json
[{"type":"action","text":"They speed off."},
 {"type":"transition","text":"CUT TO:","forced":false},
 {"type":"transition","text":"Burn to White.","forced":true}]
```

### F6 — Dual dialogue ruling case (second cue carries `^`)
```fountain
BRICK
Screw retirement.

STEEL ^
Screw retirement.
```
```json
[{"type":"character","text":"BRICK"},{"type":"dialogue","text":"Screw retirement."},
 {"type":"character","text":"STEEL","dual":true},{"type":"dialogue","text":"Screw retirement."}]
```
Preview: stacked blocks + "dual" badge; export re-emits `STEEL ^`.

### F7 — Title page (tab-continued Contact)
```fountain
Title:
	BRICK & STEEL
Credit: Written by
Author: Stu Maschwitz
Draft date: 1/27/2012
Contact:
	Next Level Productions
	Solvang, CA 93463

EXT. POOL - NIGHT
```
```json
[{"type":"title_page","keys":{"Title":["BRICK & STEEL"],"Credit":["Written by"],
   "Author":["Stu Maschwitz"],"Draft date":["1/27/2012"],
   "Contact":["Next Level Productions","Solvang, CA 93463"]}},
 {"type":"scene_heading","text":"EXT. POOL - NIGHT"}]
```

### F8 — Ambiguous ALL-CAPS action (spec's own trap)
```fountain
INT. CASINO - NIGHT

THE DEALER eyes the new player warily.

!SCANNING THE AISLES...
Where is that pit boss?
```
```json
[{"type":"scene_heading","text":"INT. CASINO - NIGHT"},
 {"type":"action","text":"THE DEALER eyes the new player warily."},
 {"type":"action","text":"SCANNING THE AISLES...\nWhere is that pit boss?"}]
```
Without the `!`, `SCANNING THE AISLES...` would parse as character+dialogue.

### F9 — Degrade set: note, section, synopsis, boneyard
```fountain
# ACT ONE

= Set up the retirees.

INT. TRAILER HOME - DAY

The take[[count it twice]] sits on the table.

/*
INT. GARAGE - DAY

Cut scene.
*/
```
```json
[{"type":"section","level":1,"text":"ACT ONE"},
 {"type":"synopsis","text":"Set up the retirees."},
 {"type":"scene_heading","text":"INT. TRAILER HOME - DAY"},
 {"type":"action","text":"The take sits on the table.","notes":["count it twice"]},
 {"type":"boneyard","content":"INT. GARAGE - DAY\n\nCut scene.\n"}]
```
Preview hides section/synopsis from the body (outline sidebar only), renders note chips; boneyard excluded entirely; export round-trips all four verbatim.
