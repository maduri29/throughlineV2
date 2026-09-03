# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Screenwriters, showrunners, dramatists, and narrative designers developing a feature film, television series, limited series, or short. They operate in focused, iterative writing and story-architecting sessions—moving between structural birds-eye story outlining, chronological timeline tracking, character relational mapping, and scene-by-scene Fountain scriptwriting.

## Product Purpose

Throughline enables writers to brainstorm stories, grow raw ideas into projects, and develop a unified, visible story graph of scenes, characters, locations, and themes that directly powers a real-time Fountain screenplay editor. Success means the writer never loses the thread between high-level structural beats and granular script dialogue, all with zero-friction local-first persistence.

## Positioning

Unlike traditional scriptwriting software (Final Draft, Highland) which treats the script as a linear document with detached index cards, and unlike pure diagramming tools (Miro, Obsidian Canvas) which have no screenplay syntax or Fountain integration, Throughline uses a single underlying typed story graph that simultaneously drives the Beat-board Map, Chronological Story-Day Timeline, Character Relationship Grid, Boneyard Idea Incubator, Research Notes Shelf, and split-pane Fountain script editor.

## Operating Context

- Desktop-first browser application running locally in the writer's creative environment.
- Writers spend hours in deep focus, often in dim lighting or varied ambient conditions.
- Writers navigate rapidly via keyboard shortcuts (Cmd+K / Palette, Enter for inspector focus, view-switcher tabs).
- Standard screenplay formatting conventions (Fountain syntax, Courier Prime / screenplay typography, sluglines INT./EXT., scene headings, dialogue blocks).

## Capabilities and Constraints

- **Local-First Working Store**: All story nodes, edges, metadata, and history reside in the browser's IndexedDB.
- **Optional Encrypted Cloud Sync**: End-to-end device sync via Turso SQLite using a private sync key.
- **Views**:
  - *Map View*: Beat-board column layout showing episodes, scenes, and flashback lanes via interactive React Flow canvas.
  - *Timeline View*: Chronological Story-Day columns mapping chronological progression versus narrative order.
  - *Characters View*: Relational network of characters, dramatic roles, scenes, and traits.
  - *Script View*: Dual-pane CodeMirror 6 Fountain editor with live screenplay preview and scene sequence rail.
  - *Boneyard View*: Idea incubator for unassigned spark seeds, notes, and fragments.
  - *Research View*: Reference materials and beat sheet attachments.
  - *Library View*: Story shelf and project switcher.
- **Technical Constraints**:
  - Browser application (next.config.ts, React 19, React Flow 12, CodeMirror 6).
  - Strict performance budgets: instantaneous graph manipulation, zero frame drops during canvas pan/zoom.

## Brand Commitments

- **Name**: Throughline.
- **Tone**: Focused, cinematic, tactile, dignified, distraction-free. Avoid cartoonish gamification, SaaS dashboard clichés, or sterile corporate aesthetics.
- **Materials**: Cinematic storyroom aesthetic—slate, obsidian, warm paper, film negative tones, editorial typography with tactile screenplay accents.

## Evidence on Hand

- Fully functional local-first implementation across 7 dedicated lenses.
- Integrated demo project ("The Big Sleep" / Raymond Chandler noir detective demonstration graph).
- Complete Fountain parser and import/export engine with 60 automated unit tests.

## Product Principles

1. **The Graph Is The Single Truth**: Every view is a lens into the exact same story graph; edits in the script, map, timeline, or inspector mutate the unified graph.
2. **Speed & Distraction-Free Flow**: Writing cannot wait for network requests or sluggish UI; typing latency and view switching must feel instantaneous.
3. **Respect Screenplay Craft**: Respect Hollywood/industry standards for screenplay syntax, sluglines, dialogue, and dramatic hierarchy.
4. **Tactile Digital Studio**: The interface should feel like a premier cinematic writer's room—purposeful, atmospheric, and exquisitely crafted.
