import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface AfemecDB extends DBSchema {
  punches: {
    key: string;
    value: {
      id: string;
      ci: string;
      type: 'ENTRADA' | 'SALIDA';
      photoBase64: string;
      latitude: number | null;
      longitude: number | null;
      timestamp: string; // ISO string of the original offline time
      synced: boolean;
    };
    indexes: { 'by-sync': boolean };
  };
}

let dbPromise: Promise<IDBPDatabase<AfemecDB>> | null = null;

export const initDB = () => {
  if (typeof window === 'undefined') return null; // Avoid running on server
  
  if (!dbPromise) {
    dbPromise = openDB<AfemecDB>('afemec-offline-db', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('punches')) {
          const store = db.createObjectStore('punches', { keyPath: 'id' });
          store.createIndex('by-sync', 'synced');
        }
      },
    });
  }
  return dbPromise;
};

export const saveOfflinePunch = async (punchData: Omit<AfemecDB['punches']['value'], 'id' | 'synced'>) => {
  const db = await initDB();
  if (!db) return;

  const id = crypto.randomUUID();
  const entry = {
    ...punchData,
    id,
    synced: false
  };

  await db.put('punches', entry);
  return id;
};

export const getUnsyncedPunches = async () => {
  const db = await initDB();
  if (!db) return [];
  return await db.getAllFromIndex('punches', 'by-sync', false);
};

export const markPunchAsSynced = async (id: string) => {
  const db = await initDB();
  if (!db) return;
  const punch = await db.get('punches', id);
  if (punch) {
    punch.synced = true;
    await db.put('punches', punch);
    // Alternatively, delete it after sync to save space:
    // await db.delete('punches', id);
  }
};

export const deletePunch = async (id: string) => {
  const db = await initDB();
  if (!db) return;
  await db.delete('punches', id);
};
