import { getTursoClient } from "../../../lib/turso";
import { parseRevisions, validateHistory } from "../../../data/boneyard/validation";

export async function POST(request: Request) {
  const client = getTursoClient();
  if (!client) return Response.json({ error: "Cloud sync is not configured." }, { status: 503 });
  try {
    const text = await request.text();
    if (text.length > 20_000_000)
      return Response.json(
        { error: "Sync payload exceeds 20 MB. Export a local backup." },
        { status: 413 },
      );
    const body: unknown = JSON.parse(text);
    if (
      !body ||
      typeof body !== "object" ||
      !("syncKey" in body) ||
      typeof body.syncKey !== "string" ||
      body.syncKey.trim().length < 3 ||
      !("revisions" in body)
    )
      return Response.json({ error: "Invalid Boneyard sync request." }, { status: 400 });
    const revisions = parseRevisions(body.revisions);
    const key = body.syncKey.trim();
    await client.execute(
      "CREATE TABLE IF NOT EXISTS sync_boneyard (sync_key TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY (sync_key, id))",
    );
    const tx = await client.transaction("write");
    try {
      const rows = await tx.execute({
        sql: "SELECT id, data FROM sync_boneyard WHERE sync_key = ?",
        args: [key],
      });
      const existing = new Map(rows.rows.map((r) => [String(r.id), String(r.data)]));
      for (const revision of revisions) {
        const encoded = JSON.stringify(revision);
        const prior = existing.get(revision.id);
        if (prior && prior !== encoded) {
          await tx.rollback();
          return Response.json(
            { error: "A revision ID has conflicting content. Export a backup before retrying." },
            { status: 409 },
          );
        }
        if (!prior)
          await tx.execute({
            sql: "INSERT INTO sync_boneyard (sync_key, id, data) VALUES (?, ?, ?)",
            args: [key, revision.id, encoded],
          });
        existing.set(revision.id, encoded);
      }
      const merged = parseRevisions([...existing.values()].map((value) => JSON.parse(value)));
      validateHistory(merged);
      await tx.commit();
      return Response.json({ ok: true, boneyardProtocol: 1, revisions: merged });
    } finally {
      tx.close();
    }
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof SyntaxError
            ? "Invalid JSON."
            : "Boneyard sync could not complete. Your local ideas are still available.",
      },
      { status: 400 },
    );
  }
}
