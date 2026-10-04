// Field guides: short references for the writing itself, bundled with the app.
//
// These are static content, deliberately NOT database records. Nothing is
// seeded into IndexedDB on anyone's behalf: a fabricated record would upload
// itself under sync and appear on every device the writer owns, and a guide
// is not the writer's work. Each guide can be saved as an ordinary note with
// one gesture, and from there it is theirs to annotate, just like anything
// they typed themselves.
//
// The Fountain guide describes exactly what this app's parser understands
// (data/fountain.ts, per the Fountain spec at fountain.io/syntax) — no more.
// In particular there is no bold/italic rendering here, so none is promised.
// The craft guides are original wordings of standard dramaturgy, kept short
// enough to glance at mid-draft.

type GuideLink = {
  label: string;
  url: string;
};

export type Guide = {
  id: string;
  name: string;
  blurb: string;
  body: string;
  links?: GuideLink[];
};

export const GUIDES: Guide[] = [
  {
    id: "fountain",
    name: "Fountain in a minute",
    blurb: "The markup the Script lens reads",
    body: [
      "Slug — where and when. Blank lines around it:",
      "  INT. KITCHEN - NIGHT",
      "Force any line into a slug with a leading dot: .SNIPER SCOPE POV",
      "",
      "Action — anything else. One paragraph, every line break kept:",
      "  Maya crosses to the window. Rain needles the glass.",
      "Force it with ! when shouting looks like a cue: !LOUD BANG",
      "",
      "Cue + dialogue — NAME IN CAPS, one blank line before, speech right after:",
      "  MAYA",
      "  (without turning)",
      "  You heard nothing.",
      "Force a cue with @ for names with lowercase: @McCartney",
      "Two voices at once: end the second cue with ^",
      "",
      "Transition — uppercase, ending in TO:, blank lines around:",
      "  CUT TO:",
      "Or force it: > FADE TO BLACK.",
      "",
      "Centered — > text <      Lyric — start the line with ~",
      "Page break — a line of ===",
      "",
      "Organise — # Act One is a section, = a synopsis line.",
      "Both stay out of the formatted page; sections head the export.",
      "",
      "Aside — /* anything between these marks is boneyard, skipped entirely */",
      "Note to self — [[double brackets]] ride along inline.",
      "",
      "Title page — Key: value lines at the very top of the file, e.g. Title:, Author:.",
    ].join("\n"),
    links: [{ label: "Full Fountain spec", url: "https://fountain.io/syntax" }],
  },
  {
    id: "scene-test",
    name: "The scene test",
    blurb: "Six questions before a scene earns its pages",
    body: [
      "1. Whose scene is it? One character changes most. That is whose it is —",
      "   write it from inside them.",
      "2. What do they want here? Concrete enough to say in one sentence.",
      "   If you can't, neither can they.",
      "3. What's in the way? No obstacle, no scene. Somebody or something",
      "   must want the opposite.",
      "4. Where's the turn? The moment expectations flip. A scene without",
      "   a turn is a situation, not a scene.",
      "5. What changes? Who leaves different, what can't be unsaid, what",
      "   door just closed?",
      "6. Why now? Why this day, this hour? If it could happen any time,",
      "   it should happen off-page.",
    ].join("\n"),
  },
  {
    id: "dialogue-pass",
    name: "Dialogue polish pass",
    blurb: "A checklist for the second draft of every exchange",
    body: [
      "Read it aloud. Anything you stumble on, the actor will too.",
      "Subtext first: people rarely say what they mean. Let them dodge,",
      "deflect, and answer the question they wish they'd been asked.",
      "Cover the cues: if you can't tell who's talking, the voices aren't",
      "distinct yet — diction, rhythm, what each would never say.",
      "Enter late, leave early. Cut greetings, pleasantries, and everything",
      "after the turn has landed.",
      "One parenthetical per scene is plenty. Direction belongs in action;",
      "a cue drowning in (beat) (sighs) (then, quietly) is the writer acting.",
      "Every line earns its place one of three ways: it advances the plot,",
      "reveals character, or raises the stakes. Otherwise it goes.",
    ].join("\n"),
  },
  {
    id: "character-sketch",
    name: "Character quick-sketch",
    blurb: "Seven prompts that find a voice fast",
    body: [
      "Want — what they'd say they're after, out loud, in one sentence.",
      "Need — what they actually lack. The gap between the two is the arc.",
      "Flaw — the habit that costs them, on display in their first scene.",
      "Ghost — the old wound still billing them. It needn't appear on page;",
      "it must explain their choices.",
      "Voice — three words they'd use, one they'd never touch. Rhythm:",
      "short bursts or long spirals?",
      "Contradiction — the trait that shouldn't fit but does. People without",
      "one read as functions.",
      "Change — who are they in the final image that they weren't in the",
      "opening one? If nobody, they're set dressing.",
    ].join("\n"),
  },
  {
    id: "premise-test",
    name: "The premise test",
    blurb: "One sentence that proves the story exists",
    body: [
      "Fill every bracket: A [flawed hero] must [goal] against [opposition],",
      "or else [stakes] — and becomes [change].",
      "A blank bracket is the draft telling you what's missing.",
      "The goal must be visible on screen: chasable, stealable, winnable —",
      "not 'find happiness' or 'learn to love'.",
      "Give the opposition a point. The best antagonist is the hero's own",
      "argument wearing another face.",
      "State the stakes in one breath: precisely what is lost on failure,",
      "and why we should care.",
      "Say it aloud to a stranger. Where they frown is where the story",
      "is foggy — rewrite that bracket first.",
    ].join("\n"),
  },
  {
    id: "action-lines",
    name: "Action lines that move",
    blurb: "Lean description the camera can shoot",
    body: [
      "Present tense, always: she crosses — never she crossed or is crossing.",
      "One idea per paragraph. White space is pacing: short blocks read fast,",
      "walls of text read slow.",
      "Write only what the camera sees and the microphone hears. No thoughts,",
      "no backstory, no 'we see'.",
      "Sound is free production value: a kettle's scream says more than a",
      "paragraph of dread.",
      "No camera directions unless the shot IS the story. Direct the reader's",
      "eye, not the crew.",
      "Verbs do the lifting: she doesn't walk to the door, she stalks, drifts,",
      "or storms to it. Then stop.",
    ].join("\n"),
  },
  {
    id: "revision-passes",
    name: "Revision passes",
    blurb: "Five drafts in order, so fixes stop unfixing each other",
    body: [
      "Work big to small. Polishing lines on a scene you'll cut is the classic",
      "waste — hence the order:",
      "1. Story — does the spine hold? Check the turns against your beat sheet;",
      "cut or combine scenes that never turn.",
      "2. Character — one read per major voice. Distinct? Want visible in every",
      "scene they're in?",
      "3. Scene — enter late, leave early; run each survivor through the scene test.",
      "4. Dialogue — aloud, subtext, one parenthetical per scene at most.",
      "5. Line — last, and only last. Kill adverbs, throat-clearing, and your ten",
      "favourite clever lines. Nine survive.",
    ].join("\n"),
  },
];
