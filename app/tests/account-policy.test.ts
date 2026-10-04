import { describe, expect, it } from "bun:test";
import { accountSyncKey, parseAccounts, resolveAccount } from "../src/lib/account-policy";

const accounts = [
  { username: "writer1", email: "writer1@example.com", uid: "uid-one" },
  { username: "writer2", email: "writer2@example.com", uid: "uid-two" },
  { username: "writer3", email: "writer3@example.com", uid: "uid-three" },
];

describe("private account policy", () => {
  it("resolves usernames and emails without case sensitivity", () => {
    const group = parseAccounts(JSON.stringify(accounts));
    expect(group).toHaveLength(3);
    expect(resolveAccount(group, " WRITER1 ")?.uid).toBe("uid-one");
    expect(resolveAccount(group, "WRITER2@example.com")?.uid).toBe("uid-two");
    expect(resolveAccount(group, "stranger")).toBeUndefined();
  });
  it("rejects missing, invalid and excessive account configuration", () => {
    for (const raw of [
      undefined,
      "not-json",
      "[]",
      "{}",
      JSON.stringify([...accounts, ...accounts]),
    ]) {
      expect(parseAccounts(raw)).toEqual([]);
    }
    expect(parseAccounts(JSON.stringify([{ email: "writer1@example.com" }]))).toEqual([]);
  });
  it("rejects duplicate emails, usernames and user IDs", () => {
    for (const extra of [
      { username: "four", email: accounts[0]!.email, uid: "four" },
      { username: "writer1", email: "four@example.com", uid: "four" },
      { username: "four", email: "four@example.com", uid: "uid-one" },
    ])
      expect(parseAccounts(JSON.stringify([...accounts, extra]))).toEqual([]);
  });
  it("supports five individually provisioned accounts", () => {
    expect(
      parseAccounts(
        JSON.stringify(
          Array.from({ length: 5 }, (_, i) => ({
            username: `writer${i}`,
            email: `writer${i}@example.com`,
            uid: `uid-${i}`,
          })),
        ),
      ),
    ).toHaveLength(5);
  });
  it("uses distinct server-owned cloud namespaces", () => {
    expect(accountSyncKey("uid-one")).toBe("user:uid-one");
    expect(accountSyncKey("uid-one")).not.toBe(accountSyncKey("uid-two"));
  });
});
