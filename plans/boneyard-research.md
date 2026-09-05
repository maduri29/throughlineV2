# Boneyard workflow research

Researched 2026-09-04. Scope: official product documentation for capture, connection, development, and rediscovery patterns. These sources establish existing features, not proof of better creative outcomes. No historical archive was consulted.

## Verified patterns

| Source | Documented behavior | Boneyard implication (design inference) |
| --- | --- | --- |
| [Milanote: Unsorted notes](https://help.milanote.com/en/articles/111399-unsorted-notes) | Each board has an unsorted area. Items can be captured there before categorization, then dragged onto the board. Ctrl/Cmd+Enter creates another note. | Capture should need only content. Keep focus ready for the next fragment; defer titles, tags, and collections. |
| [Milanote: iPhone and Android apps](https://help.milanote.com/en/articles/2966365-milanote-iphone-android-apps) | Quick Notes captures ideas that can later be organized into boards on a larger screen. The current apps require connectivity for viewing and editing boards. | Make phone capture a first-class flow. Throughline should separately define its own draft recovery and offline guarantees; copying the visual workflow does not provide them. |
| [Obsidian: Backlinks](https://obsidian.md/help/plugins/backlinks) | Backlinks expose notes linking to the active note, with expandable mention context. It also distinguishes linked mentions from unlinked occurrences of the note name. | A connection should be discoverable from both ideas and show enough context to explain why it exists. Start with explicit links; name matching or AI suggestions should be optional and clearly labeled later. |
| [Scrivener: Scratchpad](https://www.literatureandlatte.com/blog/how-to-use-the-scrivener-scratchpad-to-collect-research-and-capture-ideas) | The Scratchpad holds individual notes and can send their contents into open projects, either appending to a document or importing as a child document. | Separate “add to existing story” from “create something new.” Boneyard should preserve the source and record the destination, rather than treating evolution as deletion. Source preservation is our recommendation, not a claim about Scrivener's transfer semantics. |
| [Scrivener: Freeform Corkboard](https://www.literatureandlatte.com/blog/how-to-use-scriveners-freeform-corkboard) | Cards can be arranged freely; users can return to the standard corkboard without committing the freeform arrangement as project order. Freeform positions are remembered. | Exploratory grouping should not silently reorder scenes or change story structure. A canvas could be an optional view later, with explicit commitment when an arrangement becomes a story outline. |
| [Readwise: Reviewing highlights](https://docs.readwise.io/readwise/docs/faqs/reviewing-highlights) | Users tune resurfacing frequency by source or document. Showing a highlight lowers its chance of appearing again. Reviews remain accessible when email alerts are disabled. | Offer a small, optional “Revisit” surface with skip/snooze/hide controls. Avoid deadlines, streaks, or notifications by default. This is a rediscovery pattern, not evidence that spaced repetition improves creative incubation. |

## Recommended design decisions

1. **One idea, variable depth.** A fragment and a developed premise are the same entity. A title is optional; the opening line provides a label until the writer names it. No compulsory idea type or maturity stage.
2. **Two writing intentions.** “Edit idea” changes the current working text; “Add a thought” adds a dated development entry. Avoid silently overwriting the history when someone is trying to explore a new angle.
3. **Two distinct relationships.** Connections express association; collections gather ideas. An idea may appear in several collections without duplication. Opening either endpoint should reveal its connections.
4. **Evolution is a reusable handoff.** Preview the material and destination before creating a story or appending to one. Retain source IDs and the destination link. Repeated attempts must not create accidental duplicate story content. An idea may inspire multiple stories.
5. **Retrieval before visualization.** Begin with a text-first feed, search across ideas and development entries, pins, and collection filters. A spatial board brings layout persistence, keyboard interaction, touch navigation, and accessibility work; add it only if arranging ideas is a demonstrated need.
6. **Rediscovery without obligation.** Later, offer one or a few eligible older ideas on demand, with recent exposure excluded and user controls respected. Do not score idea quality or filter out short fragments.

## First release boundary

Build reliable capture and recovery, feed/search, an idea detail space with dated additions, explicit connections, lightweight collections, and source-preserving evolution. Acceptance should include both fifty short fragments and one long-running idea, keyboard-only use, mobile capture with the virtual keyboard, reload recovery, save failure, and safe retry of evolution.

Defer reminders, automatic suggestions, AI rewriting, rich attachments, and freeform canvas until the base workflow is validated. Plain URL references can be included without adding upload infrastructure.

## Open questions to validate through use

- Can a writer drop a thought without stopping to organize it?
- Is the difference between editing the main idea and adding a new thought immediately understandable?
- Can the writer find an older fragment when only a few words are remembered?
- Can related ideas combine into a story without losing their separate identities?
- Does the detail experience support a long idea on a phone without trapping the writer in scrolling or nested panels?

These are proposed usability checks, not claims derived from the competitor documentation.
