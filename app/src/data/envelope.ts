// Portable project envelope (ADR-0001): `{schemaVersion, project, nodes[], edges[]}`.
//
// This is the ONLY lossless way data leaves the browser. `.fountain` export
// carries the screenplay but not the graph -- characters, typed edges, story
// time and themes are exactly what makes this not a word processor, and none of
// them survive that format. Without this file the user's structural work exists
// in precisely one place: an IndexedDB the browser is entitled to evict.
//
// Import validates rather than trusts. A hand-edited or half-written file that
// merges silently would corrupt the graph in ways undo cannot reach, so every
// record is checked and anything unrecognised is rejected with a reason.
import { Effect } from "effect";
import {
  EDGE_TYPES,
  NODE_TYPES,
  TODS,
  type Attachment,
  type Beat,
  type EdgeType,
  type GraphEdge,
  type GraphNode,
  type NodeType,
  type StoryTime,
  type Tod,
} from "../types";

/** Bumped only for shape changes that need a migration. */
const ENVELOPE_VERSION = 1;

export type Envelope = {
  schemaVersion: number;
  exportedAt: string;
  project: GraphNode;
  nodes: GraphNode[];
  edges: GraphEdge[];
};

export type ImportResult = { ok: true; envelope: Envelope } | { ok: false; error: string };

/* --------------------------------- export --------------------------------- */

/**
 * Everything reachable from the project, by the same rule the app itself uses
 * to decide what belongs to a project — so an export contains exactly what the
 * workspace shows, no more.
 */
export function buildEnvelope(
  project: GraphNode,
  nodes: Record<string, GraphNode>,
  edges: Record<string, GraphEdge>,
): Envelope {
  return {
    schemaVersion: ENVELOPE_VERSION,
    exportedAt: new Date().toISOString(),
    project,
    nodes: Object.values(nodes).filter((n) => n.id !== project.id),
    edges: Object.values(edges),
  };
}

export function envelopeToJson(env: Envelope): string {
  return `${JSON.stringify(env, null, 2)}\n`;
}

/* --------------------------------- import --------------------------------- */

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function readStoryTime(v: unknown): StoryTime | undefined {
  if (!isRecord(v)) return undefined;
  const day = v["storyDay"];
  const tod = v["tod"];
  const era = v["eraLabel"];
  return {
    storyDay: typeof day === "number" ? day : null,
    tod: typeof tod === "string" && (TODS as readonly string[]).includes(tod) ? (tod as Tod) : null,
    eraLabel: typeof era === "string" ? era : null,
  };
}

function readNode(v: unknown, where: string): GraphNode | string {
  if (!isRecord(v)) return `${where}: not an object`;
  const id = v["id"];
  const type = v["type"];
  const title = v["title"];
  if (typeof id !== "string" || id === "") return `${where}: missing id`;
  if (typeof type !== "string" || !(NODE_TYPES as readonly string[]).includes(type)) {
    return `${where}: unknown node type ${String(type)}`;
  }
  if (typeof title !== "string") return `${where}: missing title`;

  const node: GraphNode = { id, type: type as NodeType, title };
  const str = (k: string): void => {
    const raw = v[k];
    if (typeof raw === "string") Object.assign(node, { [k]: raw });
  };
  for (const k of [
    "synopsis",
    "turningPoint",
    "parentId",
    "fountain",
    "intExt",
    "author",
    "contact",
    "role",
    "backstory",
    "age",
    "traits",
    "motivation",
    "conflict",
    "appearance",
    "posterImage",
    "relationships",
    "url",
    "sparkType",
  ]) {
    str(k);
  }
  if (typeof v["needsWork"] === "boolean") node.needsWork = v["needsWork"];
  const order = v["order"];
  if (Array.isArray(order) && order.every((x) => typeof x === "string")) node.order = order;
  const pos = v["pos"];
  if (isRecord(pos) && typeof pos["x"] === "number" && typeof pos["y"] === "number") {
    node.pos = { x: pos["x"], y: pos["y"] };
  }
  const st = readStoryTime(v["storyTime"]);
  if (st) node.storyTime = st;

  // Attachment METADATA only — the bytes live in the IndexedDB `files` store and
  // deliberately do not travel (data/files.ts). Importing keeps the record so the
  // reader can see a file was collected, and the UI marks it as elsewhere.
  const rawBeats = v["beats"];
  if (Array.isArray(rawBeats)) {
    const kept: Beat[] = [];
    for (const b of rawBeats) {
      if (!isRecord(b)) continue;
      const { id, name, done, note, sceneId } = b;
      if (typeof id !== "string" || typeof name !== "string") continue;
      kept.push({
        id,
        name,
        done: done === true,
        ...(typeof note === "string" && note ? { note } : {}),
        ...(typeof sceneId === "string" && sceneId ? { sceneId } : {}),
      });
    }
    if (kept.length > 0) node.beats = kept;
  }

  const atts = v["attachments"];
  if (Array.isArray(atts)) {
    const kept: Attachment[] = [];
    for (const a of atts) {
      if (!isRecord(a)) continue;
      const { id, name, mime, size } = a;
      if (typeof id !== "string" || typeof name !== "string") continue;
      kept.push({
        id,
        name,
        mime: typeof mime === "string" ? mime : "",
        size: typeof size === "number" ? size : 0,
      });
    }
    if (kept.length > 0) node.attachments = kept;
  }
  const sources = v["ideaSources"];
  if (sources !== undefined) {
    if (
      !Array.isArray(sources) ||
      sources.some(
        (source) =>
          !isRecord(source) ||
          typeof source.id !== "string" ||
          typeof source.title !== "string" ||
          typeof source.body !== "string",
      )
    )
      return `${where}: invalid idea sources`;
    node.ideaSources = sources.map((source) => ({
      id: source.id,
      title: source.title,
      body: source.body,
    }));
  }
  return node;
}

function readEdge(v: unknown, where: string): GraphEdge | string {
  if (!isRecord(v)) return `${where}: not an object`;
  const { id, type, from, to } = v as Record<string, unknown>;
  if (typeof id !== "string" || id === "") return `${where}: missing id`;
  if (typeof type !== "string" || !(EDGE_TYPES as readonly string[]).includes(type)) {
    return `${where}: unknown edge type ${String(type)}`;
  }
  if (typeof from !== "string" || typeof to !== "string") return `${where}: missing endpoint`;
  const edge: GraphEdge = { id, type: type as EdgeType, from, to };
  if (typeof v["label"] === "string") edge.label = v["label"] as string;
  return edge;
}

class EnvelopeError extends Error {
  readonly _tag = "EnvelopeError";
}

/**
 * Parse and validate envelope with Effect.
 * Returns an Effect that fails with EnvelopeError or succeeds with validated Envelope.
 */
export function parseEnvelopeEffect(text: string): Effect.Effect<Envelope, EnvelopeError> {
  return Effect.gen(function* () {
    const raw = yield* Effect.try({
      try: () => JSON.parse(text),
      catch: () => new EnvelopeError("Not valid JSON."),
    });

    if (!isRecord(raw)) {
      return yield* Effect.fail(new EnvelopeError("Top level is not an object."));
    }

    const version = raw["schemaVersion"];
    if (typeof version !== "number") {
      return yield* Effect.fail(new EnvelopeError("Missing schemaVersion."));
    }
    if (version > ENVELOPE_VERSION) {
      return yield* Effect.fail(
        new EnvelopeError(
          `File is schemaVersion ${version}; this build understands up to ${ENVELOPE_VERSION}.`,
        ),
      );
    }

    const projectRaw = readNode(raw["project"], "project");
    if (typeof projectRaw === "string") {
      return yield* Effect.fail(new EnvelopeError(projectRaw));
    }
    if (projectRaw.type !== "project") {
      return yield* Effect.fail(new EnvelopeError("project is not a project node."));
    }

    const nodesRaw = raw["nodes"];
    const edgesRaw = raw["edges"];
    if (!Array.isArray(nodesRaw)) {
      return yield* Effect.fail(new EnvelopeError("nodes is not an array."));
    }
    if (!Array.isArray(edgesRaw)) {
      return yield* Effect.fail(new EnvelopeError("edges is not an array."));
    }

    const nodes = yield* Effect.all(
      nodesRaw.map((n, i) => {
        const parsed = readNode(n, `nodes[${i}]`);
        return typeof parsed === "string"
          ? Effect.fail(new EnvelopeError(parsed))
          : Effect.succeed(parsed);
      }),
      { concurrency: "unbounded" },
    );

    const known = new Set<string>([projectRaw.id, ...nodes.map((n) => n.id)]);
    const rawEdges = yield* Effect.all(
      edgesRaw.map((e, i) => {
        const parsed = readEdge(e, `edges[${i}]`);
        return typeof parsed === "string"
          ? Effect.fail(new EnvelopeError(parsed))
          : Effect.succeed(parsed);
      }),
      { concurrency: "unbounded" },
    );
    const edges = rawEdges.filter((parsed) => known.has(parsed.from) && known.has(parsed.to));

    const exportedAt = raw["exportedAt"];
    const envelope: Envelope = {
      schemaVersion: version,
      exportedAt: typeof exportedAt === "string" ? exportedAt : new Date().toISOString(),
      project: projectRaw,
      nodes,
      edges,
    };

    return envelope;
  });
}

/**
 * Parse and validate. Edges pointing at nodes the file does not contain are
 * dropped, not imported: a dangling edge renders as a connection to nowhere and
 * would be harder to find later than it is to discard now.
 */
export function parseEnvelope(text: string): ImportResult {
  return Effect.runSync(
    parseEnvelopeEffect(text).pipe(
      Effect.map((envelope): ImportResult => ({ ok: true, envelope })),
      Effect.catchAll((err) => Effect.succeed<ImportResult>({ ok: false, error: err.message })),
    ),
  );
}

/* -------------------------------- download -------------------------------- */

function kebab(title: string): string {
  return (
    title
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "untitled"
  );
}

export function downloadEnvelope(env: Envelope): void {
  const url = URL.createObjectURL(
    new Blob([envelopeToJson(env)], { type: "application/json;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `${kebab(env.project.title)}.story-lane.json`;
  a.click();
  URL.revokeObjectURL(url);
}
