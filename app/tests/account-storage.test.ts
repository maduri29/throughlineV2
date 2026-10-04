import { expect, it } from "bun:test";

it("isolates account databases, drafts and markers without changing the legacy namespace", () => {
  // Run in a fresh process: selecting an account is deliberately immutable.
  const result = Bun.spawnSync(
    [
      process.execPath,
      "-e",
      `
    import { expect } from "bun:test";
    import { accountStorageKey, setWorkspaceAccount, workspaceDatabaseName } from "./src/data/account";
    expect(workspaceDatabaseName()).toBe("throughline.v1");
    expect(accountStorageKey("draft")).toBe("draft");
    setWorkspaceAccount("alice");
    expect(workspaceDatabaseName()).toBe("throughline.v1.user.alice");
    expect(accountStorageKey("draft")).toBe("draft.user.alice");
    expect(accountStorageKey("throughline.last_synced_at")).toBe("throughline.last_synced_at.user.alice");
    expect(() => setWorkspaceAccount("bob")).toThrow("Reload before switching accounts.");
    expect(workspaceDatabaseName()).toBe("throughline.v1.user.alice");
  `,
    ],
    { cwd: new URL("..", import.meta.url).pathname.replace(/^\/(\w:)/, "$1") },
  );
  expect(result.exitCode).toBe(0);
});
