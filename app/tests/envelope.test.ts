import { describe, expect, test } from "bun:test";
import { buildEnvelope, envelopeToJson, parseEnvelope } from "../src/data/envelope";
import { demoGraph } from "../src/demo";
import type { GraphEdge, GraphNode } from "../src/types";

function maps() {
  const g = demoGraph();
  const nodes: Record<string, GraphNode> = {};
  for (const n of g.nodes) nodes[n.id] = n;
  const edges: Record<string, GraphEdge> = {};
  for (const e of g.edges) edges[e.id] = e;
  const project = g.nodes.find((n) => n.type === "project") as GraphNode;
  return { project, nodes, edges };
}

describe("envelope round-trip", () => {
  test("survives export -> JSON -> import with nothing lost", () => {
    const { project, nodes, edges } = maps();
    const out = parseEnvelope(envelopeToJson(buildEnvelope(project, nodes, edges)));
    if (!out.ok) throw new Error(out.error);
    expect(out.envelope.project.id).toBe(project.id);
    expect(out.envelope.nodes).toHaveLength(Object.keys(nodes).length - 1);
    expect(out.envelope.edges).toHaveLength(Object.keys(edges).length);
  });

  test("carries the graph the .fountain export cannot", () => {
    const { project, nodes, edges } = maps();
    const out = parseEnvelope(envelopeToJson(buildEnvelope(project, nodes, edges)));
    if (!out.ok) throw new Error("parse failed");
    const kinds = new Set(out.envelope.nodes.map((n) => n.type));
    expect(kinds.has("character")).toBe(true);
    expect(kinds.has("location")).toBe(true);
    expect(kinds.has("theme")).toBe(true);
    const et = new Set(out.envelope.edges.map((e) => e.type));
    expect(et.has("appears_in")).toBe(true);
    expect(et.has("flashback_of")).toBe(true);
    // story time is structured, not a string
    const dated = out.envelope.nodes.find((n) => n.storyTime?.storyDay != null);
    expect(dated?.storyTime?.tod).toBeTruthy();
  });

  test("rejects junk instead of corrupting the graph", () => {
    expect(parseEnvelope("not json").ok).toBe(false);
    expect(parseEnvelope('{"nodes":[]}').ok).toBe(false);
    const bad = parseEnvelope(
      '{"schemaVersion":1,"project":{"id":"p","type":"scene","title":"x"},"nodes":[],"edges":[]}',
    );
    expect(bad.ok).toBe(false);
    const future = parseEnvelope(
      '{"schemaVersion":99,"project":{"id":"p","type":"project","title":"x"},"nodes":[],"edges":[]}',
    );
    expect(future.ok).toBe(false);
    if (!future.ok) expect(future.error).toContain("99");
  });

  test("drops dangling edges rather than importing connections to nowhere", () => {
    const env =
      '{"schemaVersion":1,"project":{"id":"p","type":"project","title":"P"},"nodes":[{"id":"a","type":"scene","title":"A"}],"edges":[{"id":"e1","type":"precedes","from":"a","to":"ghost"}]}';
    const out = parseEnvelope(env);
    if (!out.ok) throw new Error(out.error);
    expect(out.envelope.edges).toHaveLength(0);
  });
});

/* ---- research material (reference nodes) ---------------------------------- */

test("a reference survives a round trip with its link", () => {
  const project: GraphNode = { id: "p1", type: "project", title: "Neon Harvest" };
  const ref: GraphNode = {
    id: "r1",
    type: "reference",
    title: "Save the Cat",
    parentId: "p1",
    url: "https://example.com/beats",
    synopsis: "- [ ] Opening Image",
  };
  const env = buildEnvelope(project, { p1: project, r1: ref }, {});
  const back = parseEnvelope(envelopeToJson(env));
  expect(back.ok).toBe(true);
  if (!back.ok) return;
  const got = back.envelope.nodes.find((n) => n.id === "r1");
  expect(got?.type).toBe("reference");
  expect(got?.url).toBe("https://example.com/beats");
  expect(got?.parentId).toBe("p1");
});

test("attachment metadata travels but is never trusted blindly", () => {
  const project: GraphNode = { id: "p1", type: "project", title: "Neon Harvest" };
  const ref: GraphNode = {
    id: "r1",
    type: "reference",
    title: "Location photos",
    attachments: [{ id: "f1", name: "pier.jpg", mime: "image/jpeg", size: 40_000 }],
  };
  const env = buildEnvelope(project, { p1: project, r1: ref }, {});
  const back = parseEnvelope(envelopeToJson(env));
  expect(back.ok).toBe(true);
  if (!back.ok) return;
  expect(back.envelope.nodes.find((n) => n.id === "r1")?.attachments?.[0]?.name).toBe("pier.jpg");
});

test("malformed attachment entries are dropped, not imported", () => {
  const raw = JSON.stringify({
    schemaVersion: 1,
    project: { id: "p1", type: "project", title: "P" },
    nodes: [
      {
        id: "r1",
        type: "reference",
        title: "Mixed",
        attachments: [{ name: "no-id.pdf" }, "nonsense", { id: "f2", name: "ok.pdf" }],
      },
    ],
    edges: [],
  });
  const back = parseEnvelope(raw);
  expect(back.ok).toBe(true);
  if (!back.ok) return;
  const atts = back.envelope.nodes[0]?.attachments ?? [];
  expect(atts.length).toBe(1);
  expect(atts[0]?.id).toBe("f2");
  // Absent size/mime become defaults rather than undefined holes downstream.
  expect(atts[0]?.size).toBe(0);
});
