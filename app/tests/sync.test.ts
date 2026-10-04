import { describe, expect, it, beforeEach, afterAll } from "bun:test";
import {
  getSyncKey,
  setSyncKey,
  getLastSyncedAt,
  executeSync,
  getSyncConflicts,
  resolveSyncConflicts,
} from "../src/data/sync";
import { MemorySyncStorageAdapter } from "../src/data/syncStorage";
import type { GraphNode } from "../src/types";
import type { CloudConflict } from "../src/data/sync-protocol";

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

describe("sync conflict resolution (MemorySyncStorageAdapter seam)", () => {
  it("retrieves recorded conflicts and attaches current local state", async () => {
    const localNode: GraphNode = {
      id: "node-1",
      type: "scene",
      title: "Local Title",
    };
    const cloudConflict: CloudConflict = {
      kind: "nodes",
      id: "node-1",
      version: 2,
      data: {
        id: "node-1",
        type: "scene",
        title: "Cloud Title",
      },
    };

    const storage = new MemorySyncStorageAdapter({
      nodes: [localNode],
      conflicts: [cloudConflict],
    });

    const conflicts = await getSyncConflicts(storage);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]!.id).toBe("node-1");
    expect((conflicts[0]!.local as GraphNode).title).toBe("Local Title");
    expect((conflicts[0]!.data as GraphNode).title).toBe("Cloud Title");
  });

  it("resolves conflicts favoring local state without mutating local nodes", async () => {
    const localNode: GraphNode = {
      id: "node-1",
      type: "scene",
      title: "Local Kept Title",
    };
    const cloudConflict: CloudConflict = {
      kind: "nodes",
      id: "node-1",
      version: 5,
      data: {
        id: "node-1",
        type: "scene",
        title: "Cloud Discarded Title",
      },
    };

    const storage = new MemorySyncStorageAdapter({
      nodes: [localNode],
      conflicts: [cloudConflict],
    });

    await resolveSyncConflicts("local", storage);

    // Local nodes untouched
    const nodes = await storage.getNodes();
    expect(nodes).toHaveLength(1);
    expect(nodes[0]!.title).toBe("Local Kept Title");

    // Conflicts cleared
    const remainingConflicts = await storage.getConflicts();
    expect(remainingConflicts).toHaveLength(0);

    // Baseline updated with the cloud version
    const baseline = await storage.getBaseline();
    expect(baseline).toHaveLength(1);
    expect(baseline[0]!.version).toBe(5);
  });

  it("resolves conflicts favoring cloud state by updating local nodes and clearing conflicts", async () => {
    const localNode: GraphNode = {
      id: "node-2",
      type: "scene",
      title: "Old Local Title",
    };
    const cloudConflict: CloudConflict = {
      kind: "nodes",
      id: "node-2",
      version: 3,
      data: {
        id: "node-2",
        type: "scene",
        title: "Accepted Cloud Title",
      },
    };

    const storage = new MemorySyncStorageAdapter({
      nodes: [localNode],
      conflicts: [cloudConflict],
    });

    await resolveSyncConflicts("cloud", storage);

    // Local node overwritten with cloud data
    const nodes = await storage.getNodes();
    expect(nodes).toHaveLength(1);
    expect(nodes[0]!.title).toBe("Accepted Cloud Title");

    // Conflicts cleared
    const remainingConflicts = await storage.getConflicts();
    expect(remainingConflicts).toHaveLength(0);
  });
});
