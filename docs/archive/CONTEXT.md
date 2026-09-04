# Throughline

This glossary describes the current implementation. Terminology, navigation, data models, and product behavior are open to redesign during the refactor.

A local-first story-development app: raw ideas grow into projects, projects grow a visible
graph of scenes, characters, locations and themes, and the story becomes a Fountain screenplay.

Local-first is literal: the working store is IndexedDB in your browser, and the app opens,
edits and exports with no network and no account. An **optional** Turso
endpoint at `/api/sync` supports cloud sync when configured with a Sync Key.

## Current terminology

### Story material

**Seed**:
A raw idea kept before it belongs to any project.

**Reference**:
Material collected about the work rather than part of it — a source, a note, a
beat sheet being filled in. Attached to one story, or shared across all of them.

**Project**:
A developed story work — a feature, a series, a limited series, or a short.

**Episode**:
An installment that groups scenes within a project; a project may have none.

**Scene**:
The atomic unit of story — what happens, where, and when; it carries its own Fountain text.

**Character**:
A person or personified presence that appears in scenes.

**Role**:
Free display text naming a character's dramatic position ("Protagonist", "Foil");
suggestions are offered, never enforced.

**Backstory**:
The off-screen history a character carries into the story; kept whole on the
character, not scattered across scene synopses.

**Location**:
A named place that scenes take place at.

**Theme**:
An idea that characters or scenes embody.

### Story time

**Narrative Order**:
Where a scene sits in the presented sequence of its project.

**Story Day**:
The author-numbered day of the story world on which a scene happens.

**Time of Day**:
The scripted light of a scene: Dawn, Day, Dusk, Night, Continuous, Later, Moments Later.

**Era Label**:
Free display text placing a scene in story time ("1998", "Three years earlier").

**Flashback**:
A scene linked by Flashback Of to the scene it interrupts in the current graph model.

### Connections

**Contains**:
Membership running project → episode → scene (a project may contain scenes directly).

**Appears In**:
A character being present in a scene.

**Takes Place At**:
A scene happening at a location.

**Relates To**:
A character-to-character bond carrying a free-text label.

**Precedes**:
A scene immediately following another in presentation.

**Flashback Of**:
Linking a flashback to the later-presented scene it explains or interrupts.

**Parallels**:
A deliberate echo between two scenes.

**Foreshadows**:
A seed or scene hinting toward a later scene.

**Sets Up**:
A scene planting something a later scene pays off; read from the paying-off end it renders
as **Pays Off**.

**Embodies**:
A character or scene manifesting a theme.

**Grew Into**:
A seed becoming a project or a scene.

**Related To**:
The generic fallback when no specific connection fits.

### Working with the graph

**Lens**:
One of the four views onto the same graph: Map, Timeline, Characters, Script.

**Map**:
The spatial lens where nodes and connections are freely arranged.

**Timeline**:
The dual-order lens contrasting Narrative Order against Story Day order, flashbacks aside.

**Characters**:
The lens centered on characters and their webs of Relates To bonds.

**Script**:
The lens where each scene's Fountain text is written and previewed.

**Library**:
The home surface listing every project. Reached at `/stories`; a story is a
sub-route beneath it.

**Boneyard**:
The surface for seeds — ideas kept before they belong to a story. Growing one
creates a project and leaves the seed in place, linked by **Grew Into**, because
where a story came from is worth being able to look up.

**Research**:
The surface for references, and where a beat sheet is applied.

**Beat**:
One row of a beat sheet: a name, whether it is covered, a note, and optionally
the scene that fulfils it. Applying a sheet creates beat rows. A beat
links to a scene that already exists; the current flow uses existing scenes.

**Inspector**:
The panel for reading and editing whatever is currently selected.

**Fountain Fragment**:
The Fountain text stored for a single scene.

**Skeleton**:
Starting Fountain text auto-derived from a scene's graph fields.
