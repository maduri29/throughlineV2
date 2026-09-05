export type IdeaDisposition = "active" | "aside" | "trash";
export type Idea = {
  id: string;
  title: string;
  body: string;
  original: string;
  tags: string[];
  pinned: boolean;
  disposition: IdeaDisposition;
  createdAt: number | null;
  updatedAt: number;
  snoozedUntil?: number;
  lastShownAt?: number;
};
export type Thought = {
  id: string;
  ideaId: string;
  body: string;
  createdAt: number;
  updatedAt: number;
  deleted: boolean;
};
export type Collection = { id: string; title: string; description: string; deleted: boolean };
export type Membership = { id: string; ideaId: string; collectionId: string; deleted: boolean };
export type IdeaConnection = {
  id: string;
  from: string;
  to: string;
  note: string;
  deleted: boolean;
};
export type Evolution = {
  id: string;
  sourceIds: string[];
  destinationId: string;
  destinationTitle: string;
  summary: string;
  createdAt: number;
  referenceId?: string;
};
export type EntityMap = {
  idea: Idea;
  thought: Thought;
  collection: Collection;
  membership: Membership;
  connection: IdeaConnection;
  evolution: Evolution;
};
export type Kind = keyof EntityMap;
export type Revision = {
  [K in Kind]: {
    id: string;
    entityId: string;
    kind: K;
    parents: string[];
    at: number;
    value: EntityMap[K];
  };
}[Kind];
export type Conflict = { entityId: string; kind: Kind; versions: Revision[] };
export type BoneyardSnapshot = {
  ideas: Idea[];
  thoughts: Thought[];
  collections: Collection[];
  memberships: Membership[];
  connections: IdeaConnection[];
  evolutions: Evolution[];
  conflicts: Conflict[];
  revisions: Revision[];
};
export type EvolutionInput = {
  operationId: string;
  sourceIds: string[];
  title: string;
  summary: string;
  destinationId?: string;
};
