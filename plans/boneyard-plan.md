# Boneyard: capture, incubate, connect, evolve

Product and implementation proposal, September 4, 2026. Based on the current app and [primary-source research](boneyard-research.md). This is a new proposal for review, not a constraint on future refactoring. No archived guidance was used. No application changes are included.

## Product decision

Build a quiet, text-first home for unfinished thinking. A two-word fragment and a premise developed over months are the same kind of idea, with different amounts of material. Nothing requires a title, category, stage, collection, or story destination at capture time.

The organizing principle is voluntary depth: capture first; develop, connect, and organize when useful. Keep the Boneyard name and existing dark cinematic design for this pass. Use “idea” in the interface; keep existing seed IDs internally for compatibility.

## What the research changes

- Milanote's unsorted capture supports separating capture from categorization. Keep the composer ready for successive thoughts. Its mobile workflow is useful inspiration, but its documented connectivity requirement does not define Throughline's offline behavior.
- Obsidian backlinks show the value of seeing a relationship from either end. Use explicit connections with optional explanation, rather than opaque automatic similarity.
- Are.na blocks can belong to multiple channels. Adopt membership without duplication: one idea can belong to several collections. Removing membership does not delete the idea. Sources: [blocks](https://help.are.na/docs/getting-started/blocks), [removing connections](https://help.are.na/docs/getting-started/blocks/deleting-blocks).
- Scrivener distinguishes capture from sending material into a project. Offer destination choices and preserve source links; simply adding a larger “Grow” button would miss that distinction.
- Readwise demonstrates controllable rediscovery. Offer an optional revisit surface, not a backlog of overdue ideas.
- Baird et al. found benefits on previously encountered laboratory creativity problems after an undemanding intervening task. This does not establish an ideal reminder schedule or prove better screenplay writing. Our inference is modest: let ideas rest and make returning easy. [Primary paper](https://www.cmhp.ucsb.edu/sites/default/files/2018-12/Baird%20et%20al.%20%282012%29%20Inspired%20by%20distraction.pdf).

The linked research note contains the six product-documentation sources and separates their documented behavior from our recommendations.

## Core experience

### 1. Drop a thought

A multiline composer says “Leave a thought here.” Enter inserts a newline; Ctrl/Cmd+Enter saves; a visible “Keep idea” button works on phones. Ignore submission shortcuts during IME composition. Pasting a paragraph, dialogue, or a URL preserves its content without demanding classification.

An optional title is added later. The opening non-empty line supplies the feed label until then. Save a recoverable local draft while writing, clear only after successful persistence, and return focus for the next thought. A failed save leaves text intact and offers retry. Repeated taps create one idea.

### 2. Let an idea deepen

Open an idea into a readable detail space. On desktop use a feed plus a detail pane; on phones use a full-width detail route with Back, not nested drawers. Use `/boneyard?idea=<id>` so selection survives reload and browser navigation.

Two explicit actions have different meanings:

- **Edit idea:** revise the current working text. Keep the initial capture snapshot and recoverable previous saved revision; do not promise a full document version-history system yet.
- **Add a thought:** append a dated entry with its own stable ID. Entries can be edited, with an edited marker, or recovered from trash. A new angle remains separate from the original.

Include related ideas, collection membership, plain URL references, and destinations it has inspired. Optional writing prompts live behind “Explore this idea”; do not put a questionnaire in the capture flow. Useful prompts include “What interests you here?”, “What is missing?”, and “What changes if the opposite is true?” They are prompts, not AI-generated answers.

### 3. Find and connect

The default surface is a chronological text feed. Each row previews the idea, latest thought, and meaningful metadata without showing every action. Use a stable sort while typing; timestamps and list order should update on completed saves, not every keystroke.

Search covers title, body, follow-up entries, and user tags. Results identify whether the match is in the idea or a follow-up and show an excerpt. Add pins, recent activity, and collection filters. Keep current spark categories as optional legacy tags; do not force them on new captures.

Connections and collections are different:

- **Connection:** “This reminds me of that,” visible from both ideas, with an optional short reason.
- **Collection:** a named group with an optional description. Membership is many-to-many. Remove a member without altering its text or other memberships. Delete a collection without deleting its ideas.

A later “Extract as new idea” can copy a selected passage into a separate idea and retain an origin link. Do not implement destructive merging or splitting in the first release.

### 4. Evolve deliberately

Select one idea or several ideas from a collection. Choose **New story** or **Existing story**. Preview the proposed title, summary, and selected source material. The user decides what becomes story content; all follow-up notes should not be dumped into the synopsis automatically.

The first release creates a new story or adds an idea reference to an existing story. Creating typed scenes and characters can follow once that mapping is designed. Sources stay in Boneyard. Show every destination, not a single “grown” badge. Additional evolution is allowed; retries of the same operation do not create duplicates.

Use a concise transition screen, then show “Open story” and “Keep exploring.” Never navigate away before persistence succeeds. Preserve links back to source ideas in the destination.

### 5. Return without obligation

Add an optional “Revisit an idea” action after the core workflow is validated. Choose from older ideas not recently shown; exclude trashed and explicitly snoozed ideas. Let the user skip, snooze, or hide suggestions. Start with an explainable local rule and a small candidate set, not an AI relevance score.

No mandatory maturity stages, quality scores, streaks, deadlines, automatic promotion, or notifications by default. “Set aside” is recoverable and is not the same as permanent deletion. An evolved idea is not automatically finished.

## Current-code findings

- `BoneyardView.tsx` is a single large component combining capture, search, classification, database reads, lineage, editing, and deletion.
- Capture is a single-line input. `jot()` calls `addSeed()` without awaiting it and immediately clears the draft. This can discard visible input when persistence fails.
- Ideas currently have a title, one editable synopsis, and an optional spark type. There are no follow-up entries or collection memberships.
- `patchSeed()` writes changes directly; seeds bypass project-scoped undo. `deleteSeed()` deletes the node without an idea-level recovery flow or associated-edge cleanup in that operation.
- `growSeed()` preserves the source and adds `grew_into`, which is a good foundation. It writes the project and edge separately, has no operation idempotency key, and only creates a new project. The UI currently reduces lineage to one target per seed.
- Backup validation explicitly reads known fields. New fields cannot be assumed to round-trip automatically.
- Cloud sync sends all nodes and edges, including global seeds. Its current replacement behavior is not a sufficient design for concurrent journal edits, deletions, or new stores. New data needs an explicit backup and sync contract.
- Graph scoping expands through relationships. Global idea links and collection memberships must not accidentally pull unrelated Boneyard material into a story's graph or backup.

## Proposed implementation boundaries

Keep the existing seed node identity and compatibility fields, with a versioned idea payload for the current body, initial capture, timestamps, pin, and disposition. Derive a display title when none was supplied; preserve old titles and synopsis exactly during migration. Existing records with no reliable timestamps remain undated until edited; do not invent a capture date.

Use separate records for independently edited development entries and collection membership instead of embedding one growing journal array in a seed node. Proposed logical records:

| Record | Responsibility |
| --- | --- |
| Idea / existing seed | Identity, current text, optional title, original capture, lifecycle metadata |
| Idea entry | Independent thought with idea ID, text, creation/edit timestamps, revision, tombstone |
| Collection | Name, description, revision, tombstone |
| Membership | Unique collection/idea pair; removable without deleting either |
| Idea connection | Unique normalized pair of idea IDs and optional relationship note |
| Evolution receipt | Operation ID, source IDs, selected material, destination IDs |

Add dedicated IndexedDB stores for these ancillary records, indexed by idea or collection ID, behind one `boneyardRepository` module. Keep global association records separate from story graph edges. Continue using `grew_into` for compatible destination lineage, with scoping tests and an explicit source preview rather than unrestricted traversal.

Provide a transaction helper for evolution and coordinated edits across stores. Resolve writes only after transaction completion. Stable operation IDs support safe retry; revisions and tombstones support conflict detection and deletion propagation. Independently added thoughts merge by ID; simultaneous edits to the same thought preserve both versions and expose a conflict rather than silently dropping one.

A dedicated Boneyard backup includes ideas, entries, collections, memberships, connections, and receipts. Story backups include only deliberately referenced source material, not every reachable collection. Extend validation and the sync API/schema to include the new records before exposing features as synced. Test migration, old-client handling, restores, and conflicts; do not rely on TypeScript types to validate imports.

UI modules: `BoneyardView` for composition; `IdeaCapture`, `IdeaFeed`, `IdeaDetail`, `ThoughtList`, `CollectionPicker`, and `EvolveIdea` for focused interaction; `useBoneyard` for subscriptions and command states. Put filtering and selection in pure helpers. Components do not call IndexedDB directly.

## Delivery sequence and exit criteria

| Step | Deliverable | Ready when |
| --- | --- | --- |
| 1. Reliable capture | Extract repository/commands; multiline composer, draft recovery, explicit save state, duplicate-submit guard | Save failure and reload retain text; newline and IME input work; successful save creates exactly one idea |
| 2. Storage contract | Versioned models, repeatable migration, transactional writes, Boneyard backup, sync extension and conflicts | Existing seed IDs/text/links remain intact; all records round-trip; two-device additions and same-entry conflicts preserve content |
| 3. Incubation space | Addressable detail view, edit core text, dated entries, previous revision recovery, trash/restore | Both a one-line idea and a long journal work; navigation/reload preserve selection and saved content; phone keyboard does not obscure save/retry |
| 4. Retrieval and association | Search across entries, pins, optional tags, explicit connections, collections | One idea can belong to two collections; unlinking is non-destructive; search identifies a matching entry; story scopes remain isolated |
| 5. Evolution | Select sources, preview destination/material, transactional handoff, all destinations and backlinks | Retry creates one destination; an intentional second evolution can create another; original ideas and journals remain accessible |
| 6. Validation and polish | Accessibility, mobile, performance, optional on-demand revisit trial | Core usability tasks pass; no silent save or sync failures; production build and existing workflows pass |

Deliver these as small reviewable changes; keep unfinished interactions out of the visible app. Step 1 is useful on its own. Steps 2–5 form the complete first incubation release. Revisit is optional polish, not a reason to delay reliable capture or source-preserving development. There is no calendar estimate until the sync/migration work is scoped with fixtures.

## Acceptance scenarios

1. Rapidly capture 50 small fragments without naming or sorting them; find one by remembered wording.
2. Develop one idea through 20 follow-up entries, revise the core text, and recover a previous saved version.
3. Put a fragment in two collections, remove one membership, and verify its text and other membership survive.
4. Combine a dialogue fragment and a setting idea into a new story; later reuse either in another story. Check both destinations and source links.
5. Fail capture, entry save, and evolution writes deliberately. Preserve drafts, show accurate state, and retry without duplicates or half-created stories.
6. Restore an old backup and a new Boneyard backup. Keep IDs, content, timestamps where known, memberships, and lineage.
7. Independently add thoughts on two devices, concurrently edit one entry, and delete/restore an idea. Verify merge, conflict, and tombstone behavior.
8. Use every core action with keyboard only and at 320px/390px widths, plus a real phone keyboard check. Headless viewport assertions alone do not establish virtual-keyboard behavior.
9. Benchmark search using 1,000 ideas and 10,000 entries. Initial target: results within 100ms after input on the reference machine, with no lost capture keystrokes; measure before choosing an index or virtualization.

Use existing test scripts for regressions and add targeted repository, migration, command, and browser tests. Do not count captured or evolved ideas as a quality score. Validate success through recoverability, findability, and whether returning to an idea feels easy.

## Deliberately later

Freeform spatial canvas; audio recording/transcription; uploaded media and link previews; AI suggestions or rewriting; background reminders; rich block editing; destructive merge/split; automatic scene or character generation. Plain URL references are enough for the first release. These are scope choices for this proposal, not permanent exclusions.
