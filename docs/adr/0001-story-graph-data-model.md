# ADR-0001: Normalized IndexedDB, UUIDv7 identity, structured story time, twelve typed edges

Status: accepted

Throughline stores one typed graph. Seven entity kinds (Seed, Project, Episode, Scene,
Character, Location, Theme) are node records with type-discriminated field bags; twelve
edge types connect them under a locked legality table (below). Identity is UUIDv7 strings
everywhere. Persistence is **normalized IndexedDB** — database `throughline`, stores
`projects` (keyPath `id`), `nodes` and `edges` (keyPath `id`, index on `projectId`),
`settings` (keyPath `key`) — not a JSON blob per project. Scene time is **fully
structured**: `{ storyDay: number | null, tod: Dawn|Day|Dusk|Night|Continuous|Later|MomentsLater | null, eraLabel: string | null }`. A scene's flashback-lane membership is
**derived by traversing Flashback Of edges**; no boolean flag exists.

## Considered options

- **Blob-per-project** (recommended at decision time, rejected by product owner): atomic
  saves and trivial export, but no cross-project queries — queryability won.
- **Prefixed counter ids** (`n_1`): collide across imported projects; UUIDv7 is
  time-ordered and merge-safe.
- **Free-text story time** (prototype behavior): sorted by regex heuristics — fragile;
  superseded by the structured triple.

## Edge legality (normative)

| Type | From → To | Notes |
|---|---|---|
| contains | project→episode · episode→scene · project→scene | features skip episodes |
| appears_in | character→scene | |
| takes_place_at | scene→location | |
| relates_to | character↔character | carries label |
| precedes | scene→scene | |
| flashback_of | scene→scene | flashback → interrupted scene |
| parallels | scene→scene | |
| foreshadows | seed→scene · scene→scene | |
| sets_up | scene→scene | inverse label "Pays Off" |
| embodies | character→theme · scene→theme | |
| grew_into | seed→project · seed→scene | |
| related_to | any→any | fallback |

## Consequences

- Cross-project queries work from day one; saves become multi-store transactions.
- Export/import is a JSON envelope `{schemaVersion, project, nodes[], edges[]}`; UUIDv7
  makes imports collision-free without id remapping.
- `schemaVersion` on project records gates future migrations.
- Zustand remains the state layer, but persistence runs through a custom normalized-IDB
  adapter — the earlier idb-keyval plan is dropped.
- Timeline ordering: `storyDay` ascending → canonical Time-of-Day order within a day
  (Dawn < Day < Dusk < Night; Continuous/Later/Moments Later anchor to narrative position)
  → Narrative Order as tiebreak; scenes lacking a Story Day slot directly after the last
  dated scene.
- Export slug TIME segment derives from `tod` (falling back through eraLabel) per
  `research/fountain-subset.md` §4.
