// Normalized IndexedDB access for ADR-0001 (build-phase adapter that replaces the
// scaffold's idb-keyval blob). Five object stores, one database.
const DB_NAME = "throughline.v1";
const VERSION = 2;

export type StoreName = "nodes" | "edges" | "meta" | "history" | "files";

let dbp: Promise<IDBDatabase> | null = null;

/**
 * Drop the cached connection so the next call reopens.
 *
 * The cache was the bug: a connection can close underneath us — another tab
 * upgrading, the browser reclaiming it, an abort — and the handle then rejects
 * everything forever while `dbp` keeps handing it out. Reads returned nothing
 * and writes did nothing, silently, until a reload. Data was never lost; it was
 * unreachable, which looks identical from the outside.
 */
function forget(): void {
  dbp = null;
}

function createStores(db: IDBDatabase): void {
  if (!db.objectStoreNames.contains("nodes")) db.createObjectStore("nodes", { keyPath: "id" });
  if (!db.objectStoreNames.contains("edges")) db.createObjectStore("edges", { keyPath: "id" });
  if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta", { keyPath: "key" });
  if (!db.objectStoreNames.contains("history"))
    db.createObjectStore("history", { keyPath: "projectId" });
  // v2: attachment bytes. Separate store because they are large, opaque and
  // deliberately excluded from the exported/synced graph (data/files.ts).
  if (!db.objectStoreNames.contains("files")) db.createObjectStore("files", { keyPath: "id" });
}

function watch(db: IDBDatabase): IDBDatabase {
  // Both paths must clear the cache. Closing without forgetting is what turned a
  // recoverable event into a permanently dead app.
  db.onversionchange = () => {
    db.close();
    forget();
  };
  db.onclose = forget;
  return db;
}

/** Open at `version`, or at whatever exists when null. */
function request(version: number | undefined): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = version === undefined ? indexedDB.open(DB_NAME) : indexedDB.open(DB_NAME, version);
    req.onupgradeneeded = () => createStores(req.result);
    // An upgrade cannot proceed while another tab holds the old version open,
    // and the default is to wait forever in silence — the app never finishes
    // loading, with nothing on screen to explain why.
    req.onblocked = () =>
      reject(
        new Error(
          "Throughline is open in another tab running an older version. Close the other tabs and reload.",
        ),
      );
    req.onsuccess = () => resolve(watch(req.result));
    req.onerror = () => reject(req.error);
  });
}

function open(): Promise<IDBDatabase> {
  dbp ??= request(VERSION).catch((err: unknown) => {
    forget();
    // A database already at a HIGHER version than this build knows about makes
    // indexedDB.open(name, 2) fail outright. Reopening at whatever version is
    // there keeps a newer tab's data readable instead of bricking this one —
    // never delete, because the data is fine and only the handshake failed.
    if (err instanceof DOMException && err.name === "VersionError") {
      return request(undefined);
    }
    throw err;
  });
  return dbp;
}

function attempt<T>(
  db: IDBDatabase,
  store: StoreName,
  mode: IDBTransactionMode,
  fn: (os: IDBObjectStore) => IDBRequest | void,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    // `transaction()` THROWS on a closing connection rather than rejecting, so
    // it has to be inside the promise or the error escapes past every caller.
    let tx: IDBTransaction;
    try {
      tx = db.transaction(store, mode);
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
      return;
    }
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(req?.result as T);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/** True for the failures that mean "this handle is dead", not "this data is bad". */
function isStaleConnection(err: unknown): boolean {
  return (
    err instanceof DOMException &&
    (err.name === "InvalidStateError" ||
      err.name === "TransactionInactiveError" ||
      err.name === "NotFoundError")
  );
}

async function run<T>(
  store: StoreName,
  mode: IDBTransactionMode,
  // Callers that issue several requests in one transaction (dbPut, dbDelete)
  // return nothing; the transaction's own oncomplete is what resolves us, and
  // `req?.result` below already copes with there being no single request.
  fn: (os: IDBObjectStore) => IDBRequest | void,
): Promise<T> {
  try {
    return await attempt<T>(await open(), store, mode, fn);
  } catch (err) {
    // One retry against a fresh connection. A closed handle is recoverable and
    // used to be terminal: every later call failed against the same dead object,
    // so the app kept running with reads returning nothing and writes doing
    // nothing. NotFoundError is included because a handle opened before this
    // build has no `files` store and must be reopened to gain one.
    if (!isStaleConnection(err)) throw err;
    forget();
    return await attempt<T>(await open(), store, mode, fn);
  }
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
