import { expect, test } from "bun:test";
import { projectDeletionIds, selectStories, summarizeStories } from "../src/data/library";
import type { GraphNode } from "../src/types";

const projects: GraphNode[] = [
  {
    id: "b",
    type: "project",
    title: "Blue Hour",
    author: "Mira",
    synopsis: "A train leaves at dawn.",
  },
  { id: "a", type: "project", title: "Afterlight" },
];

test("project deletion cascades ownership while preserving other stories and shared material", () => {
  const nodes: GraphNode[] = [
    ...projects,
    { id: "episode", type: "episode", title: "Episode", parentId: "a" },
    { id: "scene", type: "scene", title: "Scene", parentId: "episode" },
    { id: "character", type: "character", title: "Character", parentId: "a" },
    { id: "other", type: "scene", title: "Other", parentId: "b" },
    { id: "shared", type: "reference", title: "Shared research" },
  ];
  expect([...projectDeletionIds(nodes, "a")].sort()).toEqual([
    "a",
    "character",
    "episode",
    "scene",
  ]);
  expect(projectDeletionIds(nodes, "scene").size).toBe(0);
});

test("library search matches title, author and synopsis without changing stored order", () => {
  for (const query of [" BLUE ", "mira", "DAWN"]) {
    expect(selectStories(projects, query, "library", {}).map((p) => p.id)).toEqual(["b"]);
  }
  expect(selectStories(projects, "missing", "library", {})).toEqual([]);
  expect(selectStories(projects, "", "title", {}).map((p) => p.id)).toEqual(["a", "b"]);
  expect(projects.map((p) => p.id)).toEqual(["b", "a"]);
});

test("library counts isolate projects while including connected characters", () => {
  const nodes: GraphNode[] = [
    ...projects,
    { id: "s1", type: "scene", title: "Station", parentId: "b" },
    { id: "s2", type: "scene", title: "Home", parentId: "a" },
    { id: "c", type: "character", title: "Ada" },
  ];
  const stats = summarizeStories(projects, nodes, [
    { id: "e", type: "appears_in", from: "c", to: "s1" },
  ]);
  expect(stats.b).toEqual({ scenes: 1, characters: 1 });
  expect(stats.a).toEqual({ scenes: 1, characters: 0 });
  expect(
    selectStories(projects, "", "scenes", { a: { scenes: 3, characters: 0 } }).map((p) => p.id),
  ).toEqual(["a", "b"]);
});
