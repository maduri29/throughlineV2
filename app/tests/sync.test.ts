import { describe, expect, it, beforeEach, afterAll } from "bun:test";
import { getSyncKey, setSyncKey, getLastSyncedAt, executeSync } from "../src/data/sync";

class LocalStorageMock {
  private store: Record<string, string> = {};
  getItem(key: string): string | null {
    return this.store[key] ?? null;
  }
  setItem(key: string, value: string): void {
    this.store[key] = value;
  }
  removeItem(key: string): void {
    delete this.store[key];
  }
  clear(): void {
    this.store = {};
  }
}

const mockStorage = new LocalStorageMock();

// Attach mock storage & window
// @ts-expect-error test mock
globalThis.localStorage = mockStorage;
// @ts-expect-error test mock
globalThis.window = globalThis;

describe("sync data helpers", () => {
  beforeEach(() => {
    mockStorage.clear();
  });

  afterAll(() => {
    // @ts-expect-error test cleanup
    delete globalThis.window;
  });

  it("handles syncKey getter and setter correctly", () => {
    expect(getSyncKey()).toBe("");

    setSyncKey("my-test-key");
    expect(getSyncKey()).toBe("my-test-key");

    // Setting empty string clears sync key and last synced timestamp
    mockStorage.setItem("throughline.last_synced_at", "123456");
    setSyncKey("   ");
    expect(getSyncKey()).toBe("");
    expect(getLastSyncedAt()).toBeNull();
  });

  it("retrieves last synced timestamp when present and valid", () => {
    expect(getLastSyncedAt()).toBeNull();

    mockStorage.setItem("throughline.last_synced_at", "1700000000000");
    expect(getLastSyncedAt()).toBe(1700000000000);

    mockStorage.setItem("throughline.last_synced_at", "invalid-number");
    expect(getLastSyncedAt()).toBeNull();
  });

  it("executeSync aborts gracefully when syncKey is not set", async () => {
    const res = await executeSync();
    expect(res.ok).toBe(false);
    expect(res.message).toContain("Set a Sync Key");
    expect(res.pulledNodes).toHaveLength(0);
    expect(res.pulledEdges).toHaveLength(0);
  });
});
