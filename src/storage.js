const DB_NAME = "randomizer-arcade";
export const DATABASE_VERSION = 8;
export const PORTABLE_STORAGE_STORES = Object.freeze([
  "pools",
  "poolViews",
  "ruleSets",
  "sessionTemplates",
  "templateSessions",
  "partySessions",
  "customExperiences",
  "workflows",
  "workflowSessions",
  "history",
  "runs",
  "sessions",
  "sessionEvents",
  "historyPins",
  "favorites",
  "presets",
  "settings"
]);
const STORES = [
  "pools",
  "poolViews",
  "ruleSets",
  "sessionTemplates",
  "templateSessions",
  "partySessions",
  "customExperiences",
  "workflows",
  "workflowSessions",
  "history",
  "runs",
  "sessions",
  "sessionEvents",
  "historyPins",
  "favorites",
  "presets",
  "settings",
  "deviceMeta"
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
    const request = indexedDB.open(DB_NAME, DATABASE_VERSION);
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
  templateSession = null,
  partySession = null,
  workflowSession = null,
  settingsRecord = null,
  expectedSessionRevision = null,
  expectedTemplateSessionRevision = null,
  expectedPartySessionRevision = null,
  expectedWorkflowSessionRevision = null
}) {
  const db = await openDb();
  const storeNames = ["runs"];
  if (session) storeNames.push("sessions");
  if (event) storeNames.push("sessionEvents");
  if (templateSession) storeNames.push("templateSessions");
  if (partySession) storeNames.push("partySessions");
  if (workflowSession) storeNames.push("workflowSessions");
  if (settingsRecord) storeNames.push("settings");

  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, "readwrite");
    const runStore = tx.objectStore("runs");
    const sessionStore = session ? tx.objectStore("sessions") : null;
    const eventStore = event ? tx.objectStore("sessionEvents") : null;
    const templateStore = templateSession
      ? tx.objectStore("templateSessions")
      : null;
    const partyStore = partySession
      ? tx.objectStore("partySessions")
      : null;
    const workflowStore = workflowSession
      ? tx.objectStore("workflowSessions")
      : null;
    const settingsStore = settingsRecord ? tx.objectStore("settings") : null;

    let explicitError = null;
    let sessionReady = !session;
    let templateReady = !templateSession;
    let partyReady = !partySession;
    let workflowReady = !workflowSession;

    const writeAll = () => {
      if (
        !sessionReady
        || !templateReady
        || !partyReady
        || !workflowReady
        || explicitError
      ) return;

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
        if (templateSession) templateStore.put(templateSession);
        if (partySession) partyStore.put(partySession);
        if (workflowSession) workflowStore.put(workflowSession);
        if (settingsRecord) settingsStore.put(settingsRecord);
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
    }

    if (templateSession) {
      const readTemplate = templateStore.get(templateSession.id);
      readTemplate.onerror = () => {
        explicitError = readTemplate.error;
        tx.abort();
      };
      readTemplate.onsuccess = () => {
        const current = readTemplate.result || null;
        const actualRevision = current?.revision ?? null;

        if (
          expectedTemplateSessionRevision != null
          && actualRevision !== expectedTemplateSessionRevision
        ) {
          explicitError = revisionConflict(
            expectedTemplateSessionRevision,
            actualRevision
          );
          tx.abort();
          return;
        }

        templateReady = true;
        writeAll();
      };
    }

    if (partySession) {
      const readParty = partyStore.get(partySession.id);
      readParty.onerror = () => {
        explicitError = readParty.error;
        tx.abort();
      };
      readParty.onsuccess = () => {
        const current = readParty.result || null;
        const actualRevision = current?.revision ?? null;

        if (
          expectedPartySessionRevision != null
          && actualRevision !== expectedPartySessionRevision
        ) {
          explicitError = revisionConflict(
            expectedPartySessionRevision,
            actualRevision
          );
          tx.abort();
          return;
        }

        partyReady = true;
        writeAll();
      };
    }

    if (workflowSession) {
      const readWorkflow = workflowStore.get(workflowSession.id);
      readWorkflow.onerror = () => {
        explicitError = readWorkflow.error;
        tx.abort();
      };
      readWorkflow.onsuccess = () => {
        const current = readWorkflow.result || null;
        const actualRevision = current?.revision ?? null;

        if (
          expectedWorkflowSessionRevision != null
          && actualRevision !== expectedWorkflowSessionRevision
        ) {
          explicitError = revisionConflict(
            expectedWorkflowSessionRevision,
            actualRevision
          );
          tx.abort();
          return;
        }

        workflowReady = true;
        writeAll();
      };
    }

    if (!session && !templateSession && !partySession && !workflowSession) {
      writeAll();
    }

    tx.oncomplete = () => resolve({
      run,
      session,
      event,
      templateSession,
      partySession,
      workflowSession,
      settingsRecord
    });
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
    randomness: {
      mode: "secure",
      seed: "ARCADE-2026",
      position: 0
    },
    presentation: {
      mode: "normal",
      effects: "auto",
      sound: true,
      haptics: "standard",
      motion: "system"
    },
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


function assertKnownStore(name) {
  if (!STORES.includes(name)) {
    throw new Error("Unknown storage collection: " + name);
  }
}

export async function dumpDatabaseStores(
  storeNames = PORTABLE_STORAGE_STORES
) {
  const names = [...new Set(storeNames.map(String))];
  names.forEach(assertKnownStore);
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(names, "readonly");
    const output = {};
    let remaining = names.length;
    let failed = false;

    if (!remaining) {
      resolve(output);
      return;
    }

    for (const name of names) {
      const request = tx.objectStore(name).getAll();
      request.onsuccess = () => {
        output[name] = request.result || [];
        remaining -= 1;
      };
      request.onerror = () => {
        failed = true;
        reject(request.error);
        try {
          tx.abort();
        } catch {
          // Transaction may already be closing.
        }
      };
    }

    tx.oncomplete = () => {
      if (!failed) resolve(output);
    };
    tx.onerror = () => {
      if (!failed) reject(tx.error);
    };
    tx.onabort = () => {
      if (!failed) {
        reject(tx.error || new Error("Database export transaction aborted."));
      }
    };
  });
}

export async function replaceDatabaseStores(snapshot, {
  storeNames = Object.keys(snapshot || {})
} = {}) {
  const names = [...new Set(storeNames.map(String))];
  names.forEach(assertKnownStore);

  for (const name of names) {
    if (!Array.isArray(snapshot?.[name])) {
      throw new Error("Restore data for " + name + " must be an array.");
    }
  }

  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(names, "readwrite");
    const counts = {};

    try {
      for (const name of names) {
        const store = tx.objectStore(name);
        store.clear();
        counts[name] = snapshot[name].length;
        for (const record of snapshot[name]) {
          if (
            !record
            || typeof record !== "object"
            || Array.isArray(record)
            || record.id == null
          ) {
            throw new Error(
              "Restore contains an invalid record in " + name + "."
            );
          }
          store.put(record);
        }
      }
    } catch (error) {
      try {
        tx.abort();
      } catch {
        // Transaction may already be closing.
      }
      reject(error);
      return;
    }

    tx.oncomplete = () => resolve({ counts });
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(
      tx.error || new Error("Database restore transaction aborted.")
    );
  });
}

export async function getStorageStatus() {
  let estimate = null;
  let persisted = false;

  try {
    if (navigator.storage?.estimate) {
      estimate = await navigator.storage.estimate();
    }
  } catch {
    estimate = null;
  }

  try {
    if (navigator.storage?.persisted) {
      persisted = await navigator.storage.persisted();
    }
  } catch {
    persisted = false;
  }

  return {
    persisted,
    usage: Number(estimate?.usage || 0),
    quota: Number(estimate?.quota || 0)
  };
}

function defaultDeviceName() {
  const platform =
    navigator.userAgentData?.platform
    || navigator.platform
    || "Browser";
  return String(platform).slice(0, 80) + " device";
}

export async function getDeviceIdentity() {
  const current = await getOne("deviceMeta", "device");
  if (current?.deviceId) return current;

  const record = {
    id: "device",
    deviceId: globalThis.crypto?.randomUUID
      ? globalThis.crypto.randomUUID()
      : "device-" + Date.now().toString(36),
    name: defaultDeviceName(),
    platform:
      navigator.userAgentData?.platform
      || navigator.platform
      || "",
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  await put("deviceMeta", record);
  return record;
}

export async function renameDevice(name) {
  const current = await getDeviceIdentity();
  const next = {
    ...current,
    name: String(name || "").trim().slice(0, 120) || defaultDeviceName(),
    updatedAt: Date.now()
  };
  await put("deviceMeta", next);
  return next;
}
