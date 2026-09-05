import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { unlink } from "node:fs/promises";
import { materialize } from "./src/data/boneyard/model";
const database = join(tmpdir(), `throughline-boneyard-check-${crypto.randomUUID()}.db`);
process.env.TURSO_DATABASE_URL = pathToFileURL(database).href;
process.env.TURSO_AUTH_TOKEN = "local-test-only";
const { POST } = await import("./src/app/api/boneyard-sync/route");
const { getTursoClient } = await import("./src/lib/turso");
const value = {
  id: "idea-check",
  title: "",
  body: "A lighthouse",
  original: "A lighthouse",
  tags: [],
  pinned: false,
  disposition: "active",
  createdAt: 1,
  updatedAt: 1,
};
const root = { id: "root", entityId: value.id, kind: "idea", parents: [], at: 1, value };
const left = {
  ...root,
  id: "left",
  parents: ["root"],
  at: 2,
  value: { ...value, body: "Version from device A", updatedAt: 2 },
};
const right = {
  ...root,
  id: "right",
  parents: ["root"],
  at: 3,
  value: { ...value, body: "Version from device B", updatedAt: 3 },
};
async function send(syncKey: string, revisions: unknown[]) {
  return POST(
    new Request("http://localhost/api/boneyard-sync", {
      method: "POST",
      body: JSON.stringify({ syncKey, revisions }),
    }),
  );
}
try {
  assert.equal((await send("namespace-one", [root, left])).status, 200);
  const response = await send("namespace-one", [root, right]);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.boneyardProtocol, 1);
  assert.equal(data.revisions.length, 3);
  assert.equal(materialize(data.revisions).conflicts.length, 1);
  console.log("PASS two devices retain both concurrent idea versions");
  const other = await (await send("namespace-two", [])).json();
  assert.equal(other.revisions.length, 0);
  console.log("PASS sync namespaces stay isolated");
  assert.equal(
    (await send("namespace-one", [{ ...root, value: { ...value, body: "overwrite" } }])).status,
    409,
  );
  console.log("PASS immutable revision IDs reject altered content");
  const resolved = {
    ...root,
    id: "resolved",
    parents: ["left", "right"],
    at: 4,
    value: { ...value, body: "Combined thought", updatedAt: 4 },
  };
  const resolvedData = await (await send("namespace-one", [root, left, right, resolved])).json();
  assert.equal(materialize(resolvedData.revisions).conflicts.length, 0);
  assert.equal(resolvedData.revisions.length, 4);
  console.log("PASS explicit resolution preserves history and clears conflict");
  assert.equal((await send("namespace-one", [root, left, right, resolved])).status, 200);
  console.log("PASS sync retry is idempotent");
  assert.equal(
    (await send("namespace-one", [{ ...root, id: "bad", parents: ["missing"] }])).status,
    400,
  );
  const intact = await (await send("namespace-one", [])).json();
  assert.equal(intact.revisions.length, 4);
  console.log("PASS malformed history rolls back without partial writes");
} finally {
  getTursoClient()?.close();
  for (const suffix of ["", "-wal", "-shm"]) await unlink(database + suffix).catch(() => {});
}
