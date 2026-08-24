export const NODE_TYPES = [
  "seed",
  "project",
  "episode",
  "scene",
  "character",
  "location",
  "theme",
  "reference",
] as const;
export type NodeType = (typeof NODE_TYPES)[number];

export const TODS = [
  "Dawn",
  "Day",
  "Dusk",
  "Night",
  "Continuous",
  "Later",
  "Moments Later",
] as const;
export type Tod = (typeof TODS)[number];

/** Structured story time per ADR-0001. Flashbacks are negative storyDays + edges, never flags. */
export type StoryTime = {
  storyDay: number | null;
  tod: Tod | null;
  eraLabel: string | null;
};

/** The locked twelve-edge vocabulary (ADR-0001). */
export const EDGE_TYPES = [
  "contains",
  "appears_in",
  "takes_place_at",
  "relates_to",
  "precedes",
  "flashback_of",
  "parallels",
  "sets_up",
  "foreshadows",
  "embodies",
  "grew_into",
  "related_to",
] as const;
export type EdgeType = (typeof EDGE_TYPES)[number];

/** Role suggestions for characters; the field itself stays free text. */
export const CHAR_ROLE_SUGGESTIONS = ["Protagonist", "Antagonist", "Supporting", "Minor"] as const;

export type GraphNode = {
  id: string;
  type: NodeType;
  title: string;
  synopsis?: string;
  storyTime?: StoryTime;
  parentId?: string;
  /** Container ordering of child scenes (episode/project). */
  order?: string[];
  /** Manual Map position override; null/absent = Tidy layout decides. */
  pos?: { x: number; y: number } | null;
  /** Fountain Fragment body (Script lens, T6). */
  fountain?: string;
  /** Scene-heading prefix for the synced slug (T6 §slug; default INT.). */
  intExt?: "INT." | "EXT." | "EST." | "INT./EXT.";
  /** Project-node title-page fields. */
  author?: string;
  contact?: string;
  /** Character-node dramatic position, free text ("Protagonist", "Foil"). */
  role?: string;
  /** Character-node off-screen history; longer form than synopsis. */
  backstory?: string;
  /** Reference-node source link. */
  url?: string;
  /**
   * Reference-node attachments: metadata only, deliberately.
   *
   * The bytes live in the IndexedDB `files` store. They are NOT here because
   * this record is what the lossless envelope exports and what the sync tier
   * pushes as jsonb — base64 blobs would bloat every push and be re-uploaded on
   * every unrelated edit. So a file follows the story between devices as a name
   * and a size, and the UI says plainly when the bytes are not on this one.
   */
  attachments?: Attachment[];
  /** Reference-node beat sheet. Structured is the source of truth (data/beats.ts). */
  beats?: Beat[];
};

export type Beat = {
  id: string;
  name: string;
  done: boolean;
  note?: string;
  /** Scene that fulfils this beat, if one has been linked. */
  sceneId?: string;
};

export type Attachment = {
  id: string;
  name: string;
  /** MIME type as reported by the browser; may be empty for unknown types. */
  mime: string;
  size: number;
};

export type GraphEdge = {
  id: string;
  type: EdgeType;
  from: string;
  to: string;
  label?: string;
};
