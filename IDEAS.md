# Throughline — Product Ideas

> From spark to screenplay. A thinking tool where raw ideas grow into movies and TV series,
> organized as a living visual graph of characters, scenes, locations, themes and time.

---

## 1. The core insight

Every story tool today covers **one stage** of the journey:

- Whiteboards (Miro, Milanote, Obsidian Canvas) are great for messy brainstorming but know nothing about stories.
- Outliners (Plottr, Scrivener) organize scenes but arrive *after* you already know your story.
- Screenwriting tools (Final Draft, Arc Studio) format pages but don't help you *think*.
- Worldbuilding tools (World Anvil, Campfire) track lore but disconnect it from structure and script.

**Throughline's bet:** one connected object — a **story graph** — carries an idea all the way from
"a town that floods every night" to page 47 of a shooting script. The mind map isn't a view *of* the
data. The mind map **is** the database, and every other view (timeline, character web, beat board,
script) is a lens over the same nodes and edges.

## 2. The pipeline (the throughline itself)

```
SPARK ──────► SHAPE ──────► WEAVE ──────► WRITE ──────► TRACK
 capture      decide        connect       draft         verify
 fragments    the form      the world     the script    consistency
```

| Stage | What the user does | What Throughline does |
|---|---|---|
| **1. Spark** | Dump fragments: premises, "what ifs", overheard lines, images | Zero-friction inbox; nothing needs structure yet |
| **2. Shape** | Promote a spark into a project; choose Feature / Limited Series / Episodic TV / Anthology | Format templates change what gets created next (episodes + season arcs vs three acts) |
| **3. Weave** | Build the world on the canvas: characters, relationships, locations, themes, scene beats | Every card is a node; every connection is a typed edge (`appears_in`, `relates_to`, `foreshadows`…) |
| **4. Write** | Draft the screenplay per episode/act | Scene headings auto-link back to graph nodes; Fountain plaintext = portable |
| **5. Track** | Ask "is my story sound?" | Consistency checks, arc coverage heat maps, theme presence per act |

## 3. The killer feature: one graph, many lenses

The same underlying graph rendered four ways:

1. **Map** — free-form spatial mind map (the brainstorm home).
2. **Timeline** — scenes laid out in time, with the superpower: toggle between
   **narrative order** (order experienced by the audience) and **story order**
   (chronology of the story world). Flashbacks get their own lane. Tarantino
   structures become visible instead of painful.
3. **Character web** — force-directed relationship graph; thickness/strength of
   bonds, who appears with whom, isolated-character detection ("your protagonist
   never shares a scene with your antagonist until Act 3 — intentional?").
4. **Beat board → Script** — index cards per scene that ARE the script's scene
   headings. Drag to reorder = restructure the outline; the script follows.

## 4. Feature idea bank (ranked by leverage)

### Tier 1 — the product
- **Typed edges**: `appears_in`, `takes_place_at`, `contains`, `relates_to` (+label:
  "daughter · estranged"), `precedes`, `flashback_of`, `parallels`, `foreshadows`,
  `embodies` (character/theme), `grew_into` (idea→project). Typed edges are what make
  queries like *"show everything that foreshadows E03"* possible.
- **Dual-order timeline** (above) — nobody does this well.
- **Character dossier as node fields**: want, wound, arc summary, role — because those
  fields power later analysis.
- **Spark inbox** with one-key capture; sparks sit unattached until they `grew_into`
  something — the graph shows your backlog of unused ideas honestly.

### Tier 2 — the moat
- **Consistency checks**: character appears in a scene after dying; location named two
  ways; scene scheduled at night but referenced as morning.
- **Arc coverage heat map**: character × episode grid showing presence; warns when a
  lead vanishes for 30 pages.
- **Theme lens**: highlight the graph by theme — watch "what we abandon to survive" thread
  through specific scenes; find acts where a theme goes silent.
- **Structure templates**: Save the Cat, Hero's Journey, Story Circle, Kishōtenketsu,
  TV A/B/C-plot engine — overlaid as guide rails on the map, not imposed containers.

### Tier 3 — the magic (AI as collaborator, human always decides)
- **Connection suggester**: "Sam has no arc link to any theme — possible?"
- **Gap finder**: "Your antagonist disappears between Night 4 and Night 9."
- **Coverage generator**: from the selected subtree, draft a synopsis or query letter.
- **Name/logline generator**, tone-matched to the project.
- **"Interview my character"**: structured Q&A that fills dossier fields.

### Tier 4 — collaboration & pro workflow (later)
- Writers'-room mode: shared boards, private layers (everyone brainstorms, only showrunner
  merges), episode ownership.
- Revision tracking à la locked pages; production calendar view.
- Import/export: Fountain, Final Draft (.fdx), CSV of the bible, Markdown.

## 5. Differentiation summary

1. **Full pipeline in one tool** — competitors stop at either the whiteboard or the script.
2. **Time done right** — narrative vs story order, flashback lanes, parallel timelines.
3. **Graph-native, not folder-native** — a character IS a node that scenes point to;
   rename her once, she's renamed everywhere including the script.
4. **Honest backlog** — sparks stay visible until they grow into something.

## 6. Suggested MVP (what the prototype demonstrates)

One local-first web app. Accounts were originally out of scope; ADR-0005 (2026-08-23)
added an **optional** sync tier, so accounts are additive and never required:

- Infinite pan/zoom canvas with draggable typed nodes + typed edges.
- Inspector panel for editing node details per type.
- Three views over one dataset: Map, Timeline (dual order), Characters.
- localStorage autosave, JSON export/import.
- Preloaded demo project so the concept sells itself in 30 seconds.

Deliberately deferred: real script editor, AI features, collaboration, mobile.

## 7. Tech direction (post-prototype)

- **Canvas/graph**: React Flow (xyflow) — editable nodes/edges, zoom/pan, minimap out of the box.
- **State**: Zustand or Redux Toolkit; graph data normalized `{nodes, edges}` (matches React Flow directly).
- **Script editing**: Tiptap editor + open-source Fountain parser; `.fdx` export via XML transform.
- **Persistence**: IndexedDB (Dexie) → SQLite WASM when queries get serious; Yjs CRDT layer when collaboration arrives.
- **Desktop wrapper (optional)**: Tauri — small binary, native menus, still a web codebase.

## 8. Open questions

- Solo writers first, or writers' rooms? (Affects permissions design early.)
- How opinionated should structure templates be — overlay or enforced container?
- Does the script editor target Fountain purity or .fdx compatibility first?
- Free tier boundary: number of projects? AI credits?
