const CACHE_NAME = 'afemec-cache-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/manifest.json',
  '/logo.jpg',
  '/footer.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Ignorar peticiones que no sean GET. También ignoramos la API, EXCEPTO la ruta de búsqueda de empleados para que funcione offline.
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('/api/') && !event.request.url.includes('/api/employees/')) return;

  // Estrategia: Stale-While-Revalidate (Sirve del caché rápido y actualiza en fondo)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        // Guardar dinámicamente en el caché (Archivos JS, CSS y Modelos de MediaPipe)
        if (networkResponse && networkResponse.status === 200 && (networkResponse.type === 'basic' || networkResponse.type === 'cors')) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Fallback si no hay internet y no está en caché (se retorna el caché previo, si existe)
      });
      
      return cachedResponse || fetchPromise;
    })
  );
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
            const response = await fetch('/api/attendance', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...punch, offline_sync: true })
            });

            if (response.ok) {
              const delTransaction = db.transaction('punches', 'readwrite');
              delTransaction.objectStore('punches').delete(punch.id);
            }
          } catch (err) {
            console.error('SW: Error enviando punch offline:', err);
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

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'FORCE_SYNC') {
    console.log('SW: Sincronización forzada desde la UI');
    event.waitUntil(syncPunches());
  }
});
