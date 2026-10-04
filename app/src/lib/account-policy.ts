export type Account = { username?: string; email: string; uid: string };

/** A small, explicitly provisioned group. Invalid configuration fails closed. */
export function parseAccounts(raw: string | undefined): Account[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value) || value.length < 1 || value.length > 5) return [];
    const accounts: Account[] = [];
    const emails = new Set<string>();
    const usernames = new Set<string>();
    for (const item of value) {
      if (
        !item ||
        typeof item.email !== "string" ||
        typeof item.uid !== "string" ||
        !/^[A-Za-z0-9_-]{1,128}$/.test(item.uid)
      )
        return [];
      const email = item.email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || emails.has(email)) return [];
      const username =
        typeof item.username === "string" ? item.username.trim().toLowerCase() : undefined;
      if (
        username !== undefined &&
        (!/^[a-z0-9_.-]{2,32}$/.test(username) || usernames.has(username))
      )
        return [];
      emails.add(email);
      if (username) usernames.add(username);
      if (accounts.some((account) => account.uid === item.uid)) return [];
      accounts.push({ email, username, uid: item.uid });
    }
    return accounts;
  } catch {
    return [];
  }
}

export function resolveAccount(accounts: Account[], login: string): Account | undefined {
  const normalized = login.trim().toLowerCase();
  return accounts.find(
    (account) => account.email === normalized || account.username === normalized,
  );
}

export function accountSyncKey(uid: string): string {
  return `user:${uid}`;
}
