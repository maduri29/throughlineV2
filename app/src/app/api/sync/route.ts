import type { InStatement } from "@libsql/client";
import { ensureTursoSchema, getTursoClient, isTursoConfigured } from "../../../lib/turso";
import type { GraphEdge, GraphNode } from "../../../types";

export async function GET() {
  return Response.json({ configured: isTursoConfigured() });
}

export async function POST(req: Request) {
  if (!isTursoConfigured()) {
    return Response.json(
      {
        ok: false,
        error:
          "Turso is not configured on this server. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in .env.local",
      },
      { status: 503 },
    );
  }

  let body: {
    syncKey?: string;
    lastSyncedAt?: number;
    pushNodes?: GraphNode[];
    pushEdges?: GraphEdge[];
  };

  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON request body" }, { status: 400 });
  }

  const syncKey = body.syncKey?.trim();
  if (!syncKey || syncKey.length < 3) {
    return Response.json(
      { ok: false, error: "syncKey must be at least 3 characters long" },
      { status: 400 },
    );
  }

  const client = getTursoClient();
  if (!client) {
    return Response.json(
      { ok: false, error: "Could not initialize Turso client" },
      { status: 500 },
    );
  }

  try {
    await ensureTursoSchema(client);

    const now = Date.now();
    const statements: InStatement[] = [];

    for (const n of body.pushNodes ?? []) {
      statements.push({
        sql: `INSERT OR REPLACE INTO sync_nodes (id, sync_key, type, data, updated_at) VALUES (?, ?, ?, ?, ?);`,
        args: [n.id, syncKey, n.type, JSON.stringify(n), now],
      });
    }

    for (const e of body.pushEdges ?? []) {
      statements.push({
        sql: `INSERT OR REPLACE INTO sync_edges (id, sync_key, type, data, updated_at) VALUES (?, ?, ?, ?, ?);`,
        args: [e.id, syncKey, e.type, JSON.stringify(e), now],
      });
    }

    if (statements.length > 0) {
      await client.batch(statements, "write");
    }

    const since = typeof body.lastSyncedAt === "number" ? body.lastSyncedAt : 0;
    const pushedNodeIds = new Set((body.pushNodes ?? []).map((n) => n.id));
    const pushedEdgeIds = new Set((body.pushEdges ?? []).map((e) => e.id));

    // Fetch records updated by other devices
    const nodeRows = await client.execute({
      sql: `SELECT id, data FROM sync_nodes WHERE sync_key = ? AND updated_at > ?;`,
      args: [syncKey, since],
    });

    const edgeRows = await client.execute({
      sql: `SELECT id, data FROM sync_edges WHERE sync_key = ? AND updated_at > ?;`,
      args: [syncKey, since],
    });

    const pulledNodes: GraphNode[] = [];
    for (const r of nodeRows.rows) {
      const id = String(r.id);
      if (!pushedNodeIds.has(id)) {
        try {
          pulledNodes.push(JSON.parse(String(r.data)));
        } catch {
          // ignore corrupted single record
        }
      }
    }

    const pulledEdges: GraphEdge[] = [];
    for (const r of edgeRows.rows) {
      const id = String(r.id);
      if (!pushedEdgeIds.has(id)) {
        try {
          pulledEdges.push(JSON.parse(String(r.data)));
        } catch {
          // ignore corrupted single record
        }
      }
    }

    return Response.json({
      ok: true,
      syncedAt: now,
      pulledNodes,
      pulledEdges,
    });
  } catch (err) {
    return Response.json(
      { ok: false, error: `Turso query error: ${String(err)}` },
      { status: 500 },
    );
  }
}
