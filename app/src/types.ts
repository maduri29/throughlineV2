export const NODE_TYPES = [
  "seed",
  "project",
  "episode",
  "scene",
  "character",
  "location",
  "theme",
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
};

export type GraphEdge = {
  id: string;
  type: EdgeType;
  from: string;
  to: string;
  label?: string;
};
