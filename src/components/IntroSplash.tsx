'use client';

import { useEffect, useState } from 'react';
import SplashLogo from './SplashLogo';
import './intro.css';

export default function IntroSplash() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Check if the splash has already been shown in this session
    const hasSeenSplash = sessionStorage.getItem('afemec_splash_seen');
    
    if (!hasSeenSplash) {
      setShow(true);
      sessionStorage.setItem('afemec_splash_seen', 'true');
      
      // The animation unmounts at 4.1s
      const timer = setTimeout(() => {
        setShow(false);
      }, 4100);
      
      return () => clearTimeout(timer);
    }
  }, []);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] wipe flex flex-col items-center justify-center pointer-events-none bg-red-900">
      {/* Fondo técnico de cuadrícula */}
      <div className="absolute inset-0 grid-fade grid-steel"></div>
      
      {/* Contenido principal */}
      <div className="relative z-10 flex flex-col items-center">
        <SplashLogo />
        
        {/* Título animado en cascada */}
        <div className="mt-8 flex gap-3 text-4xl sm:text-5xl font-extrabold text-white tracking-widest uppercase">
          <span className="rise drop-shadow-md" style={{ "--delay": "1.85s" } as React.CSSProperties}>SISTEMA</span>
          <span className="rise drop-shadow-md text-red-200" style={{ "--delay": "2.0s" } as React.CSSProperties}>AFEMEC</span>
        </div>
        
        {/* Línea divisoria */}
        <div 
          className="w-full h-[2px] bg-red-400/50 mt-5 rule-grow shadow-[0_0_10px_rgba(248,113,113,0.5)]"
          style={{ "--delay": "2.3s" } as React.CSSProperties}
        ></div>
        
        {/* Subtítulo */}
        <span 
          className="rise mt-5 text-red-100 tracking-[0.3em] text-sm sm:text-base font-bold bg-black/20 px-4 py-1.5 rounded-full"
          style={{ "--delay": "2.5s" } as React.CSSProperties}
        >
          CONTROL DE ASISTENCIAS
        </span>
      </div>
    </div>
  );
}
