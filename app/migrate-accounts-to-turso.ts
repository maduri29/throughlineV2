/** Run once after connecting Turso. Copies registry entries; never prints secrets or passwords. */
import { createClient } from "@libsql/client";
import { existsSync } from "node:fs";
import { getAccountRegistry } from "./src/lib/account-registry";

if (!process.env.TURSO_DATABASE_URL?.startsWith("libsql://") || !process.env.TURSO_AUTH_TOKEN)
  throw new Error("Set the Turso database URL and access token in .env.local before migrating.");
if (!existsSync(".throughline-accounts.db")) throw new Error("Local account registry not found.");
const local = createClient({ url: "file:.throughline-accounts.db" });
try {
  const remote = getAccountRegistry();
  if (!remote) throw new Error("Cloud registry is unavailable.");
  const rows = await local.execute("SELECT uid, email, username FROM throughline_accounts");
  for (const row of rows.rows) {
    const account = {
      uid: String(row.uid),
      email: String(row.email),
      username: row.username ? String(row.username) : undefined,
    };
    const prior = await remote.find(account.email);
    if (prior) {
      if (prior.uid !== account.uid || prior.username !== account.username)
        throw new Error(
          "A local account conflicts with a cloud registry entry. No accounts were removed.",
        );
    } else await remote.register(account);
  }
  console.log(
    `PASS ${rows.rows.length} local accounts are present in Turso; original local registry retained.`,
  );
} finally {
  local.close();
}
