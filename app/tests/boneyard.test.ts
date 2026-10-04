import { describe, expect, test } from "bun:test";
import { ideaLabel } from "../src/data/boneyard/repository";
import { materialize, revisionHeads } from "../src/data/boneyard/model";
import { parseRevisions, validateHistory } from "../src/data/boneyard/validation";
import type { Idea, Revision, Thought } from "../src/data/boneyard/types";

describe("boneyard domain model & utilities", () => {
  test("ideaLabel extracts title, first body line, or fallback cleanly", () => {
    const withTitle: Idea = {
      id: "i1",
      title: "The Silent Watcher",
      body: "A lighthouse keeper discovers a submerged bell.",
      original: "...",
      tags: [],
      pinned: false,
      disposition: "active",
      createdAt: 1000,
      updatedAt: 1000,
    };
    expect(ideaLabel(withTitle)).toBe("The Silent Watcher");

    const noTitle: Idea = {
      id: "i2",
      title: "   ",
      body: "\n\nFirst line of thought.\nSecond line.",
      original: "...",
      tags: [],
      pinned: false,
      disposition: "active",
      createdAt: 1000,
      updatedAt: 1000,
    };
    expect(ideaLabel(noTitle)).toBe("First line of thought.");

    const blank: Idea = {
      id: "i3",
      title: "",
      body: "\n\n  \n",
      original: "",
      tags: [],
      pinned: false,
      disposition: "active",
      createdAt: 1000,
      updatedAt: 1000,
    };
    expect(ideaLabel(blank)).toBe("Untitled idea");
  });

  test("revisionHeads resolves linear and branched DAG versions", () => {
    const rev1: Revision = {
      id: "r1",
      entityId: "e1",
      kind: "idea",
      parents: [],
      at: 100,
      value: { id: "e1" } as any,
    };
    const rev2: Revision = {
      id: "r2",
      entityId: "e1",
      kind: "idea",
      parents: ["r1"],
      at: 200,
      value: { id: "e1" } as any,
    };

    // Linear chain: only r2 is head
    const linearHeads = revisionHeads([rev1, rev2], "e1");
    expect(linearHeads.map((r) => r.id)).toEqual(["r2"]);

    // Branching fork from r1: r2 and r3 are both heads
    const rev3: Revision = {
      id: "r3",
      entityId: "e1",
      kind: "idea",
      parents: ["r1"],
      at: 250,
      value: { id: "e1" } as any,
    };
    const branchHeads = revisionHeads([rev1, rev2, rev3], "e1");
    expect(branchHeads.map((r) => r.id)).toEqual(["r2", "r3"]);
  });

  test("materialize builds full snapshot and sorts ideas by pinned & activity", () => {
    const idea1: Idea = {
      id: "i1",
      title: "Normal Idea",
      body: "Body 1",
      original: "Body 1",
      tags: ["sci-fi"],
      pinned: false,
      disposition: "active",
      createdAt: 1000,
      updatedAt: 1000,
    };
    const idea2: Idea = {
      id: "i2",
      title: "Pinned Idea",
      body: "Body 2",
      original: "Body 2",
      tags: [],
      pinned: true,
      disposition: "active",
      createdAt: 500,
      updatedAt: 500,
    };
    const thought1: Thought = {
      id: "t1",
      ideaId: "i1",
      body: "Followup thought with newer timestamp",
      createdAt: 2000,
      updatedAt: 2500,
      deleted: false,
    };

    const revisions: Revision[] = [
      { id: "r-i1", entityId: "i1", kind: "idea", parents: [], at: 1000, value: idea1 },
      { id: "r-i2", entityId: "i2", kind: "idea", parents: [], at: 500, value: idea2 },
      { id: "r-t1", entityId: "t1", kind: "thought", parents: [], at: 2000, value: thought1 },
    ];

    const snapshot = materialize(revisions);
    expect(snapshot.ideas.length).toBe(2);
    expect(snapshot.thoughts.length).toBe(1);
    expect(snapshot.conflicts.length).toBe(0);

    // Pinned idea comes first even though idea1 had a thought with higher updatedAt
    expect(snapshot.ideas[0]?.id).toBe("i2");
    expect(snapshot.ideas[1]?.id).toBe("i1");
  });

  test("materialize detects concurrent branch conflicts", () => {
    const v1: Revision = {
      id: "r1",
      entityId: "i1",
      kind: "idea",
      parents: [],
      at: 100,
      value: { id: "i1", title: "Version A" } as any,
    };
    const v2: Revision = {
      id: "r2",
      entityId: "i1",
      kind: "idea",
      parents: [],
      at: 150,
      value: { id: "i1", title: "Version B" } as any,
    };

    const snapshot = materialize([v1, v2]);
    expect(snapshot.conflicts.length).toBe(1);
    expect(snapshot.conflicts[0]?.entityId).toBe("i1");
    expect(snapshot.conflicts[0]?.versions.length).toBe(2);
  });

  test("parseRevisions and validateHistory enforce schema and acyclic invariants", () => {
    const validRev: Revision = {
      id: "r1",
      entityId: "i1",
      kind: "idea",
      parents: [],
      at: 100,
      value: {
        id: "i1",
        title: "Test",
        body: "Test body",
        original: "Test body",
        tags: [],
        pinned: false,
        disposition: "active",
        createdAt: 100,
        updatedAt: 100,
      },
    };

    expect(() => parseRevisions([validRev])).not.toThrow();
    expect(() => validateHistory([validRev])).not.toThrow();

    // Rejection: revision cannot be its own parent
    const selfParentRev: Revision = {
      ...validRev,
      id: "r2",
      parents: ["r2"],
    };
    expect(() => parseRevisions([selfParentRev])).toThrow();

    // Rejection: cycle in history DAG
    const cycleA: Revision = { ...validRev, id: "rA", parents: ["rB"] };
    const cycleB: Revision = { ...validRev, id: "rB", parents: ["rA"] };
    expect(() => validateHistory([cycleA, cycleB])).toThrow();
  });
});
