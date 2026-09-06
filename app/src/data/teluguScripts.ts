// Screenplay study shelf: real shooting scripts to learn from.
//
// These are links, deliberately NOT bundled PDFs and NOT seeded database
// records — same rule as the field guides (data/guides.ts). The PDFs belong
// to their makers and hosts (Film Companion, Idlebrain, Scrite/Scriptick,
// Scripts.com); we only point at the pages that share them for education.
// Saving one makes an ordinary note the writer owns, filed wherever they are.
//
// Every entry was verified reachable in Sep 2026. Where the only free copy
// is a dialogue transcript rather than a shooting script, the format says so
// plainly — a transcript teaches dialogue and structure, not scene craft.

export type TeluguScript = {
  id: string;
  title: string;
  year: number;
  writer: string;
  director: string;
  genre: string;
  /** Which lane of the shelf this belongs to — one only, no overlaps.
      Absent on bonus entries, which render outside the lanes. */
  shelf?: "comedy" | "crime" | "society" | "epic";
  /** Honest label: "Shooting script PDF", "Censor script PDF", "Transcript", … */
  format: string;
  /** Who hosts it, e.g. "Film Companion Scripts". */
  source: string;
  /** Landing page with context + download button. */
  pageUrl: string;
  /** Direct PDF, when the host exposes one. */
  pdfUrl?: string;
  /**
   * Review-only poster hotlink (Wikipedia). Never bundled with the app; the
   * UI falls back to a monogram when absent or unreachable.
   */
  posterUrl?: string;
  logline: string;
  /** One or two lines on what a Throughline writer should steal from it. */
  studyNote: string;
};

export type ShelfLane = {
  id: "comedy" | "crime" | "society" | "epic";
  name: string;
  blurb: string;
};

/** Lanes are by story family, never by format — a transcript sits beside the
    shooting scripts it keeps company with, badged honestly on its card. */
export const SHELF_LANES: ShelfLane[] = [
  {
    id: "comedy",
    name: "Comedy & romance",
    blurb: "Jokes with architecture underneath — love stories that still turn.",
  },
  {
    id: "crime",
    name: "Crime & mystery",
    blurb: "Clues planted in plain sight — comedies that investigate.",
  },
  {
    id: "society",
    name: "Society & power",
    blurb: "Neighbourhoods, collectors, patriarchs — the world outside the window.",
  },
  {
    id: "epic",
    name: "Epic & obsession",
    blurb: "Obsession at full volume — voice, scale, and the interval engine.",
  },
];

export type ShelfKind = "movie" | "series" | "book";

/** Display category: language × movie, series or book. Films default to
    Telugu; spotlight and book entries name their own language. */
export function shelfCategoryOf(t: TeluguScript | SeriesSpotlight | ShelfBook): {
  lang: string;
  kind: ShelfKind;
} {
  if ("author" in t) return { lang: t.lang, kind: "book" };
  return {
    lang: "language" in t && typeof t.language === "string" ? t.language : "Telugu",
    kind: "episodes" in t ? "series" : "movie",
  };
}

/** One label everywhere: cards, filters, saved notes. */
export function shelfCategoryLabel(t: TeluguScript | SeriesSpotlight | ShelfBook): string {
  const c = shelfCategoryOf(t);
  const kind = c.kind === "movie" ? "Movies" : c.kind === "series" ? "Web series" : "Books";
  return `${c.lang} · ${kind}`;
}

export const TELUGU_SCRIPTS: TeluguScript[] = [
  {
    id: "pelli-choopulu",
    title: "Pelli Choopulu",
    year: 2016,
    writer: "Tharun Bhascker",
    director: "Tharun Bhascker",
    genre: "Rom-com",
    shelf: "comedy",
    format: "Shooting script PDF",
    source: "Film Companion Scripts",
    pageUrl: "https://www.filmcompanion.in/companion-zone/download-the-script-of-pelli-choopulu",
    pdfUrl:
      "https://images.assettype.com/filmcompanion/2022-10/b24f474f-0080-4efa-959f-06877f3687b7/Pellichoopulu_1.pdf",
    posterUrl: "https://upload.wikimedia.org/wikipedia/en/b/b3/Pelli_Choopulu_poster.jpg",
    logline:
      "A boy and a girl meet at a matchmaking gone wrong and get locked in a room together; their food-truck dreams do the rest.",
    studyNote:
      "Study the locked-room second act: one location, two wants, no villains. National Award for Best Telugu Film on a tiny budget.",
  },
  {
    id: "agent-sai-srinivasa-athreya",
    title: "Agent Sai Srinivasa Athreya",
    year: 2019,
    writer: "Swaroop RSJ, Naveen Polishetty",
    director: "Swaroop RSJ",
    genre: "Detective comedy-thriller",
    shelf: "crime",
    format: "Scene-divided shooting script PDF",
    source: "Film Companion Scripts",
    pageUrl:
      "https://www.filmcompanion.in/companion-zone/download-the-script-of-agent-sai-srinivas-athreya-starring-naveen-polishetty",
    pdfUrl:
      "https://images.assettype.com/filmcompanion/2022-10/b1346406-2ffc-428b-9a59-3ef8e095c403/Agent_Sai_Srinivasa_Athreya_Script.pdf",
    posterUrl:
      "https://upload.wikimedia.org/wikipedia/en/6/61/Agent_Sai_Srinivasa_Athreya_poster.jpg",
    logline:
      "Nellore's self-styled detective runs the Fathima Bureau of Investigation out of a room near the vegetable market — then a real case lands.",
    studyNote:
      "Best free example of clue-planting in Telugu: every gag in act one pays off as evidence in act three. Watch how deduction scenes stay visual.",
  },
  {
    id: "brochevarevarura",
    title: "Brochevarevarura",
    year: 2019,
    writer: "Vivek Athreya",
    director: "Vivek Athreya",
    genre: "Crime caper / comedy",
    shelf: "crime",
    format: "Screenplay PDF",
    source: "Film Companion Scripts",
    pageUrl: "https://www.filmcompanion.in/companion-zone/download-the-script-of-brochevarevarura",
    pdfUrl:
      "https://images.assettype.com/filmcompanion/2022-10/e2b38461-9a3b-4ca7-8ff8-c16f042d3665/BROCHEVAREVARURA_Screenplay__FILM_COMPANION.pdf",
    posterUrl: "https://upload.wikimedia.org/wikipedia/en/6/68/Brochevarevarura_poster.jpg",
    logline:
      "Three failing students fake a kidnapping while an aspiring director courts a star — the two plots collide.",
    studyNote:
      "Study the braided two-track structure: parallel stories that only touch at the midpoint, then fuse. Pairs well with Mental Madhilo by the same writer.",
  },
  {
    id: "jathi-ratnalu",
    title: "Jathi Ratnalu",
    year: 2021,
    writer: "Anudeep KV",
    director: "Anudeep KV",
    genre: "Comedy",
    shelf: "comedy",
    format: "Censor script PDF (signed)",
    source: "Film Companion via Scrite",
    pageUrl: "https://www.scrite.io/download-jathi-ratnalu-telugu-movie-script-pdf/",
    pdfUrl:
      "https://images.assettype.com/filmcompanion/2022-10/f7601921-9c3e-4842-a7ef-fb027b0b6694/Jathi_rathanalu_censor_script_with_sign_pdf_after_censor_cuts.pdf",
    posterUrl: "https://upload.wikimedia.org/wikipedia/en/7/7e/Jathi_Ratnalu_poster.jpg",
    logline:
      "Three small-town friends move to Hyderabad chasing jobs and status, and walk straight into a minister's downfall.",
    studyNote:
      "Study joke density without losing plot: each set piece also moves the courtroom frame story. Produced by Nag Ashwin; a mid-size film that out-ran star vehicles.",
  },
  {
    id: "care-of-kancharapalem",
    title: "C/o Kancharapalem",
    year: 2018,
    writer: "Venkatesh Maha",
    director: "Venkatesh Maha",
    genre: "Anthology / slice-of-life",
    shelf: "society",
    format: "Full script PDF (English)",
    source: "Scriptick library",
    pageUrl: "https://scriptick.in/en/popular.html",
    pdfUrl: "https://scriptick.in/pop_scripts/en/Care%20of%20Kancharapalem.pdf",
    logline:
      "Four love stories across ages in one Visakhapatnam neighbourhood, shot in sync sound with non-actors.",
    studyNote:
      "Study writing for real locations and non-actors: short scenes, plain speech, behaviour over dialogue. Made by crowdfunding; a proof that scope is not budget.",
  },
  {
    id: "republic",
    title: "Republic",
    year: 2021,
    writer: "Deva Katta",
    director: "Deva Katta",
    genre: "Political drama",
    shelf: "society",
    format: "152-page screenplay PDF (Telugu)",
    source: "Director via Idlebrain",
    pageUrl: "https://www.idlebrain.com/news/today/republic-screenplay.html",
    pdfUrl: "https://idlebrain.com/images5/republic-telugu.pdf",
    posterUrl: "https://upload.wikimedia.org/wikipedia/en/a/a4/Republic_film.jpg",
    logline:
      "An idealist collector takes on a entrenched political machine in a Rayalaseema-like district.",
    studyNote:
      "Rare director-shared political screenplay. Study how exposition becomes confrontation: almost every information scene is also a power negotiation.",
  },
  {
    id: "prasthanam",
    title: "Prasthanam",
    year: 2010,
    writer: "Deva Katta",
    director: "Deva Katta",
    genre: "Political family drama",
    shelf: "society",
    format: "Shooting draft script PDF, Mar 2009 (Telugu)",
    source: "Director via Idlebrain",
    pageUrl: "https://www.idlebrain.com/news/2000march20/prasthanam-screenplay.html",
    pdfUrl: "https://www.idlebrain.com/images4/screenplay-prasthanam.pdf",
    logline:
      "A political patriarch's legitimate and illegitimate sons inherit his empire — and his sins.",
    studyNote:
      "Study the Godfather-shaped Telugu original: compare this 2009 draft against the 2010 film to see what was cut, merged, or moved off-screen.",
  },
  {
    id: "mental-madhilo",
    title: "Mental Madhilo",
    year: 2017,
    writer: "Vivek Athreya",
    director: "Vivek Athreya",
    genre: "Romantic drama",
    shelf: "comedy",
    format: "Published screenplay book (Telugu + English)",
    source: "Kinige / Bommalaata",
    pageUrl: "https://pdfcoffee.com/mentalmadilocinemascreenplay-free-kinigedotcom-pdf-free.html",
    posterUrl: "https://upload.wikimedia.org/wikipedia/en/5/53/Mental_Madhilo.jpg",
    logline:
      "A chronically indecisive man keeps losing the decisive woman he is supposed to marry.",
    studyNote:
      "The official ebook lives on Kinige (Bommalaata series); the link is a readable copy. Study the confusion-as-engine structure: the flaw IS the plot.",
  },
  {
    id: "arjun-reddy",
    title: "Arjun Reddy",
    year: 2017,
    writer: "Sandeep Reddy Vanga",
    director: "Sandeep Reddy Vanga",
    genre: "Romantic drama",
    shelf: "epic",
    format: "Full dialogue transcript (English)",
    source: "Scripts.com",
    pageUrl: "https://www.scripts.com/script/arjun_reddy_3089",
    posterUrl: "https://upload.wikimedia.org/wikipedia/en/4/46/Arjun_Reddy.jpg",
    logline: "A brilliant, self-destructive surgeon spirals after losing the woman he loves.",
    studyNote:
      "Transcript, not a shooting script — use it for voice and scene-length study, not formatting. Compare any scene against its Kabir Singh remake to see what survives translation.",
  },
  {
    id: "baahubali-beginning",
    title: "Baahubali: The Beginning",
    year: 2015,
    writer: "K. V. Vijayendra Prasad",
    director: "S. S. Rajamouli",
    genre: "Epic action",
    shelf: "epic",
    format: "Full dialogue transcript (English)",
    source: "Scripts.com",
    pageUrl: "https://www.scripts.com/script/baahubali:_the_beginning_3365",
    posterUrl: "https://upload.wikimedia.org/wikipedia/en/5/5f/Baahubali_The_Beginning_poster.jpg",
    logline:
      "A mountain boy discovers he is the heir of Mahishmati and climbs toward his father's story.",
    studyNote:
      "Transcript, not a shooting script — study the interval-point architecture: every 10 minutes a reveal, every 30 a set piece, emotion underneath all of it.",
  },
];

// Long-form bonus: no Telugu web-series screenplays are shared publicly yet
// (verified Sep 2026 — searches surface only reviews, listings, and narration
// channels, never scripts). This Hindi landmark, from the same maker-shared
// Film Companion shelf, is the closest craft reference for serial structure:
// nine locked episode drafts showing how a season parcels its reveals.
export type SeriesSpotlight = TeluguScript & {
  language: string;
  episodes: number;
};

export const SERIES_SPOTLIGHT: SeriesSpotlight[] = [
  {
    id: "paatal-lok-s1",
    title: "Paatal Lok (Season 1)",
    year: 2020,
    writer: "Sudip Sharma, Hardik Mehta, Sagar Haveli, Gunjit Chopra",
    director: "Avinash Arun, Prosit Roy",
    genre: "Crime drama series",
    format: "9 locked episode drafts, PDF",
    source: "Film Companion Scripts",
    pageUrl: "https://www.filmcompanion.in/streaming/download-the-script-of-paatal-lok",
    posterUrl: "https://upload.wikimedia.org/wikipedia/en/3/39/Paatal_Lok_poster.jpg",
    logline:
      "A disillusioned Delhi cop lands an assassination case gone wrong — and finds three Indias underneath it.",
    studyNote:
      "Watch a season think in episodes: each draft is labelled with its lock version, so you can see how late the back half was still moving. The benchmark until Telugu series scripts surface.",
    language: "Hindi",
    episodes: 9,
  },
];

// Craft books: pages and prices only where verified on the linked page.
// Links go to author sites, publishers, booksellers and libraries — never
// piracy. Covers are review-only hotlinks like the posters.
export type ShelfBook = {
  id: string;
  title: string;
  author: string;
  year: number;
  lang: string;
  /** Shelf chip detail, e.g. "Craft book · 480 pp". */
  detail: string;
  /** Where the link goes, e.g. "Author site". */
  source: string;
  blurb: string;
  why: string;
  pageUrl: string;
  posterUrl?: string;
};

export const SHELF_BOOKS: ShelfBook[] = [
  {
    id: "book-save-the-cat",
    title: "Save the Cat!",
    author: "Blake Snyder",
    year: 2005,
    lang: "English",
    detail: "Craft book",
    source: "Author site",
    blurb:
      "The 15-beat structure bible behind a thousand pitches — logline, ten genres, the board.",
    why: "Pairs with this app's own Save the Cat sheet: read the chapter, then tick the beats.",
    pageUrl: "https://www.savethecat.com/",
    posterUrl:
      "https://upload.wikimedia.org/wikipedia/en/6/65/Save_the_Cat%21_The_Last_Book_on_Screenwriting_You%27ll_Ever_Need.jpg",
  },
  {
    id: "book-story-mckee",
    title: "Story",
    author: "Robert McKee",
    year: 1997,
    lang: "English",
    detail: "Craft book · 480 pp",
    source: "Author site",
    blurb:
      "Form, not formula: the seminar bible on structure, character, image systems and acts beyond three.",
    why: "Read after Save the Cat to graduate from beats to principles — then run scenes through the scene test.",
    pageUrl: "https://mckeestory.com/books/story/",
  },
  {
    id: "book-screenplay-field",
    title: "Screenplay",
    author: "Syd Field",
    year: 1979,
    lang: "English",
    detail: "Craft book",
    source: "Open Library",
    blurb:
      "The original three-act paradigm: setup, confrontation, resolution — plot points near pages 25 and 75.",
    why: "The industry's first shared vocabulary; dated in places, foundational everywhere.",
    pageUrl:
      "https://openlibrary.org/search?q=screenplay+the+foundations+of+screenwriting+syd+field",
  },
  {
    id: "book-anatomy-truby",
    title: "The Anatomy of Story",
    author: "John Truby",
    year: 2007,
    lang: "English",
    detail: "Craft book",
    source: "Author site",
    blurb: "22 steps from weakness to new equilibrium — character web, moral argument, symbol web.",
    why: "The antidote to beat-counting: build the hero's moral change first.",
    pageUrl: "https://truby.com/the-anatomy-of-story/",
  },
  {
    id: "book-adventures-goldman",
    title: "Adventures in the Screen Trade",
    author: "William Goldman",
    year: 1983,
    lang: "English",
    detail: "Memoir & craft · 608 pp",
    source: "Goodreads",
    blurb:
      "“Nobody knows anything”: Hollywood war stories plus a full adaptation workshop in the Da Vinci section.",
    why: "Learn how scripts actually survive studios — and watch a writer adapt his own story on the page.",
    pageUrl: "https://www.goodreads.com/book/show/459744.Adventures_in_the_Screen_Trade",
    posterUrl: "https://upload.wikimedia.org/wikipedia/en/2/29/AdventuresInTheScreenTrade.jpg",
  },
  {
    id: "book-making-movies",
    title: "Making Movies",
    author: "Sidney Lumet",
    year: 1995,
    lang: "English",
    detail: "Director memoir · 240 pp",
    source: "Apple Books",
    blurb:
      "A director explains what he needs from a script — rehearsal, lenses, and the cutting room.",
    why: "Read your action lines through a director's eyes: shootable, cuttable, actable.",
    pageUrl: "https://books.apple.com/us/book/making-movies/id420537049",
  },
  {
    id: "book-samagra-script",
    title: "Samagra Cinema Script Rayadam Ala",
    author: "Dasam Venkatarao",
    year: 2022,
    lang: "Telugu",
    detail: "Craft book · 117 pp",
    source: "Logili Books",
    blurb:
      "What a complete Telugu script contains: story, scenic order, songs and fights, dialogue, shot division.",
    why: "The only craft manual on this shelf written for Telugu production realities.",
    pageUrl:
      "https://logilitelugubooks.com/book/samagra-cinema-script-rayadam-ala-dasam-venkatarao-movie-writer",
  },
  {
    id: "book-screenplay-darshakatvam",
    title: "Cinema Screenplay Darshakatvam Nerchukovadam Ala",
    author: "Dasam Venkatarao",
    year: 2022,
    lang: "Telugu",
    detail: "Craft book · 160 pp",
    source: "Logili Books",
    blurb:
      "The science, maths and technique of cinema: story as illusion, engineered shot by shot.",
    why: "Pairs with the action-lines guide: write only what the camera and microphone catch.",
    pageUrl:
      "https://www.logilitelugubooks.com/book/cinema-screenplay-darshakatvam-nerchukovadam-ala-dasam-venkatarao-movie-writer",
  },
];
