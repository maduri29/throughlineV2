import { createClient, type Client } from "@libsql/client";
import { getTursoClient, isTursoConfigured } from "./turso";
import { parseAccounts, type Account } from "./account-policy";

export class AccountRegistrationError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/** A write transaction serializes seat allocation, including concurrent sign-ups. */
export class AccountRegistry {
  constructor(
    private client: Client,
    private seeds: Account[] = [],
  ) {}

  async initialize(): Promise<void> {
    await this.client.execute(`CREATE TABLE IF NOT EXISTS throughline_accounts (
      uid TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      username TEXT UNIQUE COLLATE NOCASE, created_at INTEGER NOT NULL
    )`);
    const tx = await this.client.transaction("write");
    try {
      for (const account of this.seeds) {
        const exists = await tx.execute({
          sql: "SELECT uid FROM throughline_accounts WHERE uid = ?",
          args: [account.uid],
        });
        if (exists.rows.length) continue;
        const count = await tx.execute("SELECT COUNT(*) AS count FROM throughline_accounts");
        if (Number(count.rows[0]?.count) >= 5)
          throw new AccountRegistrationError("This workspace already has five accounts.", 409);
        await tx.execute({
          sql: "INSERT INTO throughline_accounts (uid, email, username, created_at) VALUES (?, ?, ?, ?)",
          args: [account.uid, account.email, account.username ?? null, Date.now()],
        });
      }
      await tx.commit();
    } catch (error) {
      await tx.rollback();
      throw error;
    } finally {
      tx.close();
    }
  }

  async find(login: string): Promise<Account | undefined> {
    await this.initialize();
    const result = await this.client.execute({
      sql: "SELECT uid, email, username FROM throughline_accounts WHERE email = ? OR username = ?",
      args: [login.trim().toLowerCase(), login.trim().toLowerCase()],
    });
    const row = result.rows[0];
    return row
      ? {
          uid: String(row.uid),
          email: String(row.email),
          username: row.username ? String(row.username) : undefined,
        }
      : undefined;
  }

  async member(uid: string, email: string): Promise<boolean> {
    await this.initialize();
    const result = await this.client.execute({
      sql: "SELECT uid FROM throughline_accounts WHERE uid = ? AND email = ?",
      args: [uid, email.toLowerCase()],
    });
    return result.rows.length === 1;
  }

  async count(): Promise<number> {
    await this.initialize();
    return Number(
      (await this.client.execute("SELECT COUNT(*) AS count FROM throughline_accounts")).rows[0]
        ?.count ?? 0,
    );
  }

  async register(account: Account): Promise<void> {
    await this.initialize();
    const tx = await this.client.transaction("write");
    try {
      const existing = await tx.execute({
        sql: "SELECT uid FROM throughline_accounts WHERE uid = ? OR email = ? OR username = ?",
        args: [account.uid, account.email, account.username ?? null],
      });
      if (existing.rows.length)
        throw new AccountRegistrationError(
          "An account with this email or username already exists. Sign in instead.",
          409,
        );
      const count = await tx.execute("SELECT COUNT(*) AS count FROM throughline_accounts");
      if (Number(count.rows[0]?.count) >= 5)
        throw new AccountRegistrationError(
          "All five account spaces are filled. Contact the workspace owner.",
          409,
        );
      await tx.execute({
        sql: "INSERT INTO throughline_accounts (uid, email, username, created_at) VALUES (?, ?, ?, ?)",
        args: [account.uid, account.email.toLowerCase(), account.username ?? null, Date.now()],
      });
      await tx.commit();
    } catch (error) {
      await tx.rollback();
      throw error;
    } finally {
      tx.close();
    }
  }
}

let localClient: Client | undefined;

export function registryConfigured(): boolean {
  return isTursoConfigured() || process.env.NODE_ENV !== "production";
}

export function getAccountRegistry(): AccountRegistry | null {
  let client = getTursoClient();
  if (!client && process.env.NODE_ENV !== "production") {
    // Development only. Hosted production requires a durable Turso database.
    localClient ??= createClient({ url: "file:.throughline-accounts.db" });
    client = localClient;
  }
  return client
    ? new AccountRegistry(client, parseAccounts(process.env.THROUGHLINE_ACCOUNTS))
    : null;
}
