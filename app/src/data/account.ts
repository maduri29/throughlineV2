let accountId: string | null = null;

/** Set once, before importing the editor. Account changes require a full reload. */
export function setWorkspaceAccount(uid: string): void {
  if (accountId && accountId !== uid) throw new Error("Reload before switching accounts.");
  accountId = uid;
}

export function getWorkspaceAccount(): string | null {
  return accountId;
}

export function accountStorageKey(key: string): string {
  return accountId ? `${key}.user.${accountId}` : key;
}

export function workspaceDatabaseName(): string {
  return accountId ? `throughline.v1.user.${accountId}` : "throughline.v1";
}
