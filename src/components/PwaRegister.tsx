'use client';

import { useEffect } from 'react';
import { getUnsyncedPunches } from '@/lib/idb';

export default function PwaRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('SW registrado exitosamente');
        })
        .catch((err) => {
          console.error('Error registrando SW:', err);
        });

      // Escuchar cuando la conexión vuelve (Fallback para iOS y navegadores que no soportan Background Sync)
      window.addEventListener('online', async () => {
        try {
          const unsynced = await getUnsyncedPunches();
          if (unsynced.length > 0 && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({ type: 'FORCE_SYNC' });
          }
        } catch (e) {
          console.error(e);
        }
      });
      
      // Intentar sincronizar cuando el componente se monta (por si se cerró la app mientras estaba offline)
      getUnsyncedPunches().then(unsynced => {
        if (unsynced.length > 0 && navigator.serviceWorker.controller && navigator.onLine) {
          navigator.serviceWorker.controller.postMessage({ type: 'FORCE_SYNC' });
        }
      }).catch(console.error);
    }
  }, []);

  return null;
}
