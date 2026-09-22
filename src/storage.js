const DB_NAME = "randomizer-arcade";
const DB_VERSION = 2;
const STORES = [
  "pools",
  "poolViews",
  "history",
  "favorites",
  "presets",
  "settings"
];

let dbPromise;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const store of STORES) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: "id" });
        }
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

async function withStore(name, mode, task) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(name, mode);
    const store = tx.objectStore(name);
    let result;
    try {
      result = task(store, tx);
    } catch (error) {
      reject(error);
      return;
    }
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("Database transaction aborted."));
  });
}

export async function getAll(store) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(store, "readonly").objectStore(store).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function getOne(store, id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(store, "readonly").objectStore(store).get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function put(store, value) {
  return withStore(store, "readwrite", (objectStore) => {
    objectStore.put(value);
    return value;
  });
}

export async function putWithRevision(store, value, expectedRevision) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    const objectStore = tx.objectStore(store);
    const read = objectStore.get(value.id);
    let committed = null;

    read.onerror = () => {
      tx.abort();
      reject(read.error);
    };

    read.onsuccess = () => {
      const current = read.result || null;
      const actualRevision = current?.revision ?? null;

      if (expectedRevision != null && actualRevision !== expectedRevision) {
        tx.abort();
        const error = new Error(
          "This record changed in another window. Reload it before saving."
        );
        error.name = "RevisionConflictError";
        error.expectedRevision = expectedRevision;
        error.actualRevision = actualRevision;
        reject(error);
        return;
      }

      objectStore.put(value);
      committed = value;
    };

    tx.oncomplete = () => resolve(committed);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => {
      if (tx.error) reject(tx.error);
    };
  });
}

export async function remove(store, id) {
  return withStore(store, "readwrite", (objectStore) => objectStore.delete(id));
}

export async function clear(store) {
  return withStore(store, "readwrite", (objectStore) => objectStore.clear());
}

export async function getSettings() {
  const record = await getOne("settings", "app");
  return record?.value || {
    randomness: { mode: "secure", seed: "ARCADE-2026" },
    sound: true,
    motion: "system"
  };
}

export async function saveSettings(value) {
  return put("settings", { id: "app", value });
}

export async function requestPersistentStorage() {
  if (!navigator.storage?.persist) return false;
  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
