'use client';

import { useEffect, useState } from 'react';
import { Download, X, Smartphone, Check, Copy, Share, Menu, MoreVertical } from 'lucide-react';

type BrowserType = 'chrome' | 'samsung' | 'safari-ios' | 'firefox' | 'edge' | 'other';

function getBrowserType(): BrowserType {
  if (typeof window === 'undefined') return 'other';
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
  if (isIOS) return 'safari-ios';
  if (/SamsungBrowser/i.test(ua)) return 'samsung';
  if (/Edg/i.test(ua)) return 'edge';
  if (/Firefox/i.test(ua)) return 'firefox';
  if (/Chrome/i.test(ua)) return 'chrome';
  return 'other';
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [isStandalone, setIsStandalone] = useState(true); // default true to avoid SSR flash
  const [browserType, setBrowserType] = useState<BrowserType>('other');
  const [copiedUrl, setCopiedUrl] = useState(false);

  useEffect(() => {
    // 1. Detectar si la app ya está abierta como PWA instalada
    const checkStandalone = () => {
      return (
        window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: fullscreen)').matches ||
        (window.navigator as any).standalone === true
      );
    };

    if (checkStandalone()) {
      setIsStandalone(true);
      setShowModal(false);
      return;
    }

    setIsStandalone(false);
    setBrowserType(getBrowserType());

    // 2. Capturar evento de instalación nativa (Chrome / Edge / Android)
    if ((window as any).__pwaPrompt) {
      setDeferredPrompt((window as any).__pwaPrompt);
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      (window as any).__pwaPrompt = e;
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsStandalone(true);
      setShowModal(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    // 3. Ajustar tiempo de aparición respetando el Splash Screen (4.1s en primer ingreso)
    const splashAlreadySeen = typeof window !== 'undefined' && sessionStorage.getItem('afemec_splash_seen');
    const delay = splashAlreadySeen ? 900 : 4400;

    const timer = setTimeout(() => {
      setShowModal(true);
    }, delay);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleNativeInstall = async () => {
    const promptEvent = deferredPrompt || (window as any).__pwaPrompt;
    if (promptEvent) {
      try {
        promptEvent.prompt();
        const { outcome } = await promptEvent.userChoice;
        if (outcome === 'accepted') {
          setIsStandalone(true);
          setShowModal(false);
        }
        setDeferredPrompt(null);
        (window as any).__pwaPrompt = null;
      } catch (e) {
        // Fallback visual si falla
      }
    }
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

  if (isStandalone) return null;

  return (
    <>
      {/* Botón flotante accesible cuando el modal se minimiza */}
      {!showModal && (
        <button
          onClick={() => setShowModal(true)}
          className="fixed bottom-4 left-4 z-40 bg-red-800 hover:bg-red-900 text-white px-4 py-2.5 rounded-full shadow-xl border border-red-700 flex items-center gap-2 text-xs font-bold transition-all active:scale-95 animate-in fade-in"
          title="Instalar aplicación en este navegador"
        >
          <Download className="w-4 h-4" />
          <span>Instalar App</span>
        </button>
      )}

      {/* Modal con instrucciones adaptadas para CADA tipo de navegador */}
      {showModal && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:w-[410px] z-50 animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className="bg-white/95 backdrop-blur-md rounded-2xl p-5 shadow-2xl border-2 border-red-800/20 text-gray-800 relative">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors p-1"
              aria-label="Minimizar aviso"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Cabecera */}
            <div className="flex items-start gap-3.5">
              <img
                src="/icon-192.png"
                alt="AFEMEC"
                className="w-12 h-12 rounded-xl border border-gray-200 shadow-sm shrink-0 object-contain bg-white p-0.5"
              />

              <div className="flex-1 pr-5">
                {/* Badge por tipo de navegador */}
                <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide mb-1 bg-red-100 text-red-900 border border-red-200">
                  <Smartphone className="w-3 h-3" />
                  {browserType === 'samsung' && '🟣 Navegador Samsung'}
                  {browserType === 'safari-ios' && '🍏 iPhone / Safari'}
                  {browserType === 'chrome' && '🔵 Google Chrome'}
                  {browserType === 'edge' && '🔷 Microsoft Edge'}
                  {browserType === 'firefox' && '🦊 Mozilla Firefox'}
                  {browserType === 'other' && '🌐 Navegador Web'}
                </div>

                <h4 className="font-extrabold text-gray-900 text-base leading-tight">
                  Instalar Control de Asistencia
                </h4>

                <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                  Agrégala a tu pantalla de inicio para entrar directo sin abrir el navegador.
                </p>
              </div>
            </div>

            {/* Contenido adaptado al navegador */}
            <div className="mt-3.5 p-3.5 bg-gray-50 rounded-xl border border-gray-200 text-xs text-gray-700 space-y-2">
              {/* CASO 1: NAVEGADOR SAMSUNG */}
              {browserType === 'samsung' && (
                <>
                  <p className="font-bold text-purple-900 flex items-center gap-1.5 text-[12px]">
                    <Menu className="w-4 h-4 text-purple-700 shrink-0" />
                    Cómo instalar desde el navegador Samsung:
                  </p>
                  <ol className="list-decimal list-inside space-y-1.5 text-gray-700 pl-1">
                    <li>
                      Toca el menú <strong>☰</strong> (abajo a la derecha) o la flecha <strong>↓</strong> arriba en la barra.
                    </li>
                    <li>
                      Selecciona <strong>&quot;Agregar página a&quot;</strong> → <strong>&quot;Pantalla de inicio&quot;</strong>.
                    </li>
                    <li>
                      Toca <strong>&quot;Agregar&quot;</strong> y listo.
                    </li>
                  </ol>
                  <div className="pt-1.5 border-t border-gray-200">
                    <button
                      onClick={handleCopyLink}
                      className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold flex items-center justify-center gap-1.5 transition-colors text-[11px]"
                    >
                      {copiedUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedUrl ? '¡Enlace copiado! Pégalo en Chrome' : '¿Prefieres Chrome? Copiar enlace'}
                    </button>
                  </div>
                </>
              )}

              {/* CASO 2: IPHONE / IPAD (SAFARI) */}
              {browserType === 'safari-ios' && (
                <>
                  <p className="font-bold text-gray-900 flex items-center gap-1.5 text-[12px]">
                    <Share className="w-4 h-4 text-blue-600 shrink-0" />
                    Cómo instalar en tu iPhone / iPad:
                  </p>
                  <ol className="list-decimal list-inside space-y-1.5 text-gray-700 pl-1">
                    <li>
                      Toca el botón <strong>Compartir</strong> (el ícono del cuadrado con la flecha hacia arriba abajo en Safari).
                    </li>
                    <li>
                      Desliza hacia abajo y elige <strong>&quot;Agregar a pantalla de inicio&quot;</strong>.
                    </li>
                    <li>
                      Toca <strong>&quot;Agregar&quot;</strong> arriba a la derecha.
                    </li>
                  </ol>
                </>
              )}

              {/* CASO 3: GOOGLE CHROME / EDGE (CON O SIN BOTÓN NATIVO) */}
              {(browserType === 'chrome' || browserType === 'edge') && (
                <>
                  {deferredPrompt ? (
                    <div>
                      <p className="text-gray-700 mb-2">
                        Tu navegador permite instalar la aplicación oficial con 1 solo toque:
                      </p>
                      <button
                        onClick={handleNativeInstall}
                        className="w-full bg-red-800 hover:bg-red-900 text-white font-bold py-2.5 px-4 rounded-xl text-sm transition-all shadow-md active:scale-95 flex items-center justify-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        Instalar con 1 Clic
                      </button>
                    </div>
                  ) : (
                    <>
                      <p className="font-bold text-gray-900 flex items-center gap-1.5 text-[12px]">
                        <MoreVertical className="w-4 h-4 text-gray-700 shrink-0" />
                        Cómo instalar desde Chrome / Edge:
                      </p>
                      <ol className="list-decimal list-inside space-y-1.5 text-gray-700 pl-1">
                        <li>
                          Toca el menú de opciones (<strong>⋮</strong> arriba a la derecha).
                        </li>
                        <li>
                          Selecciona <strong>&quot;Instalar aplicación&quot;</strong> o <strong>&quot;Agregar a la pantalla principal&quot;</strong>.
                        </li>
                      </ol>
                    </>
                  )}
                </>
              )}

              {/* CASO 4: FIREFOX / OTROS */}
              {(browserType === 'firefox' || browserType === 'other') && (
                <>
                  <p className="font-bold text-gray-900 flex items-center gap-1.5 text-[12px]">
                    <MoreVertical className="w-4 h-4 text-gray-700 shrink-0" />
                    Cómo instalar en tu navegador:
                  </p>
                  <ol className="list-decimal list-inside space-y-1.5 text-gray-700 pl-1">
                    <li>
                      Toca el menú del navegador (<strong>⋮</strong> o <strong>☰</strong>).
                    </li>
                    <li>
                      Selecciona <strong>&quot;Instalar&quot;</strong> o <strong>&quot;Agregar a pantalla de inicio&quot;</strong>.
                    </li>
                  </ol>
                </>
              )}
            </div>

            {/* Pie del modal */}
            <div className="mt-3 flex justify-between items-center text-xs">
              <span className="text-[11px] text-gray-400">
                Se guardará como app en tu pantalla
              </span>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-500 hover:text-gray-800 font-semibold px-2 py-1"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
