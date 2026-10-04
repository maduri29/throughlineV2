import { createClient, type Client } from "@libsql/client";

let clientInstance: Client | null = null;
let initialized = false;

export function isTursoConfigured(): boolean {
  return Boolean(process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN);
}

export function getTursoClient(): Client | null {
  if (!isTursoConfigured()) return null;
  if (!clientInstance) {
    clientInstance = createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN!,
    });
  }
  return clientInstance;
}

export async function ensureTursoSchema(client: Client): Promise<void> {
  if (initialized) return;
  await client.batch([
    `CREATE TABLE IF NOT EXISTS account_sync_nodes (
      id TEXT NOT NULL,
      sync_key TEXT NOT NULL,
      type TEXT NOT NULL,
      data TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (sync_key, id)
    );`,
    `CREATE INDEX IF NOT EXISTS idx_account_sync_nodes_key ON account_sync_nodes (sync_key, updated_at);`,
    `CREATE TABLE IF NOT EXISTS account_sync_edges (
      id TEXT NOT NULL,
      sync_key TEXT NOT NULL,
      type TEXT NOT NULL,
      data TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (sync_key, id)
    );`,
    `CREATE INDEX IF NOT EXISTS idx_account_sync_edges_key ON account_sync_edges (sync_key, updated_at);`,
  ]);
  initialized = true;
}
