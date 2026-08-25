import type { DocumentDraftStore, DraftRecord } from "@openscene-ai/protocol";

const DEFAULT_DB_NAME = "openscene";
const DEFAULT_STORE_NAME = "drafts";

/**
 * IndexedDB-backed {@link DocumentDraftStore}. Drafts are keyed by the
 * Studio session id so each session keeps its own local edit history, and a
 * reloaded session can restore its latest document before syncing again.
 */
export function createIndexedDbDraftStore(
  dbName = DEFAULT_DB_NAME,
  storeName = DEFAULT_STORE_NAME,
): DocumentDraftStore {
  let dbPromise: Promise<IDBDatabase> | undefined;

  const open = () => {
    if (!dbPromise) {
      dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(storeName)) {
            const store = db.createObjectStore(storeName, { keyPath: "sessionId" });
            store.createIndex("updatedAt", "updatedAt");
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
    return dbPromise;
  };

  const run = <T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>) => {
    return open().then(
      (db) =>
        new Promise<T>((resolve, reject) => {
          const transaction = db.transaction(storeName, mode);
          const request = action(transaction.objectStore(storeName));
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
          transaction.onerror = () => reject(transaction.error);
        }),
    );
  };

  return {
    read: async (sessionId) => {
      const record = await run<DraftRecord | undefined>("readonly", (store) =>
        store.get(sessionId),
      );
      return record ?? null;
    },
    write: (record) => run("readwrite", (store) => store.put(record)).then(() => undefined),
    clear: (sessionId) =>
      run("readwrite", (store) => store.delete(sessionId)).then(() => undefined),
  };
}
