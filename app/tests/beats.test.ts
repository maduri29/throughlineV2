// Beat sheets have two representations, which is the classic way to lose data.
// These tests exist to make the text view provably non-destructive: round trips
// hold, and the structural things text cannot express survive an edit anyway.
import { expect, test } from "bun:test";
import { beatProgress, mergeBeats, parseBeats, serializeBeats, type Beat } from "../src/data/beats";

let n = 0;
const newId = (): string => `new${++n}`;

const sample: Beat[] = [
  { id: "a", name: "Opening Image", done: true, sceneId: "s1" },
  { id: "b", name: "Theme Stated", done: false, note: "who says it, and to whom" },
  { id: "c", name: "Catalyst", done: false },
];

test("serialize then parse gives back what went in", () => {
  const back = parseBeats(serializeBeats(sample));
  expect(back).toEqual([
    { name: "Opening Image", done: true },
    { name: "Theme Stated", done: false, note: "who says it, and to whom" },
    { name: "Catalyst", done: false },
  ]);
});

test("text is stable under a second round trip", () => {
  const once = serializeBeats(sample);
  const twice = serializeBeats(mergeBeats(sample, parseBeats(once), newId));
  expect(twice).toBe(once);
});

test("a scene link never lands on a different beat", () => {
  // Position matching would give Catalyst the link that belonged to Opening
  // Image, silently attaching a beat to an unrelated scene.
  const merged = mergeBeats(sample, parseBeats("- [ ] Catalyst"), newId);
  expect(merged.length).toBe(1);
  expect(merged[0]?.name).toBe("Catalyst");
  expect(merged[0]?.sceneId).toBeUndefined();
});

test("reordering rows keeps each link with its own beat", () => {
  const reordered = ["- [ ] Catalyst", "- [x] Opening Image"].join("\n");
  const merged = mergeBeats(sample, parseBeats(reordered), newId);
  expect(merged[0]?.sceneId).toBeUndefined();
  expect(merged[1]?.sceneId).toBe("s1");
  expect(merged[1]?.id).toBe("a");
});

test("a scene link survives a text edit that does not touch its row", () => {
  const edited = serializeBeats(sample).replace("Theme Stated", "Theme Stated Clearly");
  const merged = mergeBeats(sample, parseBeats(edited), newId);
  expect(merged[0]?.sceneId).toBe("s1");
  expect(merged[1]?.name).toBe("Theme Stated Clearly");
  expect(merged[0]?.id).toBe("a");
});

test("renaming a beat drops its link rather than guessing", () => {
  const merged = mergeBeats(sample, parseBeats("- [x] Opening Shot"), newId);
  expect(merged[0]?.sceneId).toBeUndefined();
});

test("added rows get fresh ids rather than inheriting one", () => {
  const text = `${serializeBeats(sample)}\n- [ ] Finale`;
  const merged = mergeBeats(sample, parseBeats(text), newId);
  expect(merged.length).toBe(4);
  expect(merged[3]?.id.startsWith("new")).toBe(true);
});

test("multi-line notes survive the round trip", () => {
  const beats: Beat[] = [{ id: "a", name: "Midpoint", done: false, note: "first\nsecond" }];
  expect(parseBeats(serializeBeats(beats))[0]?.note).toBe("first\nsecond");
});

test("both checkbox spellings are read, and written back canonically", () => {
  const parsed = parseBeats("- [X] Loud\n- [x] Quiet\n- [ ] Off");
  expect(parsed.map((b) => b.done)).toEqual([true, true, false]);
  expect(serializeBeats(mergeBeats([], parsed, newId))).toBe("- [x] Loud\n- [x] Quiet\n- [ ] Off");
});

test("text before the first beat is dropped, not turned into a nameless beat", () => {
  expect(parseBeats("stray preamble\n- [ ] Real").map((b) => b.name)).toEqual(["Real"]);
});

test("progress counts what is done", () => {
  expect(beatProgress(sample)).toEqual({ done: 1, total: 3 });
  expect(beatProgress([])).toEqual({ done: 0, total: 0 });
});
