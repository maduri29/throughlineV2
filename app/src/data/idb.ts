// Normalized IndexedDB access for ADR-0001 (build-phase adapter that replaces the
// scaffold's idb-keyval blob). Four object stores, one database.
const DB_NAME = "throughline.v1";
const VERSION = 1;

export type StoreName = "nodes" | "edges" | "meta" | "history";

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
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbp;
}

async function run<T>(
  store: StoreName,
  mode: IDBTransactionMode,
  fn: (os: IDBObjectStore) => IDBRequest,
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
