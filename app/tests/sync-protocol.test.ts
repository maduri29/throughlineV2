import { describe, expect, it } from "bun:test";
import { changedRecords, sameContent, type CloudRecord } from "../src/data/sync-protocol";
import type { GraphNode } from "../src/types";

describe("version-aware sync", () => {
  const node: GraphNode = { id: "story", type: "project", title: "Original" };
  const baseline: CloudRecord[] = [{ kind: "nodes", id: node.id, data: node, version: 4 }];
  it("uploads only changed records and uses the last observed cloud version", () => {
    expect(changedRecords([node], [], baseline)).toEqual([]);
    expect(changedRecords([{ ...node, title: "Edited" }], [], baseline)[0]?.baseVersion).toBe(4);
  });
  it("tracks local deletion while never deleting an unknown remote record", () => {
    expect(changedRecords([], [], baseline)).toEqual([
      { kind: "nodes", id: "story", data: null, baseVersion: 4 },
    ]);
    expect(changedRecords([], [], [])).toEqual([]);
  });
  it("does not upload deleted records again unless explicitly restored", () => {
    const tombstone: CloudRecord[] = [{ ...baseline[0]!, data: null, version: 5 }];
    expect(changedRecords([], [], tombstone)).toEqual([]);
    expect(changedRecords([node], [], tombstone)[0]?.baseVersion).toBe(5);
  });
  it("compares content independently of JSON property order", () => {
    expect(
      sameContent({ id: "a", value: { x: 1, y: 2 } }, { value: { y: 2, x: 1 }, id: "a" }),
    ).toBe(true);
  });
});

it("includes character dossier fields in a cloud change payload", () => {
  const character: GraphNode = {
    id: "char",
    type: "character",
    title: "Ada",
    age: "late 30s",
    traits: "Skeptic",
    appearance: "Worn linen",
    backstory: "Left home",
    motivation: "Return home",
    conflict: "Distrust",
    relationships: "Trusts Ben",
  };
  expect(changedRecords([character], [], [])[0]?.data).toEqual(character);
});
