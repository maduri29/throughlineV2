# Throughline

A local-first story-development app: raw ideas grow into projects, projects grow a visible
graph of scenes, characters, locations and themes, and the story becomes a Fountain screenplay.

Local-first is literal: the working store is IndexedDB in your browser, and the app opens,
edits and exports with no network and no account. Since ADR-0005 an **optional** Supabase
tier can sync a copy for durability across devices; signed out, nothing leaves the machine.

## Language

### Story material

**Seed**:
A raw idea kept before it belongs to any project.
_Avoid_: spark, idea note

**Project**:
A developed story work — a feature, a series, a limited series, or a short.
_Avoid_: story, document

**Episode**:
An installment that groups scenes within a project; a project may have none.
_Avoid_: chapter

**Scene**:
The atomic unit of story — what happens, where, and when; it carries its own Fountain text.
_Avoid_: beat, card

**Character**:
A person or personified presence that appears in scenes.

**Role**:
Free display text naming a character's dramatic position ("Protagonist", "Foil");
suggestions are offered, never enforced.
_Avoid_: archetype, class

**Backstory**:
The off-screen history a character carries into the story; kept whole on the
character, not scattered across scene synopses.
_Avoid_: bio, history

**Location**:
A named place that scenes take place at.

**Theme**:
An idea that characters or scenes embody.

### Story time

**Narrative Order**:
Where a scene sits in the presented sequence of its project.
_Avoid_: plot order, script order

**Story Day**:
The author-numbered day of the story world on which a scene happens.
_Avoid_: date, timestamp

**Time of Day**:
The scripted light of a scene: Dawn, Day, Dusk, Night, Continuous, Later, Moments Later.
_Avoid_: TOD abbreviation in UI copy

**Era Label**:
Free display text placing a scene in story time ("1998", "Three years earlier").
_Avoid_: date field, period

**Flashback**:
A scene linked by Flashback Of to the scene it interrupts; flashbackness lives in the link,
never in a flag on the scene itself.
_Avoid_: flashback flag, flashback scene (ambiguous)

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
_Avoid_: tab, mode, page

**Map**:
The spatial lens where nodes and connections are freely arranged.

**Timeline**:
The dual-order lens contrasting Narrative Order against Story Day order, flashbacks aside.

**Characters**:
The lens centered on characters and their webs of Relates To bonds.

**Script**:
The lens where each scene's Fountain text is written and previewed.

**Library**:
The home surface listing every project and seed.

**Inspector**:
The panel for reading and editing whatever is currently selected.

**Fountain Fragment**:
The Fountain text of a single scene — never a whole screenplay.
_Avoid_: script text

**Skeleton**:
Starting Fountain text auto-derived from a scene's graph fields.
