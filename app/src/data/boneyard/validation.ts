import { Effect, Schema } from "effect";
import type { Revision, Kind } from "./types";

export const KindSchema = Schema.Literal(
  "idea",
  "thought",
  "collection",
  "membership",
  "connection",
  "evolution",
);

const kinds = new Set(["idea", "thought", "collection", "membership", "connection", "evolution"]);

const IdSchema = Schema.String.pipe(Schema.minLength(1), Schema.maxLength(250));
const ContentStringSchema = Schema.String.pipe(Schema.maxLength(500_000));
const TimestampSchema = Schema.Number.pipe(Schema.filter((n) => Number.isFinite(n) && n >= 0));

export const IdeaValueSchema = Schema.Struct({
  id: IdSchema,
  title: ContentStringSchema,
  body: ContentStringSchema,
  original: ContentStringSchema,
  tags: Schema.Array(IdSchema).pipe(Schema.maxItems(10000)),
  pinned: Schema.Boolean,
  disposition: Schema.Literal("active", "aside", "trash"),
  createdAt: Schema.NullOr(TimestampSchema),
  updatedAt: TimestampSchema,
  snoozedUntil: Schema.optional(TimestampSchema),
  lastShownAt: Schema.optional(TimestampSchema),
});

export const ThoughtValueSchema = Schema.Struct({
  id: IdSchema,
  ideaId: IdSchema,
  body: ContentStringSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  deleted: Schema.Boolean,
});

export const CollectionValueSchema = Schema.Struct({
  id: IdSchema,
  title: ContentStringSchema,
  description: ContentStringSchema,
  deleted: Schema.Boolean,
});

export const MembershipValueSchema = Schema.Struct({
  id: IdSchema,
  ideaId: IdSchema,
  collectionId: IdSchema,
  deleted: Schema.Boolean,
});

export const ConnectionValueSchema = Schema.Struct({
  id: IdSchema,
  from: IdSchema,
  to: IdSchema,
  note: ContentStringSchema,
  deleted: Schema.Boolean,
}).pipe(Schema.filter((c) => c.from !== c.to));

export const EvolutionValueSchema = Schema.Struct({
  id: IdSchema,
  sourceIds: Schema.Array(IdSchema).pipe(Schema.minItems(1), Schema.maxItems(10000)),
  destinationId: IdSchema,
  destinationTitle: ContentStringSchema,
  summary: ContentStringSchema,
  createdAt: TimestampSchema,
  referenceId: Schema.optional(IdSchema),
});

const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const string = (v: unknown): v is string => typeof v === "string" && v.length <= 500_000;
const id = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 250;
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.length <= 10000 && v.every(id);
const time = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= 0;

/**
 * Validate Boneyard revisions using Effect.
 * Validates at both the backup and network boundaries, before any write.
 */
export function parseRevisionsEffect(input: unknown): Effect.Effect<Revision[], Error> {
  return Effect.gen(function* () {
    if (!Array.isArray(input) || input.length > 100_000) {
      return yield* Effect.fail(new Error("Invalid Boneyard records."));
    }
    const seen = new Map<string, string>();
    for (const r of input) {
      if (
        !record(r) ||
        !id(r.id) ||
        !id(r.entityId) ||
        !kinds.has(String(r.kind)) ||
        !strings(r.parents) ||
        !time(r.at) ||
        !record(r.value) ||
        r.value.id !== r.entityId
      ) {
        return yield* Effect.fail(new Error("Invalid idea revision."));
      }
      if (r.parents.includes(r.id)) {
        return yield* Effect.fail(new Error("A revision cannot be its own parent."));
      }
      const v = r.value;
      let valid = false;
      switch (r.kind) {
        case "idea":
          valid =
            string(v.title) &&
            string(v.body) &&
            string(v.original) &&
            strings(v.tags) &&
            typeof v.pinned === "boolean" &&
            ["active", "aside", "trash"].includes(String(v.disposition)) &&
            (v.createdAt === null || time(v.createdAt)) &&
            time(v.updatedAt) &&
            (v.snoozedUntil === undefined || time(v.snoozedUntil)) &&
            (v.lastShownAt === undefined || time(v.lastShownAt));
          break;
        case "thought":
          valid =
            id(v.ideaId) &&
            string(v.body) &&
            time(v.createdAt) &&
            time(v.updatedAt) &&
            typeof v.deleted === "boolean";
          break;
        case "collection":
          valid = string(v.title) && string(v.description) && typeof v.deleted === "boolean";
          break;
        case "membership":
          valid = id(v.ideaId) && id(v.collectionId) && typeof v.deleted === "boolean";
          break;
        case "connection":
          valid =
            id(v.from) &&
            id(v.to) &&
            v.from !== v.to &&
            string(v.note) &&
            typeof v.deleted === "boolean";
          break;
        case "evolution":
          valid =
            strings(v.sourceIds) &&
            v.sourceIds.length > 0 &&
            id(v.destinationId) &&
            string(v.destinationTitle) &&
            string(v.summary) &&
            time(v.createdAt) &&
            (v.referenceId === undefined || id(v.referenceId));
          break;
      }
      if (!valid) {
        return yield* Effect.fail(new Error(`Invalid ${String(r.kind)} content.`));
      }
      const encoded = JSON.stringify(r);
      if (seen.has(r.id) && seen.get(r.id) !== encoded) {
        return yield* Effect.fail(new Error("Conflicting immutable revision IDs."));
      }
      seen.set(r.id, encoded);
    }
    return input as Revision[];
  });
}

/** Validate at both the backup and network boundaries, before any write. */
export function parseRevisions(input: unknown): Revision[] {
  return Effect.runSync(parseRevisionsEffect(input));
}

/**
 * Validate acyclic DAG history of revisions using Effect.
 */
export function validateHistoryEffect(records: Revision[]): Effect.Effect<void, Error> {
  return Effect.gen(function* () {
    const byId = new Map(records.map((r) => [r.id, r]));
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (r: Revision): Effect.Effect<void, Error> =>
      Effect.gen(function* () {
        if (visited.has(r.id)) return;
        if (visiting.has(r.id)) {
          return yield* Effect.fail(new Error("Invalid cyclic revision history."));
        }
        visiting.add(r.id);
        for (const parentId of r.parents) {
          const parent = byId.get(parentId);
          if (!parent || parent.entityId !== r.entityId || parent.kind !== r.kind) {
            return yield* Effect.fail(new Error("Incomplete or invalid revision history."));
          }
          yield* visit(parent);
        }
        visiting.delete(r.id);
        visited.add(r.id);
      });

    const entityKinds = new Map<string, Kind>();
    for (const r of records) {
      if (entityKinds.has(r.entityId) && entityKinds.get(r.entityId) !== r.kind) {
        return yield* Effect.fail(new Error("An entity cannot change its record type."));
      }
      entityKinds.set(r.entityId, r.kind);
      yield* visit(r);
    }
  });
}

export function validateHistory(records: Revision[]): void {
  Effect.runSync(validateHistoryEffect(records));
}
