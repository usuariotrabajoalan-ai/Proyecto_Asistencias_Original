'use client';

import { useEffect, useState } from 'react';
import { Download, X, Smartphone, CheckCircle2, Copy, Check } from 'lucide-react';

const STORAGE_INSTALLED_KEY = 'afemec_asistencias_installed_v2';
const STORAGE_SEEN_ONCE_KEY = 'afemec_asistencias_seen_once_v2';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [isInstalled, setIsInstalled] = useState(true); // empieza true en SSR para evitar parpadeo
  const [isIOS, setIsIOS] = useState(false);
  const [isSamsung, setIsSamsung] = useState(false);
  const [showManualGuide, setShowManualGuide] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  useEffect(() => {
    // 1. Verificar si ya está corriendo como App instalada (standalone)
    const standaloneMatch =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      (window.navigator as any).standalone === true;

    const alreadyMarkedInstalled = localStorage.getItem(STORAGE_INSTALLED_KEY) === 'true';

    if (standaloneMatch || alreadyMarkedInstalled) {
      localStorage.setItem(STORAGE_INSTALLED_KEY, 'true');
      setIsInstalled(true);
      setShowModal(false);
      return;
    }

    setIsInstalled(false);

    // 2. Detectar navegador (iOS Safari o Samsung Internet)
    const ua = navigator.userAgent || '';
    const ios = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    const samsung = /SamsungBrowser/i.test(ua);
    setIsIOS(ios);
    setIsSamsung(samsung);

    // 3. Capturar prompt nativo si se disparó antes de la hidratación de React
    if ((window as any).__pwaPrompt) {
      setDeferredPrompt((window as any).__pwaPrompt);
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      (window as any).__pwaPrompt = e;
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      localStorage.setItem(STORAGE_INSTALLED_KEY, 'true');
      localStorage.setItem(STORAGE_SEEN_ONCE_KEY, 'true');
      setIsInstalled(true);
      setShowModal(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    // 4. Mostrar automáticamente UNA SOLA VEZ si nunca lo ha visto ni instalado
    const seenOnce = localStorage.getItem(STORAGE_SEEN_ONCE_KEY) === 'true';
    let timer: NodeJS.Timeout | null = null;
    if (!seenOnce) {
      timer = setTimeout(() => {
        setShowModal(true);
      }, 1800);
    }

    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    const promptEvent = deferredPrompt || (window as any).__pwaPrompt;
    if (promptEvent) {
      try {
        promptEvent.prompt();
        const { outcome } = await promptEvent.userChoice;
        if (outcome === 'accepted') {
          localStorage.setItem(STORAGE_INSTALLED_KEY, 'true');
          localStorage.setItem(STORAGE_SEEN_ONCE_KEY, 'true');
          setIsInstalled(true);
          setShowModal(false);
        }
        setDeferredPrompt(null);
        (window as any).__pwaPrompt = null;
      } catch (err) {
        setShowManualGuide(true);
      }
    } else {
      setShowManualGuide(true);
    }
  };

  const handleDismissOnce = () => {
    localStorage.setItem(STORAGE_SEEN_ONCE_KEY, 'true');
    setShowModal(false);
    setShowManualGuide(false);
  };

  const handleMarkAlreadyInstalled = () => {
    localStorage.setItem(STORAGE_INSTALLED_KEY, 'true');
    localStorage.setItem(STORAGE_SEEN_ONCE_KEY, 'true');
    setIsInstalled(true);
    setShowModal(false);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 3000);
    } catch (e) {
      // Fallback
    }
  };

  if (isInstalled) return null;

  return (
    <>
      {/* Botón discreto flotante cuando el aviso fue cerrado pero aún no se instaló */}
      {!showModal && (
        <button
          onClick={() => {
            setShowManualGuide(false);
            setShowModal(true);
          }}
          className="fixed bottom-4 left-4 z-40 bg-red-800 hover:bg-red-900 text-white px-3.5 py-2 rounded-full shadow-lg border border-red-700 flex items-center gap-2 text-xs font-bold transition-all active:scale-95"
          title="Instalar aplicación en el teléfono o escritorio"
        >
          <Download className="w-4 h-4" />
          <span>Instalar App</span>
        </button>
      )}

      {/* Aviso Inteligente de Instalación */}
      {showModal && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:w-96 z-50 animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className="bg-white/95 backdrop-blur-md rounded-2xl p-5 shadow-2xl border-2 border-red-800/20 text-gray-800 relative">
            <button
              onClick={handleDismissOnce}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors p-1"
              aria-label="Cerrar aviso"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-start gap-3.5">
              <img
                src="/icon-192.png"
                alt="AFEMEC"
                className="w-12 h-12 rounded-xl border border-gray-200 shadow-sm shrink-0 object-contain bg-white p-0.5"
              />

              <div className="flex-1 pr-5">
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 mb-1">
                  <Smartphone className="w-3 h-3" />
                  <span>APP OFICIAL AFEMEC</span>
                </div>

                <h4 className="font-bold text-gray-900 text-base leading-tight">
                  Instalar Control de Asistencia
                </h4>

                <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                  Descárgala en tu pantalla principal o escritorio para entrar directo con un toque, sin usar el navegador.
                </p>
              </div>
            </div>

            {showManualGuide ? (
              <div className="mt-3.5 p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs text-gray-700 space-y-2">
                {isIOS ? (
                  <>
                    <p className="font-bold text-gray-900">📲 Cómo instalar en iPhone / iPad:</p>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Toca el botón <strong>Compartir</strong> (cuadrado con flecha hacia arriba en Safari).</li>
                      <li>Elige <strong>&quot;Agregar a pantalla de inicio&quot;</strong> y toca <strong>Agregar</strong>.</li>
                    </ol>
                  </>
                ) : isSamsung ? (
                  <>
                    <p className="font-bold text-amber-900">💡 Recomendación para Samsung:</p>
                    <p>
                      El navegador de Samsung a veces muestra alertas de Play Protect. Para instalarla <strong>100% verificada</strong>, abre este enlace en <strong>Google Chrome</strong>:
                    </p>
                    <button
                      onClick={handleCopyLink}
                      className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      {copiedUrl ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copiedUrl ? '¡Enlace copiado! Pégalo en Chrome' : 'Copiar enlace para abrir en Chrome'}
                    </button>
                    <p className="text-[11px] text-gray-500 pt-1">
                      O en Samsung toca el menú <strong>☰</strong> (abajo a la derecha) → <strong>Agregar página a</strong> → <strong>Pantalla de inicio</strong>.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-bold text-gray-900">📲 Instalación rápida desde el menú:</p>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Toca el menú de opciones del navegador (<strong>⋮</strong> arriba a la derecha).</li>
                      <li>Selecciona <strong>&quot;Instalar aplicación&quot;</strong> o <strong>&quot;Agregar a la pantalla principal&quot;</strong>.</li>
                    </ol>
                  </>
                )}

                <div className="pt-2 flex justify-between items-center border-t border-gray-200 mt-2">
                  <button
                    onClick={handleMarkAlreadyInstalled}
                    className="text-[11px] text-green-700 font-bold hover:underline flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Ya la instalé, no mostrar más
                  </button>
                  <button
                    onClick={handleDismissOnce}
                    className="text-xs text-gray-500 font-semibold hover:text-gray-800"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                <div className="flex gap-2">
                  <button
                    onClick={handleInstallClick}
                    className="flex-1 bg-red-800 hover:bg-red-900 text-white font-bold py-2.5 px-4 rounded-xl text-sm transition-all shadow-md shadow-red-900/20 active:scale-95 flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Instalar Ahora
                  </button>
                  <button
                    onClick={handleDismissOnce}
                    className="px-3 py-2.5 text-xs text-gray-500 hover:text-gray-700 font-semibold transition-colors"
                  >
                    Más tarde
                  </button>
                </div>
                <div className="flex justify-center">
                  <button
                    onClick={handleMarkAlreadyInstalled}
                    className="text-[11px] text-gray-400 hover:text-gray-600 underline transition-colors"
                  >
                    Ya la tengo instalada (no volver a mostrar)
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
