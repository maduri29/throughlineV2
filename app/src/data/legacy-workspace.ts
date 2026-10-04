import { dbGetAll, dbTransaction, type StoreName } from "./idb";
import { getWorkspaceAccount } from "./account";

const stores: StoreName[] = ["nodes", "edges", "meta", "history", "files", "boneyard"];

/** Copy deliberately into an empty account; never assign legacy work automatically. */
export async function importLegacyWorkspace(): Promise<void> {
  if (!getWorkspaceAccount()) throw new Error("Sign in before importing local work.");
  const databases = await indexedDB.databases();
  if (!databases.some((database) => database.name === "throughline.v1"))
    throw new Error("There is no previous local workspace on this device.");
  const legacy = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("throughline.v1");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const contents = new Map<StoreName, Record<string, unknown>[]>();
  try {
    for (const store of stores) {
      if (!legacy.objectStoreNames.contains(store)) {
        contents.set(store, []);
        continue;
      }
      const records = await new Promise<Record<string, unknown>[]>((resolve, reject) => {
        const request = legacy.transaction(store).objectStore(store).getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      contents.set(store, records);
    }
  } finally {
    legacy.close();
  }
  if (!["nodes", "boneyard"].some((store) => contents.get(store as StoreName)?.length))
    throw new Error("There are no stories or ideas in the previous local workspace.");
  // Metadata created during boot does not make a new workspace non-empty.
  for (const store of ["nodes", "edges", "boneyard", "files"] as StoreName[]) {
    if ((await dbGetAll(store)).length)
      throw new Error(
        "Import previous work into an empty account. Export your current work first.",
      );
  }
  await dbTransaction(stores, (transaction) => {
    // Check again inside the write transaction to avoid a race with another tab.
    let pending = 4;
    for (const name of ["nodes", "edges", "boneyard", "files"] as StoreName[]) {
      const request = transaction.objectStore(name).count();
      request.onsuccess = () => {
        if (request.result > 0) {
          transaction.abort();
          return;
        }
        if (--pending !== 0) return;
        for (const store of stores)
          for (const record of contents.get(store) ?? [])
            transaction.objectStore(store).put(record);
      };
    }
  });
}
