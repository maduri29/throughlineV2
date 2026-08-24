// Normalized IndexedDB access for ADR-0001 (build-phase adapter that replaces the
// scaffold's idb-keyval blob). Five object stores, one database.
const DB_NAME = "throughline.v1";
const VERSION = 2;

export type StoreName = "nodes" | "edges" | "meta" | "history" | "files";

let dbp: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("nodes"))
          db.createObjectStore("nodes", { keyPath: "id" });
        if (!db.objectStoreNames.contains("edges"))
          db.createObjectStore("edges", { keyPath: "id" });
        if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta", { keyPath: "key" });
        if (!db.objectStoreNames.contains("history"))
          db.createObjectStore("history", { keyPath: "projectId" });
        // v2: attachment bytes. Separate store because they are large, opaque
        // and deliberately excluded from the exported/synced graph (data/files.ts).
        if (!db.objectStoreNames.contains("files"))
          db.createObjectStore("files", { keyPath: "id" });
      };
      // An upgrade cannot proceed while another tab holds the old version open,
      // and the default behaviour is to wait forever in silence — the app simply
      // never finishes loading, with nothing on screen to explain why.
      req.onblocked = () => {
        reject(
          new Error(
            "Throughline is open in another tab running an older version. Close the other tabs and reload.",
          ),
        );
      };
      req.onsuccess = () => {
        // A newer version elsewhere will ask us to close; holding the handle
        // would block that tab the same way.
        req.result.onversionchange = () => req.result.close();
        resolve(req.result);
      };
      req.onerror = () => reject(req.error);
    });
  }
  return dbp;
}

async function run<T>(
  store: StoreName,
  mode: IDBTransactionMode,
  // Callers that issue several requests in one transaction (dbPut, dbDelete)
  // return nothing; the transaction's own oncomplete is what resolves us, and
  // `req?.result` below already copes with there being no single request.
  fn: (os: IDBObjectStore) => IDBRequest | void,
): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(req?.result as T);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export function dbGetAll<T>(store: StoreName): Promise<T[]> {
  return run<T[]>(store, "readonly", (os) => os.getAll());
}

export function dbGet<T>(store: StoreName, key: string): Promise<T | undefined> {
  return run<T | undefined>(store, "readonly", (os) => os.get(key));
}

export async function dbPut(store: StoreName, records: unknown[]): Promise<void> {
  if (records.length === 0) return;
  await run(store, "readwrite", (os) => {
    for (const r of records) os.put(r);
  });
}

export async function dbDelete(store: StoreName, keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  await run(store, "readwrite", (os) => {
    for (const k of keys) os.delete(k);
  });
}

export type MetaRec = { key: string; value: unknown };

export async function metaGet<T>(key: string): Promise<T | undefined> {
  const rec = await dbGet<MetaRec>("meta", key);
  return rec?.value as T | undefined;
}

export async function metaSet(key: string, value: unknown): Promise<void> {
  await dbPut("meta", [{ key, value }]);
}
