/** Route integration assertions with synthetic identities and an in-memory SQL database. */
import { mock } from "bun:test";
import { createClient } from "@libsql/client";

const sql = createClient({ url: "file::memory:" });
const realTurso = await import("./src/lib/turso");
mock.module("./src/lib/turso", () => ({
  getTursoClient: () => sql,
  isTursoConfigured: () => true,
  ensureTursoSchema: realTurso.ensureTursoSchema,
}));
// Firebase signature verification is mocked only in this standalone test process.
// No production endpoint or real user's data is used.
mock.module("firebase-admin/auth", () => ({
  getAuth: () => ({
    verifyIdToken: async (token: string) => {
      if (token === "alice") return { uid: "alice", email: "alice@example.com" };
      if (token === "bob") return { uid: "bob", email: "bob@example.com" };
      if (token === "imposter") return { uid: "different-uid", email: "alice@example.com" };
      if (token === "outsider") return { uid: "outsider", email: "outsider@example.com" };
      if (token.startsWith("new-")) return { uid: token, email: `${token}@example.com` };
      throw new Error("Invalid token");
    },
  }),
}));
process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "test-client-key";
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "test-project";
process.env.THROUGHLINE_ACCOUNTS = JSON.stringify([
  { username: "alice", uid: "alice", email: "alice@example.com" },
  { username: "bob", uid: "bob", email: "bob@example.com" },
]);
const graph = await import("./src/app/api/sync/route");
const ideas = await import("./src/app/api/boneyard-sync/route");
const login = await import("./src/app/api/auth/login/route");
const access = await import("./src/app/api/auth/access/route");
const invitations = await import("./src/app/api/auth/invitations/route");
const registration = await import("./src/app/api/auth/register/route");
process.env.THROUGHLINE_INVITE_CODE = "fixture-invitation-code";
let count = 0;
function check(name: string, result: boolean) {
  if (!result) throw new Error(`FAIL ${name}`);
  count++;
  console.log(`PASS ${name}`);
}
function request(token?: string, body?: unknown) {
  return new Request("http://localhost/api/sync", {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "Content-Type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
try {
  check("anonymous invitation access denied", (await invitations.GET(request())).status === 401);
  const nonOwner = await invitations.GET(request("bob"));
  const nonOwnerData = await nonOwner.json();
  check(
    "non-owner cannot see invitation secret",
    nonOwner.status === 200 && nonOwnerData.owner === false && !("code" in nonOwnerData),
  );
  check(
    "unregistered invitation access denied",
    (await invitations.GET(request("outsider"))).status === 403,
  );
  const ownerInvites = await invitations.GET(request("alice"));
  const inviteData = await ownerInvites.json();
  check(
    "owner can view code and remaining seats",
    ownerInvites.status === 200 &&
      inviteData.code === process.env.THROUGHLINE_INVITE_CODE &&
      inviteData.remaining === 3 &&
      inviteData.limit === 5,
  );
  check(
    "invitation secret response cannot be cached",
    ownerInvites.headers.get("Cache-Control") === "no-store",
  );
  check("anonymous graph read denied", (await graph.GET(request())).status === 401);
  check("anonymous graph write denied", (await graph.POST(request(undefined, {}))).status === 401);
  check(
    "anonymous Boneyard write denied",
    (await ideas.POST(request(undefined, {}))).status === 401,
  );
  check("forged identity denied", (await access.GET(request("forged"))).status === 401);
  check("uninvited identity denied", (await access.GET(request("outsider"))).status === 403);
  check(
    "same email with a different UID denied",
    (await access.GET(request("imposter"))).status === 403,
  );
  const alias = await login.POST(request(undefined, { login: " ALICE " }));
  check(
    "username resolves to provisioned email",
    alias.ok && (await alias.json()).email === "alice@example.com",
  );
  check(
    "unknown username denied",
    (await login.POST(request(undefined, { login: "stranger" }))).status === 403,
  );

  for (const token of ["alice", "bob"]) {
    const result = await graph.POST(
      request(token, {
        // Try to choose somebody else's namespace. The server must ignore this.
        syncKey: token === "alice" ? "user:bob" : "user:alice",
        pushNodes: [{ id: "same-node-id", type: "project", title: `${token}'s story` }],
        pushEdges: [
          { id: "same-edge-id", type: "relationship", from: "one", to: "two", label: token },
        ],
      }),
    );
    check(`${token} can save private graph`, result.ok);
  }
  for (const token of ["alice", "bob"]) {
    const result = await graph.POST(
      request(token, { syncKey: "user:someone-else", lastSyncedAt: 0 }),
    );
    const body = await result.json();
    check(
      `${token} receives only their own story with a colliding ID`,
      body.pulledNodes.length === 1 && body.pulledNodes[0].title === `${token}'s story`,
    );
    check(
      `${token} receives only their own edge with a colliding ID`,
      body.pulledEdges.length === 1 && body.pulledEdges[0].label === token,
    );
    const revision = {
      id: "same-revision-id",
      entityId: "same-idea-id",
      kind: "idea",
      parents: [],
      at: 123,
      value: {
        id: "same-idea-id",
        title: token,
        body: "Private idea",
        original: "Private idea",
        tags: [],
        pinned: false,
        disposition: "active",
        createdAt: 123,
        updatedAt: 123,
      },
    };
    const write = await ideas.POST(
      request(token, { syncKey: "user:someone-else", revisions: [revision] }),
    );
    check(`${token} can save a private Boneyard revision`, write.ok);
  }
  for (const token of ["alice", "bob"]) {
    const response = await ideas.POST(
      request(token, { syncKey: "user:someone-else", revisions: [] }),
    );
    const body = await response.json();
    check(
      `${token} receives only their own Boneyard`,
      body.revisions.length === 1 && body.revisions[0].value.title === token,
    );
  }
  const snapshot = await (await graph.POST(request("alice", { protocol: 2, changes: [] }))).json();
  const original = snapshot.records.find(
    (r: { kind: string; id: string }) => r.kind === "nodes" && r.id === "same-node-id",
  );
  const update = {
    kind: "nodes",
    id: original.id,
    data: { ...original.data, title: "Newer cloud edit" },
    baseVersion: original.version,
  };
  const freshWrite = await graph.POST(request("alice", { protocol: 2, changes: [update] }));
  check("version-aware edit succeeds from its original cloud version", freshWrite.ok);
  const updated = (await freshWrite.json()).records.find(
    (r: { kind: string }) => r.kind === "nodes",
  );
  const staleWrite = await graph.POST(
    request("alice", {
      protocol: 2,
      changes: [{ ...update, data: { ...original.data, title: "Stale device edit" } }],
    }),
  );
  const conflict = await staleWrite.json();
  check(
    "stale device cannot overwrite newer cloud writing",
    staleWrite.status === 409 &&
      conflict.conflicts[0].data.title === "Newer cloud edit" &&
      conflict.conflicts[0].local.title === "Stale device edit",
  );
  check(
    "unchanged retry is idempotent",
    (await graph.POST(request("alice", { protocol: 2, changes: [update] }))).ok,
  );
  const invalid = await graph.POST(
    request("alice", { protocol: 2, changes: [{ ...update, kind: "injected_table" }] }),
  );
  check("sync rejects malformed record kinds", invalid.status === 400);
  const deleteResponse = await graph.POST(
    request("alice", {
      protocol: 2,
      changes: [{ kind: "nodes", id: original.id, data: null, baseVersion: updated.version }],
    }),
  );
  const tombstone = (await deleteResponse.json()).records.find(
    (r: { kind: string }) => r.kind === "nodes",
  );
  check("deletion is retained as a cloud tombstone", deleteResponse.ok && tombstone.data === null);
  check(
    "older device cannot resurrect a deleted story",
    (await graph.POST(request("alice", { protocol: 2, changes: [update] }))).status === 409,
  );
  const bobSnapshot = await (await graph.POST(request("bob", { protocol: 2, changes: [] }))).json();
  check(
    "other user's colliding story remains intact after deletion",
    bobSnapshot.records.find((r: { kind: string }) => r.kind === "nodes").data.title ===
      "bob's story",
  );
  const restore = await graph.POST(
    request("alice", { protocol: 2, changes: [{ ...update, baseVersion: tombstone.version }] }),
  );
  check("explicit conflict resolution can restore a story with the latest version", restore.ok);
  const beforeAtomic = (await restore.json()).records.find(
    (r: { kind: string }) => r.kind === "nodes",
  );
  const atomicConflict = await graph.POST(
    request("alice", {
      protocol: 2,
      changes: [
        { ...update, baseVersion: 0, data: { ...original.data, title: "Conflict" } },
        {
          kind: "nodes",
          id: "must-not-save",
          data: { id: "must-not-save", type: "project", title: "Uncommitted" },
          baseVersion: 0,
        },
      ],
    }),
  );
  const afterAtomic = await (
    await graph.POST(request("alice", { protocol: 2, changes: [] }))
  ).json();
  check(
    "conflicting graph upload rolls back its whole transaction",
    atomicConflict.status === 409 &&
      !afterAtomic.records.some((r: { id: string }) => r.id === "must-not-save") &&
      afterAtomic.records.find((r: { kind: string }) => r.kind === "nodes").version ===
        beforeAtomic.version,
  );

  check(
    "registration rejects a wrong invitation code",
    (await registration.POST(request("outsider", { username: "new-user", inviteCode: "wrong" })))
      .status === 403,
  );
  check(
    "registration rejects forged Firebase identity",
    (
      await registration.POST(
        request("forged", {
          username: "new-user",
          inviteCode: process.env.THROUGHLINE_INVITE_CODE,
        }),
      )
    ).status === 401,
  );
  for (const token of ["outsider", "new-four", "new-five"]) {
    const created = await registration.POST(
      request(token, { username: token, inviteCode: process.env.THROUGHLINE_INVITE_CODE }),
    );
    check(`${token} can create their own account`, created.status === 201);
    check(`${token} can access their own private workspace`, (await access.GET(request(token))).ok);
  }
  check(
    "sixth account is rejected by server",
    (
      await registration.POST(
        request("new-six", {
          username: "new-six",
          inviteCode: process.env.THROUGHLINE_INVITE_CODE,
        }),
      )
    ).status === 409,
  );
  check(
    "duplicate account is rejected",
    (
      await registration.POST(
        request("outsider", {
          username: "outsider",
          inviteCode: process.env.THROUGHLINE_INVITE_CODE,
        }),
      )
    ).status === 409,
  );
  check(
    "registered username can be used for login",
    (await (await login.POST(request(undefined, { login: "new-four" }))).json()).email ===
      "new-four@example.com",
  );
  const concurrentSql = createClient({ url: "file::memory:" });
  try {
    const { AccountRegistry } = await import("./src/lib/account-registry");
    const registry = new AccountRegistry(concurrentSql);
    for (let i = 0; i < 4; i++)
      await registry.register({
        uid: "seed-" + i,
        email: "seed-" + i + "@example.com",
        username: "seed-" + i,
      });
    const attempts = await Promise.allSettled([
      registry.register({ uid: "race-one", email: "race-one@example.com", username: "race-one" }),
      registry.register({ uid: "race-two", email: "race-two@example.com", username: "race-two" }),
    ]);
    check(
      "concurrent signups cannot exceed five accounts",
      (await registry.count()) === 5 &&
        attempts.filter((item) => item.status === "fulfilled").length === 1,
    );
  } finally {
    concurrentSql.close();
  }
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "";
  check("missing account setup fails closed", (await graph.GET(request("alice"))).status === 503);
  console.log(
    `${count}/${count} account API assertions passed (Firebase verification mocked; SQL real).`,
  );
} finally {
  sql.close();
}
