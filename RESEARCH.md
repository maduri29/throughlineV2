# Throughline — Research Brief

*Compiled from vendor pages and product documentation; volatile pricing verified live where noted. Treat prices as approximate.*

---

## 1. Competitive landscape

### Professional screenwriting
| Tool | What it is | Standout | Price | Weakness for Throughline's use case |
|---|---|---|---|---|
| **Final Draft** | Industry-standard formatter | Beat Board, .fdx interchange | ~$199.99 one-time ([finaldraft.com](https://www.finaldraft.com)) | Formatting-first; story dev is a bolt-on board, no entity graph |
| **Fade In** | Lean full-featured writer | One cheap license, every platform | $79.95 one-time ([fadeinpro.com](https://www.fadeinpro.com)) | Minimal pre-writing structure |
| **WriterDuet** | Real-time collaborative screenwriting | Google-Docs-style co-writing | Free tier; Pro ≈$10–12/mo ([writerduet.com](https://writerduet.com)) | Collaboration on scripts only; the "world" lives elsewhere |
| **Arc Studio** | Modern screenwriting + outlining | Visual arc/board inside a script app | Free / $69/yr / $99 first yr (verified: [arcstudiopro.com/pricing](https://arcstudiopro.com/pricing)) | **Closest competitor**, but boards aren't a queryable story database |
| **Highland 2** | Fountain-native minimalist writer | Plaintext Fountain workflow | Freemium (~$50 pro) ([quoteunquoteapps.com](https://quoteunquoteapps.com/highland2/)) | Deliberately sparse |

### Plotting / story bible
| Tool | Standout | Price | Weakness |
|---|---|---|---|
| **Plottr** | Timeline-lane outliner & series bible | $60/yr → $9.99/mo; lifetime options (verified: [plottr.com/pricing](https://www.plottr.com/pricing/)) | Rigid vertical lanes — wrong shape for idea exploration |
| **Campfire Writing** | Modular world/story database; best relationship web + maps | Free limits → $12/mo unlimited (verified: [campfirewriting.com/pricing](https://campfirewriting.com/pricing)) | Module paywall sprawl; form-like, not spatial |
| **Scrivener** | Compiler/corkboard workhorse | $59.99 one-time ([literatureandlatte.com](https://www.literatureandlatte.com/scrivener)) | Documents in folders; relationships are manual |
| **Novelcrafter** | Codex auto-referencing + bring-your-own-AI | $4–20/mo (verified: [novelcrafter.com/pricing](https://novelcrafter.com/pricing)) | Prose-centric; no canvas, no screenplay |
| **Story Planner** | Structured templates (Hero's Journey etc.) | Cheap/freemium ([storyplanner.com](https://www.storyplanner.com)) | Fill-in-forms; zero visualization |

### Worldbuilding
- **World Anvil** — wiki-style world encyclopedia, interactive maps/timelines; freemium ~$5–12/mo ([worldanvil.com](https://www.worldanvil.com)). Encyclopedic RPG skew; heavy, not a fast ideation canvas.
- **Campfire** — see above; its relationship graphs are the closest existing thing to Throughline's character web.

### Visual boards writers borrow
- **Milanote** — designer-y cards for mood boards/outlines; free ~100 notes, ~$9.75/mo annual ([milanote.com](https://milanote.com)). Cards are dead text — no entities, links, or views.
- **Obsidian Canvas + graph view** — Markdown notes become a linkable knowledge graph; free ([obsidian.md](https://obsidian.md)). Generic: no story schema, timeline, or script output.
- **Scapple** — freeform mind map that feeds Scrivener; ~$27 one-time. Static bubbles, no data model.
- **Miro / FigJam** — powerful generic whiteboards, but story-blind.

### AI story tools
- **Sudowrite** — AI brainstorm/draft/rewrite for novelists; $10–44/mo annual (verified: [sudowrite.com/pricing](https://sudowrite.com/pricing)). Generates prose, not structured story worlds.
- **Dramatron** (DeepMind research prototype, [arxiv 2212.03491](https://arxiv.org/abs/2212.03491)) — hierarchical LLM co-writing: logline → characters → scene beats → script. **Proves the pipeline is wanted; nobody has shipped it well as a product.**
- Largo.ai, Cinelytic, Filmustage — enterprise script analytics; not creator-facing development tools.

## 2. The gap (why Throughline)

The market splits at exactly Throughline's seam: **whiteboards stop where structure starts; screenwriting tools start where structure ends.**

- **Idea → format decision**: sparks can't *become* anything in Milanote/Miro; nothing helps decide "limited series vs feature" from the material itself.
- **Structured story world**: Campfire/World Anvil model entities as wiki forms; Obsidian has links but no typed semantics (*who opposes whom, which scene pays off which setup*).
- **Relationship graphs**: only Campfire's web comes close; nothing renders character/location/theme networks live-editable alongside scenes.
- **Timelines**: Plottr assumes narrative order = chapter order. Nothing treats **story-world chronology vs presentation order** (flashbacks, non-linear episodes) as two linked views of the same events.
- **Consistency checking**: no consumer tool flags "character appears in Scene 12 before being introduced," orphaned setups, unused locations, characters with no arc beats.
- **Into script**: everything else exports to a wall of text and forgets the bible.

## 3. Features worth stealing

- **Final Draft Beat Board** — but make the index cards *typed entities*.
- **Plottr timeline lanes** — plus a second reorderable *narrative-order* view over chronological events.
- **Campfire relationship web** — generalize to every node type.
- **Obsidian backlinks/local graph** — auto-surface "everything touching this character" while editing any card.
- **Milanote card aesthetic** — low-friction spark capture that doesn't demand structure upfront.
- **Scrivener compile step** — compile the graph into a series-bible document.
- **Novelcrafter BYO-key AI** — cheap to offer, builds trust vs credit-metered AI.

## 4. Technology notes

| Option | Verdict |
|---|---|
| **React Flow / xyflow** ([reactflow.dev](https://reactflow.dev)) | Best default: editable nodes/edges, custom components, MIT core. Ideal typed story graph editor. |
| tldraw ([tldraw.com](https://tldraw.com)) | Superb freeform whiteboard SDK; commercial license to remove watermark. |
| Excalidraw embed | MIT sketch canvas; good scratchpad, weak data model. |
| Cytoscape.js ([js.cytoscape.org](https://js.cytoscape.org)) | Strong auto-layouts — right tool for *derived* views like the relationship web. |
| Sigma.js / D3-force | WebGL for huge read-mostly graphs / DIY force layouts. Overkill now. |

- **Persistence path**: localStorage → IndexedDB (idb-keyval) → SQLite-WASM+OPFS ([sqlite.org/wasm](https://sqlite.org/wasm/doc/index.md)) when real queries arrive ("all scenes with Character X"); add **Yjs** CRDTs ([yjs.dev](https://yjs.dev)) later for offline merge + realtime collab without rearchitecting.
- **Script format**: store/export **Fountain** plaintext ([fountain.io](https://fountain.io)) — human-readable, diff-able, imports into Final Draft/Highland/WriterDuet. Add .fdx XML import as the pro bridge.

## 5. Positioning & pricing

Bands: freemium subscriptions dominate ($0–20/mo); legacy one-time $60–200; lifetime deals as launch levers. Credible Throughline pricing: **free spark-capture tier → ~$8–15/mo or ~$80–100/yr for the full journey.**

Three sharp wedges:
1. **"The whiteboard that becomes the bible that becomes the script."** Own continuity — sparks keep their identity into scenes; competitors force migration at every stage.
2. **Typed consistency engine.** The only tool checking arc coverage, orphaned setups, introduction order across a series. Nobody does this for creators today at any price.
3. **Open portability.** Fountain/Markdown under the hood vs Final Draft lock-in and Campfire module walls: *"your story world is plain text you'll own forever."*

---

## Prototype verification checklist (what `prototype/throughline.html` demonstrates)

- ✅ Infinite pan/zoom canvas, draggable **typed nodes** (7 types), **typed edges** with rules per type-pair
- ✅ Drag-from-handle connecting with edge-type menu (+ labeled relationships)
- ✅ Inspector editing: character want/wound/arc, scene order/story-time/episode/location/flashback, etc.
- ✅ **Dual-order Timeline**: narrative order ↔ chronological story order, flashback lane
- ✅ Characters lens with appearance/relationship counts
- ✅ Type filter chips, legend, JSON export/import, localStorage autosave, reset-to-demo
- ✅ Syntax-checked (`node --check`) and boot-verified in headless Chromium (nodes + edges rendered)

---

## 6. Frontend toolchain — verified versions (checked live 2026-08-22, npm registry + vendor docs)

| Slot | Verdict | Notes |
|---|---|---|
| TypeScript | **USE `typescript@^7.0.2`** | Stable TS7 GA'd Jul 8 2026; ships Go-native `tsc` per-platform (win32-x64/arm64 via optionalDeps). Do **not** use `@typescript/native-preview` (repo closed/archived). |
| Formatter | **USE `oxfmt@0.64.0`** (`oxfmt` / `oxfmt --check`) | Prettier-compatible JS formatting; config `.oxfmtrc.json`. |
| Linter | **USE `oxlint@1.79.0`** (`bunx oxlint`) | Zero-config by default; `.oxlintrc.json`; plugins array *overwrites* defaults. VS Code ext: `oxc.oxc-vscode`. |
| Runtime/PM | **USE Bun 1.4.0** (already installed) | Windows ≥10 1809. Plain `bun run dev` → Vite under Node; avoid forcing `--bun` for Vite dev server. |
| Graph lib | **USE `@xyflow/react@12.11.3`** | peerDeps react ≥17 → React 18/19 both fine. |
| Bundler | Vite 8.2.2 current | esbuild transforms; run `tsc --noEmit` separately for type-checking (native-speed under TS7). |

⚠️ **This repo lives at `C:\Users\madur\OneDrive\Desktop\Throughline` — inside OneDrive sync scope.** OneDrive-backed folders have documented Vite watcher fallout ([vitejs/vite#22672](https://github.com/vitejs/vite/issues/22672) CPU/memory runaway; classic `EPERM rename` during installs). Exclude this folder from sync or move the repo out of OneDrive before serious dev.

Sources: [TS7 GA](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/) · [typescript-go closed](https://github.com/microsoft/typescript-go) · [oxfmt guide](https://oxc.rs/docs/guide/usage/formatter) / [config](https://oxc.rs/docs/guide/usage/formatter/config.md) · [oxlint guide](https://oxc.rs/docs/guide/usage/linter) / [editors](https://oxc.rs/docs/guide/usage/linter/editors.md) · [Bun install](https://bun.sh/docs/installation) / [releases](https://github.com/oven-sh/bun/releases) · [xyflow](https://www.npmjs.com/package/@xyflow/react)
