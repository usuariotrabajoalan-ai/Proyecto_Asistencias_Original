self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Helper para abrir la BD cruda en el Service Worker
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('afemec-offline-db', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

// Función para sincronizar marcaciones
async function syncPunches() {
  try {
    const db = await openDB();
    const transaction = db.transaction('punches', 'readwrite');
    const store = transaction.objectStore('punches');
    const index = store.index('by-sync');
    
    return new Promise((resolve, reject) => {
      const getRequest = index.getAll(IDBKeyRange.only(false));
      
      getRequest.onsuccess = async () => {
        const punches = getRequest.result;
        
        if (!punches || punches.length === 0) {
          return resolve();
        }

        for (const punch of punches) {
          try {
            // Enviar al servidor original
            const response = await fetch('/api/asistencias', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              // Añadimos un flag offline_sync para que el backend sepa que es diferido y confíe en el timestamp
              body: JSON.stringify({ ...punch, offline_sync: true })
            });

            if (response.ok) {
              // Eliminar de IDB tras sincronizar
              const delTransaction = db.transaction('punches', 'readwrite');
              delTransaction.objectStore('punches').delete(punch.id);
            }
          } catch (err) {
            console.error('SW: Error enviando punch offline:', err);
            // Falló, se intentará de nuevo en el próximo sync
          }
        }
        resolve();
      };
      
      getRequest.onerror = () => reject(getRequest.error);
    });
  } catch (error) {
    console.error('SW: Fallo al abrir DB', error);
  }
}

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-punches') {
    console.log('SW: Ejecutando Background Sync para marcaciones');
    event.waitUntil(syncPunches());
  }
});

// Listener de mensajes para forzar sincronización desde la UI (Fallback para iOS)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'FORCE_SYNC') {
    console.log('SW: Sincronización forzada desde la UI');
    event.waitUntil(syncPunches());
  }
});
