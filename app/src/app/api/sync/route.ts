import { ensureTursoSchema, getTursoClient, isTursoConfigured } from "../../../lib/turso";
import { requireIdentity } from "../../../lib/auth-server";
import {
  type CloudRecord,
  type CloudChange,
  recordKey,
  sameContent,
} from "../../../data/sync-protocol";

export async function GET(req: Request) {
  const identity = await requireIdentity(req);
  if (identity instanceof Response) return identity;
  if (!isTursoConfigured())
    return Response.json({
      configured: false,
      provider: "Turso",
      reason: "Cloud storage has not been connected.",
    });
  try {
    await getTursoClient()!.execute("SELECT 1");
    return Response.json(
      { configured: true, provider: "Turso", protocol: 2 },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      {
        configured: false,
        provider: "Turso",
        reason: "Cloud storage could not be reached. Your local work is safe.",
      },
      { status: 503 },
    );
  }
}

export async function POST(req: Request) {
  const identity = await requireIdentity(req);
  if (identity instanceof Response) return identity;
  const client = getTursoClient();
  if (!client)
    return Response.json(
      {
        ok: false,
        error: "Cloud storage has not been connected. Your work remains on this device.",
      },
      { status: 503 },
    );
  let body;
  try {
    const text = await req.text();
    if (text.length > 20_000_000)
      return Response.json(
        { ok: false, error: "Sync payload exceeds 20 MB. Export a local backup." },
        { status: 413 },
      );
    body = JSON.parse(text);
    if (!body || typeof body !== "object") throw new Error();
  } catch {
    return Response.json({ ok: false, error: "Invalid sync request." }, { status: 400 });
  }
  if (
    body.protocol !== 2 &&
    ((body.pushNodes !== undefined && !Array.isArray(body.pushNodes)) ||
      (body.pushEdges !== undefined && !Array.isArray(body.pushEdges)))
  )
    return Response.json({ ok: false, error: "Invalid sync request." }, { status: 400 });
  const changes: CloudChange[] =
    body.protocol === 2
      ? body.changes
      : [
          ...(body.pushNodes ?? []).map((data: CloudRecord["data"]) => ({
            kind: "nodes",
            id: data?.id,
            data,
            baseVersion: 0,
          })),
          ...(body.pushEdges ?? []).map((data: CloudRecord["data"]) => ({
            kind: "edges",
            id: data?.id,
            data,
            baseVersion: 0,
          })),
        ];
  if (
    !Array.isArray(changes) ||
    changes.some(
      (r) =>
        !r ||
        !["nodes", "edges"].includes(r.kind) ||
        typeof r.id !== "string" ||
        !r.id ||
        !Number.isSafeInteger(r.baseVersion) ||
        r.baseVersion < 0 ||
        (r.data !== null &&
          (!r.data ||
            typeof r.data !== "object" ||
            r.data.id !== r.id ||
            typeof r.data.type !== "string")),
    ) ||
    new Set(changes.map(recordKey)).size !== changes.length
  )
    return Response.json({ ok: false, error: "Invalid sync changes." }, { status: 400 });
  try {
    await ensureTursoSchema(client);
    const tx = await client.transaction("write");
    try {
      const records: CloudRecord[] = [];
      for (const kind of ["nodes", "edges"] as const) {
        const rows = await tx.execute({
          sql: `SELECT id, type, data, updated_at FROM account_sync_${kind} WHERE sync_key = ?`,
          args: [identity.syncKey],
        });
        for (const row of rows.rows)
          records.push({
            kind,
            id: String(row.id),
            data: row.type === "__deleted" ? null : JSON.parse(String(row.data)),
            version: Number(row.updated_at),
          });
      }
      const existing = new Map(records.map((r) => [recordKey(r), r]));
      const conflicts = changes
        .filter((change) => {
          const remote = existing.get(recordKey(change));
          return (
            (remote?.version ?? 0) !== change.baseVersion &&
            !sameContent(remote?.data ?? null, change.data)
          );
        })
        .map((change) => ({
          ...(existing.get(recordKey(change)) ?? {
            kind: change.kind,
            id: change.id,
            data: null,
            version: 0,
          }),
          local: change.data,
        }));
      if (conflicts.length) {
        await tx.rollback();
        return Response.json(
          {
            ok: false,
            protocol: 2,
            error:
              "Another device changed this work. Both versions are preserved. Resolve the differences in your profile.",
            conflicts,
          },
          { status: 409 },
        );
      }
      for (const change of changes) {
        const old = existing.get(recordKey(change));
        if (old && sameContent(old.data, change.data)) continue;
        const record = {
          kind: change.kind,
          id: change.id,
          data: change.data,
          version: (old?.version ?? 0) + 1,
        };
        await tx.execute({
          sql: `INSERT OR REPLACE INTO account_sync_${change.kind} (id, sync_key, type, data, updated_at) VALUES (?, ?, ?, ?, ?)`,
          args: [
            record.id,
            identity.syncKey,
            record.data?.type ?? "__deleted",
            JSON.stringify(record.data),
            record.version,
          ],
        });
        existing.set(recordKey(record), record);
      }
      await tx.commit();
      const merged = [...existing.values()];
      return Response.json({
        ok: true,
        protocol: 2,
        syncedAt: Date.now(),
        records: merged,
        pulledNodes: merged.filter((r) => r.kind === "nodes" && r.data !== null).map((r) => r.data),
        pulledEdges: merged.filter((r) => r.kind === "edges" && r.data !== null).map((r) => r.data),
      });
    } catch (error) {
      await tx.rollback();
      throw error;
    } finally {
      tx.close();
    }
  } catch {
    return Response.json(
      { ok: false, error: "Cloud sync could not complete. Your local work is safe. Try again." },
      { status: 503 },
    );
  }
}
