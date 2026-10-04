import { describe, expect, it } from "bun:test";
import { posterHue, posterMonogram } from "../src/views/characters/posterImage";

describe("posterImage helpers", () => {
  it("generates deterministic hues within valid range [0, 359]", () => {
    const id1 = "character-uuid-1";
    const id2 = "character-uuid-2";

    const hue1 = posterHue(id1);
    const hue2 = posterHue(id2);

    expect(hue1).toBeGreaterThanOrEqual(0);
    expect(hue1).toBeLessThan(360);
    expect(hue2).toBeGreaterThanOrEqual(0);
    expect(hue2).toBeLessThan(360);

    // Deterministic
    expect(posterHue(id1)).toBe(hue1);
  });

  it("extracts 2-letter monograms from names and degrades gracefully", () => {
    expect(posterMonogram("Walter White")).toBe("WW");
    expect(posterMonogram("Sherlock")).toBe("S");
    expect(posterMonogram("Jean-Luc Picard")).toBe("JP");
    expect(posterMonogram("   ")).toBe("?");
    expect(posterMonogram("")).toBe("?");
  });
});
