const DB_NAME = "mistake-ledger-screenshots";
const STORE = "frames";

export type StoredScreenshot = {
  id: string;
  sessionId: string;
  at: string;
  dataUrl: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("sessionId", "sessionId", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveScreenshot(frame: StoredScreenshot): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE).put(frame);
  });
  db.close();
}

export async function getScreenshots(sessionId: string): Promise<StoredScreenshot[]> {
  const db = await openDb();
  const frames = await new Promise<StoredScreenshot[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const index = tx.objectStore(STORE).index("sessionId");
    const request = index.getAll(sessionId);
    request.onsuccess = () => resolve((request.result as StoredScreenshot[]) ?? []);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return frames.sort((a, b) => a.at.localeCompare(b.at));
}

export async function getLatestScreenshotDataUrls(sessionId: string, limit = 3): Promise<string[]> {
  const frames = await getScreenshots(sessionId);
  return frames.slice(-limit).map((frame) => frame.dataUrl);
}
