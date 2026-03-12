const DB_NAME = 'NOC_SYSTEM_DB';
const DB_VERSION = 1;
const STORES = ['metrics', 'logs', 'traces', 'alerts', 'incidents'] as const;

let dbInstance: IDBDatabase | null = null;

export function genId(): string {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

export async function initDB(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      for (const store of STORES) {
        if (!db.objectStoreNames.contains(store)) {
          const s = db.createObjectStore(store, { keyPath: 'id' });
          if (store === 'metrics' || store === 'logs' || store === 'traces' || store === 'alerts') {
            s.createIndex('timestamp', 'timestamp');
            s.createIndex('serviceId', 'serviceId');
          }
        }
      }
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onerror = () => reject(request.error);
  });
}

export async function dbAction<T>(
  storeName: string,
  mode: IDBTransactionMode,
  action: 'add' | 'put' | 'getAll' | 'clear',
  data?: T
): Promise<T[]> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    let request: IDBRequest;

    switch (action) {
      case 'add':
        request = store.add(data);
        break;
      case 'put':
        request = store.put(data);
        break;
      case 'getAll':
        request = store.getAll();
        break;
      case 'clear':
        request = store.clear();
        break;
      default:
        reject(new Error(`Unknown action: ${action}`));
        return;
    }

    tx.oncomplete = () => {
      if (action === 'getAll') {
        resolve(request.result as T[]);
      } else {
        resolve([]);
      }
    };

    tx.onerror = () => reject(tx.error);
  });
}

export async function clearAllData(): Promise<void> {
  for (const store of STORES) {
    await dbAction(store, 'readwrite', 'clear');
  }
}
