export default function SplashLogo() {
  return (
    <svg 
      width="100" 
      height="100" 
      viewBox="0 0 100 100" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2.5" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className="text-red-200"
    >
      {/* Escudo exterior */}
      <path 
        pathLength={100} 
        className="draw" 
        style={{ "--delay": "0.25s" } as React.CSSProperties} 
        d="M50 5 L10 20 L10 60 C10 80 30 90 50 95 C70 90 90 80 90 60 L90 20 Z" 
      />
      {/* Letra A - Pata izquierda */}
      <path 
        pathLength={100} 
        className="draw" 
        style={{ "--delay": "0.6s" } as React.CSSProperties} 
        d="M50 30 L30 70" 
      />
      {/* Letra A - Pata derecha */}
      <path 
        pathLength={100} 
        className="draw" 
        style={{ "--delay": "0.8s" } as React.CSSProperties} 
        d="M50 30 L70 70" 
      />
      {/* Letra A - Línea del medio */}
      <path 
        pathLength={100} 
        className="draw" 
        style={{ "--delay": "1.0s" } as React.CSSProperties} 
        d="M40 55 L60 55" 
      />
      {/* Punto central técnico */}
      <path 
        pathLength={100} 
        className="draw" 
        style={{ "--delay": "1.2s" } as React.CSSProperties} 
        d="M50 45 L50 45.1" 
        strokeWidth="4"
      />
    </svg>
  );
}
