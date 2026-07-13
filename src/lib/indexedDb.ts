const DB_NAME = "smile-score-db";
const DB_VERSION = 1;
const STORE_NAME = "rankings";

export type RankingEntry = {
  id: string;
  createdAt: string;
  totalScore: number;
  scores: {
    mouthCorner: number;
    mouthWidth: number;
    cheekEye: number;
    symmetry: number;
    stability: number;
    teeth: number;
  };
  imageBlob: Blob;
};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDBを開けませんでした"));
  });
}

export async function addRankingEntry(entry: RankingEntry): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(entry);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error("ランキングの保存に失敗しました"));
    };
  });
}

export async function getTopRanking(limit = 10): Promise<RankingEntry[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => {
      const entries = request.result as RankingEntry[];
      entries.sort(
        (a, b) =>
          b.totalScore - a.totalScore || b.createdAt.localeCompare(a.createdAt)
      );
      db.close();
      resolve(entries.slice(0, limit));
    };
    request.onerror = () => {
      db.close();
      reject(request.error ?? new Error("ランキングの取得に失敗しました"));
    };
  });
}

export async function deleteRankingEntry(id: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error("ランキングの削除に失敗しました"));
    };
  });
}

export async function clearRanking(): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error("ランキングの全削除に失敗しました"));
    };
  });
}
