'use client';

import { useEffect, useState } from 'react';
import { Download, X, Laptop, Smartphone } from 'lucide-react';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Si ya está ejecutándose como aplicación instalada (standalone), no mostrar nada
    const isStandalone = 
      window.matchMedia('(display-mode: standalone)').matches || 
      (window.navigator as any).standalone === true;

    if (isStandalone) return;

    // Detectar iOS
    const isIosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIosDevice);

    // Verificar si el usuario lo descartó recientemente (en las últimas 24 horas)
    const dismissedAt = localStorage.getItem('afemec_install_asistencias_dismissed');
    if (dismissedAt) {
      const hours = (Date.now() - parseInt(dismissedAt, 10)) / (1000 * 60 * 60);
      if (hours < 24) return;
    }

    // Escuchar el evento oficial PWA beforeinstallprompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Esperar 3.5 segundos para que no colisione con la intro inicial
      setTimeout(() => {
        setShow(true);
      }, 3500);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // Para iOS, si no está instalado y no fue descartado, mostrar el tooltip informativo
    if (isIosDevice) {
      setTimeout(() => {
        setShow(true);
      }, 3500);
    }

    const handleAppInstalled = () => {
      setShow(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShow(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem('afemec_install_asistencias_dismissed', Date.now().toString());
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:w-96 z-50 animate-in fade-in slide-in-from-bottom-5 duration-500">
      <div className="bg-white/95 backdrop-blur-md rounded-2xl p-5 shadow-2xl border-2 border-red-800/20 text-gray-800 relative">
        <button 
          onClick={handleDismiss} 
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors p-1"
          aria-label="Cerrar aviso"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center shrink-0 shadow-inner">
            <Download className="w-6 h-6 text-red-800" />
          </div>

          <div className="flex-1 pr-4">
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-800 mb-1">
              <Laptop className="w-3 h-3" />
              <span>AFEMEC OFICIAL</span>
            </div>
            
            <h4 className="font-bold text-gray-900 text-base leading-tight">
              ¿Descargar en el Escritorio?
            </h4>
            
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              Instala el Control de Asistencia para abrirlo directamente con un solo clic sin necesidad del navegador.
            </p>
          </div>
        </div>

        {isIOS && !deferredPrompt ? (
          <div className="mt-3.5 p-2.5 bg-gray-50 rounded-xl border border-gray-200 text-xs text-gray-600">
            📲 En iPhone/iPad: Toca el botón <strong>Compartir</strong> (cuadrado con flecha) y luego <strong>&quot;Agregar a pantalla de inicio&quot;</strong>.
          </div>
        ) : (
          <div className="mt-4 flex gap-2">
            <button
              onClick={handleInstallClick}
              className="flex-1 bg-red-800 hover:bg-red-900 text-white font-bold py-2.5 px-4 rounded-xl text-sm transition-all shadow-md shadow-red-900/20 active:scale-95 flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              Descargar en el Escritorio
            </button>
            <button
              onClick={handleDismiss}
              className="px-3 py-2.5 text-xs text-gray-500 hover:text-gray-700 font-semibold transition-colors"
            >
              Ahora no
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
