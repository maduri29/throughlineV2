import { describe, expect, it } from "bun:test";
import { uuidv7 } from "../src/data/uuid";

describe("uuidv7", () => {
  it("generates valid 36-character hyphenated UUIDv7 strings", () => {
    const id = uuidv7();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("generates unique IDs across consecutive invocations", () => {
    const count = 1000;
    const ids = new Set<string>();
    for (let i = 0; i < count; i++) {
      ids.add(uuidv7());
    }
    expect(ids.size).toBe(count);
  });

  it("generates IDs that are lexicographically ordered over time", async () => {
    const id1 = uuidv7();
    await new Promise((r) => setTimeout(r, 5));
    const id2 = uuidv7();
    expect(id1 < id2).toBe(true);
  });
});
