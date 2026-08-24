// Beat sheet templates.
//
// Three structures old enough to be uncontroversial, stored as beat names only.
// Applying one creates a reference note you fill in — it deliberately does NOT
// create scenes. Putting structure into the story graph before anything is
// written commits you to a shape you have not chosen yet, and undoing that is
// far more work than deleting a note.
//
// These are prompts, not doctrine. Nothing in the app treats a story following
// one as more correct than a story that ignores them.

import type { Beat } from "../types";

export type BeatSheet = {
  id: string;
  name: string;
  source: string;
  beats: string[];
};

export const BEAT_SHEETS: BeatSheet[] = [
  {
    id: "three-act",
    name: "Three Act",
    source: "The common denominator; useful when you want shape without a method.",
    beats: [
      "Setup — the world as it stands",
      "Inciting incident",
      "End of Act One — the door closes behind them",
      "Rising complications",
      "Midpoint — the ground shifts",
      "Things fall apart",
      "End of Act Two — the low point",
      "Climax",
      "Resolution — the world as it stands now",
    ],
  },
  {
    id: "save-the-cat",
    name: "Save the Cat",
    source: "Blake Snyder's fifteen beats, widely used in features.",
    beats: [
      "Opening Image",
      "Theme Stated",
      "Set-Up",
      "Catalyst",
      "Debate",
      "Break Into Two",
      "B Story",
      "Fun and Games",
      "Midpoint",
      "Bad Guys Close In",
      "All Is Lost",
      "Dark Night of the Soul",
      "Break Into Three",
      "Finale",
      "Final Image",
    ],
  },
  {
    id: "heros-journey",
    name: "Hero's Journey",
    source: "Campbell by way of Vogler; the myth shape, condensed.",
    beats: [
      "Ordinary World",
      "Call to Adventure",
      "Refusal of the Call",
      "Meeting the Mentor",
      "Crossing the Threshold",
      "Tests, Allies, Enemies",
      "Approach to the Inmost Cave",
      "The Ordeal",
      "Reward",
      "The Road Back",
      "Resurrection",
      "Return with the Elixir",
    ],
  },
];

/** Structured rows for a fresh sheet. Nothing is ticked and nothing is linked. */
export function beatSheetRows(sheet: BeatSheet, newId: () => string): Beat[] {
  return sheet.beats.map((name) => ({ id: newId(), name, done: false }));
}
