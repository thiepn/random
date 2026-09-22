const DB_NAME = "randomizer-arcade";
const DB_VERSION = 3;
const STORES = [
  "pools",
  "poolViews",
  "history",
  "runs",
  "sessions",
  "sessionEvents",
  "historyPins",
  "favorites",
  "presets",
  "settings"
];

let dbPromise;

function revisionConflict(expectedRevision, actualRevision) {
  const error = new Error(
    "This record changed in another window. Reload it before saving."
  );
  error.name = "RevisionConflictError";
  error.expectedRevision = expectedRevision;
  error.actualRevision = actualRevision;
  return error;
}

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
    let explicitError = null;

    read.onerror = () => {
      explicitError = read.error;
      tx.abort();
    };

    read.onsuccess = () => {
      const current = read.result || null;
      const actualRevision = current?.revision ?? null;

      if (expectedRevision != null && actualRevision !== expectedRevision) {
        explicitError = revisionConflict(expectedRevision, actualRevision);
        tx.abort();
        return;
      }

      objectStore.put(value);
      committed = value;
    };

    tx.oncomplete = () => resolve(committed);
    tx.onerror = () => reject(explicitError || tx.error);
    tx.onabort = () => reject(
      explicitError || tx.error || new Error("Database transaction aborted.")
    );
  });
}

export async function commitRunAndSession({
  run,
  session = null,
  event = null,
  expectedSessionRevision = null
}) {
  const db = await openDb();
  const storeNames = ["runs"];
  if (session) storeNames.push("sessions");
  if (event) storeNames.push("sessionEvents");

  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, "readwrite");
    const runStore = tx.objectStore("runs");
    const sessionStore = session ? tx.objectStore("sessions") : null;
    const eventStore = event ? tx.objectStore("sessionEvents") : null;

    let explicitError = null;
    let sessionReady = !session;

    const writeAll = () => {
      if (!sessionReady || explicitError) return;

      const existingRun = runStore.get(run.id);
      existingRun.onerror = () => {
        explicitError = existingRun.error;
        tx.abort();
      };
      existingRun.onsuccess = () => {
        if (existingRun.result) {
          explicitError = new Error("Run IDs are immutable and cannot be overwritten.");
          explicitError.name = "ImmutableRunError";
          tx.abort();
          return;
        }

        runStore.add(run);
        if (session) sessionStore.put(session);
        if (event) eventStore.add(event);
      };
    };

    if (session) {
      const readSession = sessionStore.get(session.id);
      readSession.onerror = () => {
        explicitError = readSession.error;
        tx.abort();
      };
      readSession.onsuccess = () => {
        const current = readSession.result || null;
        const actualRevision = current?.revision ?? null;

        if (
          expectedSessionRevision != null
          && actualRevision !== expectedSessionRevision
        ) {
          explicitError = revisionConflict(
            expectedSessionRevision,
            actualRevision
          );
          tx.abort();
          return;
        }

        sessionReady = true;
        writeAll();
      };
    } else {
      writeAll();
    }

    tx.oncomplete = () => resolve({ run, session, event });
    tx.onerror = () => reject(explicitError || tx.error);
    tx.onabort = () => reject(
      explicitError || tx.error || new Error("Run transaction aborted.")
    );
  });
}

export async function commitSessionMutation({
  session,
  event = null,
  expectedRevision
}) {
  const db = await openDb();
  const storeNames = event ? ["sessions", "sessionEvents"] : ["sessions"];

  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, "readwrite");
    const sessionStore = tx.objectStore("sessions");
    const eventStore = event ? tx.objectStore("sessionEvents") : null;
    const read = sessionStore.get(session.id);
    let explicitError = null;

    read.onerror = () => {
      explicitError = read.error;
      tx.abort();
    };

    read.onsuccess = () => {
      const current = read.result || null;
      const actualRevision = current?.revision ?? null;

      if (actualRevision !== expectedRevision) {
        explicitError = revisionConflict(expectedRevision, actualRevision);
        tx.abort();
        return;
      }

      sessionStore.put(session);
      if (event) eventStore.add(event);
    };

    tx.oncomplete = () => resolve({ session, event });
    tx.onerror = () => reject(explicitError || tx.error);
    tx.onabort = () => reject(
      explicitError || tx.error || new Error("Session transaction aborted.")
    );
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
