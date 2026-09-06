// Field guides are bundled static content: they must stay well-formed,
// unique, and honest about what the app's Fountain parser understands.
import { expect, test } from "bun:test";
import { GUIDES } from "../src/data/guides";

test("guide ids are unique and URL-safe", () => {
  const ids = GUIDES.map((g) => g.id);
  expect(new Set(ids).size).toBe(ids.length);
  for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
});

test("every guide has a name, blurb, and body", () => {
  expect(GUIDES.length).toBeGreaterThan(0);
  for (const g of GUIDES) {
    expect(g.name.trim().length).toBeGreaterThan(0);
    expect(g.blurb.trim().length).toBeGreaterThan(0);
    expect(g.body.trim().length).toBeGreaterThan(0);
  }
});

test("guide links are https URLs with labels", () => {
  for (const g of GUIDES) {
    for (const l of g.links ?? []) {
      expect(l.label.trim().length).toBeGreaterThan(0);
      expect(l.url.startsWith("https://")).toBe(true);
    }
  }
});

test("the Fountain guide only promises syntax the parser supports", () => {
  const fountain = GUIDES.find((g) => g.id === "fountain");
  expect(fountain).toBeDefined();
  // The preview escapes text raw: no bold/italic rendering exists, so the
  // guide must not teach it.
  expect(fountain!.body).not.toMatch(/\bbold\b/i);
  expect(fountain!.body).not.toMatch(/\bitalic\b/i);
});

test("saved-as-note bodies fit a reference synopsis", () => {
  // Bodies become note text verbatim; keep them glanceable, not chapters.
  for (const g of GUIDES) {
    expect(g.body.length).toBeLessThan(3000);
  }
});
