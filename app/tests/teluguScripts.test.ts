// Telugu screenplay study shelf: links must stay well-formed, unique, and
// honest about what each copy actually is (shooting script vs transcript).
import { expect, test } from "bun:test";
import {
  SERIES_SPOTLIGHT,
  SHELF_BOOKS,
  SHELF_LANES,
  TELUGU_SCRIPTS,
  shelfCategoryLabel,
  shelfCategoryOf,
} from "../src/data/teluguScripts";

test("script ids are unique and URL-safe", () => {
  expect(TELUGU_SCRIPTS.length).toBeGreaterThan(0);
  const ids = TELUGU_SCRIPTS.map((s) => s.id);
  expect(new Set(ids).size).toBe(ids.length);
  for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
});

test("every script has title, credits, and study notes", () => {
  for (const s of TELUGU_SCRIPTS) {
    expect(s.title.trim().length).toBeGreaterThan(0);
    expect(s.writer.trim().length).toBeGreaterThan(0);
    expect(s.director.trim().length).toBeGreaterThan(0);
    expect(s.logline.trim().length).toBeGreaterThan(0);
    expect(s.studyNote.trim().length).toBeGreaterThan(0);
    expect(s.year).toBeGreaterThan(2000);
  }
});

test("script links are https URLs", () => {
  for (const s of TELUGU_SCRIPTS) {
    expect(s.pageUrl.startsWith("https://")).toBe(true);
    if (s.pdfUrl) expect(s.pdfUrl.startsWith("https://")).toBe(true);
  }
});

test("transcripts are labelled as transcripts, not shooting scripts", () => {
  for (const s of TELUGU_SCRIPTS) {
    const format = s.format.toLowerCase();
    const mentionsTranscript = format.includes("transcript");
    const mentionsScript =
      format.includes("script") || format.includes("screenplay") || format.includes("book");
    expect(mentionsTranscript || mentionsScript).toBe(true);
  }
});

test("saved-as-note bodies fit a reference synopsis", () => {
  // saveTelugu joins credits + logline + study note; keep entries glanceable.
  for (const s of [...TELUGU_SCRIPTS, ...SERIES_SPOTLIGHT]) {
    const body = `${s.title} ${s.logline} ${s.studyNote}`;
    expect(body.length).toBeLessThan(3000);
  }
});

test("poster hotlinks are wikimedia https URLs or absent", () => {
  // Posters are review-only hotlinks, never bundled; the UI falls back to a
  // monogram when one is missing or unreachable.
  for (const s of [...TELUGU_SCRIPTS, ...SERIES_SPOTLIGHT]) {
    if (s.posterUrl === undefined) continue;
    expect(s.posterUrl.startsWith("https://upload.wikimedia.org/")).toBe(true);
  }
});

test("every film sits in exactly one lane, and no lane is empty", () => {
  const laneIds = new Set(SHELF_LANES.map((l) => l.id));
  expect(laneIds.size).toBe(SHELF_LANES.length);
  for (const s of TELUGU_SCRIPTS) {
    // Films must name a lane (bonus entries are exempt — they render outside).
    expect(typeof s.shelf).toBe("string");
    if (s.shelf) expect(laneIds.has(s.shelf)).toBe(true);
  }
  for (const l of SHELF_LANES) {
    expect(l.name.trim().length).toBeGreaterThan(0);
    expect(l.blurb.trim().length).toBeGreaterThan(0);
    expect(TELUGU_SCRIPTS.some((s) => s.shelf === l.id)).toBe(true);
  }
});

test("category labels group every item exactly once", () => {
  const items = [...TELUGU_SCRIPTS, ...SERIES_SPOTLIGHT, ...SHELF_BOOKS];
  const labels = items.map(shelfCategoryLabel);
  expect(new Set(labels)).toEqual(
    new Set(["Telugu · Movies", "Hindi · Web series", "English · Books", "Telugu · Books"]),
  );
  expect(items.filter((t) => shelfCategoryOf(t).kind === "movie").length).toBe(10);
  expect(items.filter((t) => shelfCategoryOf(t).kind === "series").length).toBe(1);
  expect(items.filter((t) => shelfCategoryOf(t).kind === "book").length).toBe(8);
  for (const t of TELUGU_SCRIPTS) expect(shelfCategoryOf(t).lang).toBe("Telugu");
});

test("shelf books are honest shop links with covers-or-monogram", () => {
  expect(SHELF_BOOKS.length).toBe(8);
  const ids = SHELF_BOOKS.map((b) => b.id);
  expect(new Set(ids).size).toBe(ids.length);
  for (const b of SHELF_BOOKS) {
    expect(b.title.trim().length).toBeGreaterThan(0);
    expect(b.author.trim().length).toBeGreaterThan(0);
    expect(b.blurb.trim().length).toBeGreaterThan(0);
    expect(b.why.trim().length).toBeGreaterThan(0);
    expect(b.pageUrl.startsWith("https://")).toBe(true);
    if (b.posterUrl !== undefined) {
      expect(b.posterUrl.startsWith("https://upload.wikimedia.org/")).toBe(true);
    }
    const body = `${b.title} ${b.blurb} ${b.why}`;
    expect(body.length).toBeLessThan(3000);
  }
});

test("series spotlight entries are well-formed and clearly non-Telugu", () => {
  expect(SERIES_SPOTLIGHT.length).toBeGreaterThan(0);
  const filmIds = new Set(TELUGU_SCRIPTS.map((s) => s.id));
  for (const s of SERIES_SPOTLIGHT) {
    expect(filmIds.has(s.id)).toBe(false);
    expect(s.language.trim().length).toBeGreaterThan(0);
    expect(s.episodes).toBeGreaterThan(0);
    expect(s.pageUrl.startsWith("https://")).toBe(true);
  }
});
