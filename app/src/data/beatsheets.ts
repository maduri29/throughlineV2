// Beat sheet templates, verified against their primary sources (Sept 2026).
//
// Each beat carries its canonical position and its job as a `guide`, which
// seeds the beat's note when a sheet is applied — so a fresh sheet arrives
// self-explanatory instead of as bare names you have to already understand.
// Positions are % of total length (Snyder and Field both publish them that
// way: page 60 of a 120-page script IS the 50% mark).
//
// Sources:
//   * Save the Cat — Blake Snyder, Save the Cat! (2005); beat order, names and
//     positions per the official sheet at savethecat.com. The Finale's five
//     movements (gather the team, execute the plan, high-tower surprise, dig
//     deep down, execute the new plan) are Snyder's, summarised in the guide.
//   * Hero's Journey — Christopher Vogler, The Writer's Journey (1992),
//     condensing Campbell into twelve stages (from his 1985 Disney memo).
//     Stage names and jobs per Vogler's own handout. Note "Inmost", not
//     "Innermost": that is Vogler's word.
//   * Three Act — Syd Field, Screenplay (1979): the Paradigm of Setup /
//     Confrontation / Resolution hinged on two plot points, with pinches and
//     a midpoint keeping the long second act from sagging.
//
// Applying one creates a reference note you fill in — it deliberately does NOT
// create scenes. Putting structure into the story graph before anything is
// written commits you to a shape you have not chosen yet, and undoing that is
// far more work than deleting a note.
//
// These are prompts, not doctrine. Nothing in the app treats a story following
// one as more correct than a story that ignores them.

import type { Beat } from "../types";

export type BeatTemplate = {
  /** Canonical beat name, exactly as the source gives it. */
  name: string;
  /** Position + job; becomes the beat's starting note on apply. */
  guide: string;
};

export type BeatSheet = {
  id: string;
  name: string;
  source: string;
  beats: BeatTemplate[];
};

export const BEAT_SHEETS: BeatSheet[] = [
  {
    id: "three-act",
    name: "Three Act",
    source: "Syd Field's Paradigm (Screenplay, 1979): plot points, pinches, midpoint.",
    beats: [
      {
        name: "Opening Scene",
        guide: "~1% · Grab the audience and state the theme: the world as it stands.",
      },
      {
        name: "Inciting Incident",
        guide: "~10–15% · The event that sets the story in motion; the engine starts here.",
      },
      {
        name: "Plot Point 1",
        guide:
          "~25% · The hinge into Act Two: an event spinning the story in a new direction — the hero takes on the problem.",
      },
      {
        name: "Pinch 1",
        guide:
          "~37% · A reminder of the central conflict, squeezing the story back onto its spine.",
      },
      {
        name: "Midpoint",
        guide:
          "~50% · Reversal or revelation splitting Act Two in half; often the point of no return.",
      },
      {
        name: "Pinch 2",
        guide:
          "~62% · A second squeeze echoing Pinch 1: the opposition bears down as the break approaches.",
      },
      {
        name: "Plot Point 2",
        guide:
          "~75–90% · The hinge into Act Three: a reversal launching the climax — sometimes the crisis itself.",
      },
      {
        name: "Climax",
        guide:
          "Maximum tension: hero and opposition confront each other and the dramatic question is answered.",
      },
      {
        name: "Denouement",
        guide: "Calm after: equilibrium returns, threads tied, the world as it stands now.",
      },
    ],
  },
  {
    id: "save-the-cat",
    name: "Save the Cat",
    source: "Blake Snyder's fifteen beats (Save the Cat!, 2005).",
    beats: [
      {
        name: "Opening Image",
        guide:
          "0–1% · The 'before' snapshot: hero and world as they are, mirroring the Final Image.",
      },
      {
        name: "Theme Stated",
        guide:
          "~5% · Someone voices the theme — the lesson the hero must learn. The hero doesn't get it yet.",
      },
      {
        name: "Set-Up",
        guide:
          "1–10% · The status quo: the hero's flaws, home, work and play — everything that needs changing.",
      },
      {
        name: "Catalyst",
        guide:
          "~10% · The inciting incident: a life-changing event knocking the world off its axis.",
      },
      {
        name: "Debate",
        guide:
          "10–20% · Hesitation and preparation: should I go? Doubt, denial, or gearing up for the journey.",
      },
      {
        name: "Break into Two",
        guide:
          "~20% · The no-turning-back choice: the hero enters the new world and Act Two begins.",
      },
      {
        name: "B Story",
        guide:
          "~22% · A new relationship — love, friendship, mentorship — carrying the theme; it will teach the hero.",
      },
      {
        name: "Fun and Games",
        guide:
          "20–50% · The promise of the premise: the scenes from the trailer. Deliver what the audience came for.",
      },
      {
        name: "Midpoint",
        guide:
          "~50% · False victory or false defeat: stakes rise, focus narrows — often a ticking clock starts.",
      },
      {
        name: "Bad Guys Close In",
        guide:
          "50–75% · Pressure from outside and inside: enemies regroup, allies falter, flaws resurface.",
      },
      {
        name: "All Is Lost",
        guide:
          "~75% · Rock bottom: the hero loses something irreplaceable — often with a whiff of death.",
      },
      {
        name: "Dark Night of the Soul",
        guide: "75–80% · Grief and inventory: mourning what's lost, learning what it meant.",
      },
      {
        name: "Break into Three",
        guide: "~80% · The synthesis: a discovery — often via the B Story — sparks the final plan.",
      },
      {
        name: "Finale",
        guide:
          "80–99% · Proving change: gather the team, execute the plan, survive the surprise, dig deep, execute the new plan.",
      },
      {
        name: "Final Image",
        guide:
          "99–100% · The 'after' photo: a mirror of the Opening Image showing how far hero and world have come.",
      },
    ],
  },
  {
    id: "heros-journey",
    name: "Hero's Journey",
    source: "Christopher Vogler's twelve stages (The Writer's Journey, 1992), after Campbell.",
    beats: [
      {
        name: "Ordinary World",
        guide:
          "The hero's normal life, flaws and tensions on display — establish what stands to be lost.",
      },
      {
        name: "Call to Adventure",
        guide: "The inciting event: a message, threat, or opportunity that demands a response.",
      },
      {
        name: "Refusal of the Call",
        guide: "Fear of the unknown: the hero hesitates, or another character voices the danger.",
      },
      {
        name: "Meeting with the Mentor",
        guide:
          "Training, equipment, or counsel — enough to face the journey, never enough to solve it.",
      },
      {
        name: "Crossing the First Threshold",
        guide:
          "Wholehearted commitment: leaving the Ordinary World for unfamiliar rules. Act One ends.",
      },
      {
        name: "Tests, Allies, Enemies",
        guide: "Exploring the Special World: trials faced, allegiances sorted, rules learned.",
      },
      {
        name: "Approach to the Inmost Cave",
        guide:
          "Preparing for the central ordeal: planning, recon, gathering courage with new allies.",
      },
      {
        name: "The Ordeal",
        guide:
          "Death and rebirth near the story's middle: the greatest fear confronted, the old self shed.",
      },
      {
        name: "Reward (Seizing the Sword)",
        guide:
          "Taking the treasure — object, knowledge, or bond — with real danger of losing it again.",
      },
      {
        name: "The Road Back",
        guide:
          "~3/4 mark: driven to finish, often pursued — racing the consequences back toward home.",
      },
      {
        name: "The Resurrection",
        guide:
          "The climax: a final death-and-rebirth test on a higher level; the opening polarities resolve.",
      },
      {
        name: "Return with the Elixir",
        guide: "Home transformed, carrying something with the power to change the Ordinary World.",
      },
    ],
  },
];

/**
 * Structured rows for a fresh sheet. Nothing is ticked and nothing is linked;
 * each row's note starts as its guide, which the writer overwrites with story.
 */
export function beatSheetRows(sheet: BeatSheet, newId: () => string): Beat[] {
  return sheet.beats.map((b) => ({ id: newId(), name: b.name, done: false, note: b.guide }));
}
