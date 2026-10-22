'use client';

import { useEffect, useRef, useState } from 'react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { 
  CheckCircle2, 
  ScanFace, 
  Camera as CameraIcon, 
  CameraOff, 
  RefreshCw, 
  Lock, 
  Loader2, 
  Image as ImageIcon,
  AlertTriangle,
  ExternalLink,
  Copy,
  Check
} from 'lucide-react';

interface LivenessCameraProps {
  onCapture: (base64Image: string) => void;
}

export default function LivenessCamera({ onCapture }: LivenessCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const requestRef = useRef<number | null>(null);

  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [instruction, setInstruction] = useState('Iniciando cámara...');
  const [cameraError, setCameraError] = useState<'permission_denied' | 'not_supported' | 'unknown' | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const startCamera = async (isMounted = true) => {
    setCameraError(null);
    setIsVideoPlaying(false);
    setInstruction('Iniciando cámara...');

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('NOT_SUPPORTED');
      }

      let stream: MediaStream | null = null;
      
      // 1er intento: cámara frontal con resolución ideal
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'user' },
            width: { ideal: 640 },
            height: { ideal: 480 }
          },
          audio: false
        });
      } catch (e1) {
        // 2do intento: cualquier configuración frontal
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user' },
            audio: false
          });
        } catch (e2) {
          // 3er intento: cualquier cámara disponible
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
          });
        }
      }

      if (!isMounted) {
        stream?.getTracks().forEach(t => t.stop());
        return;
      }

      streamRef.current = stream;

      if (videoRef.current) {
        const video = videoRef.current;
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        video.setAttribute('webkit-playsinline', 'true');
        video.muted = true;

        // Forzar reproducción al cargar metadatos para móviles
        video.onloadedmetadata = async () => {
          try {
            await video.play();
            if (isMounted) setIsVideoPlaying(true);
          } catch (playErr) {
            console.warn('Auto-play diferido:', playErr);
          }
        };

        // Intento inmediato de play
        try {
          await video.play();
          if (isMounted) setIsVideoPlaying(true);
        } catch (err) {
          // Manejado por onloadedmetadata o interacción
        }
      }

      // Carga de IA desacoplada (no bloquea el video si tarda o falla en móviles)
      initMediaPipe(isMounted);

    } catch (err: any) {
      console.error('Error al inicializar cámara:', err);
      if (!isMounted) return;

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('permission_denied');
        setInstruction('Permiso de cámara bloqueado en el navegador.');
      } else if (err.message === 'NOT_SUPPORTED') {
        setCameraError('not_supported');
        setInstruction('Navegador sin soporte de video en vivo.');
      } else {
        setCameraError('unknown');
        setInstruction('No se pudo acceder a la cámara frontal.');
      }
    }
  };

  const initMediaPipe = async (mounted: boolean) => {
    try {
      if (mounted) setInstruction('Cámara lista. Cargando detector...');

      // Temporizador de seguridad: Si la IA tarda más de 5 segundos (conexión móvil lenta),
      // habilitamos la captura para no dejar bloqueado al empleado.
      const safetyTimer = setTimeout(() => {
        if (mounted && !isVerified) {
          setIsModelLoaded(true);
          setIsVerified(true);
          setInstruction('Cámara lista. Ya puedes tomar la foto.');
        }
      }, 5000);

      const filesetResolver = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
      );
      
      faceLandmarkerRef.current = await FaceLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
          delegate: "GPU"
        },
        outputFaceBlendshapes: true,
        runningMode: "VIDEO",
        numFaces: 1
      });

      clearTimeout(safetyTimer);

      if (mounted) {
        setIsModelLoaded(true);
        setInstruction('Por favor, PARPADEA para confirmar tu identidad');
        detectLiveness();
      }
    } catch (aiErr) {
      console.warn('MediaPipe no soportado en esta GPU/móvil, activando modo manual:', aiErr);
      if (mounted) {
        setIsModelLoaded(true);
        setIsVerified(true);
        setInstruction('Cámara lista. Ya puedes tomar la foto.');
      }
    }
  };

  useEffect(() => {
    let isMounted = true;
    startCamera(isMounted);

    return () => {
      isMounted = false;
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
      if (faceLandmarkerRef.current) faceLandmarkerRef.current.close();
    };
  }, []);

  const detectLiveness = () => {
    if (!videoRef.current || !faceLandmarkerRef.current || isVerified) return;

    const video = videoRef.current;
    
    if (video.currentTime > 0 && !video.paused && !video.ended) {
      try {
        const results = faceLandmarkerRef.current.detectForVideo(video, performance.now());
        if (results.faceBlendshapes && results.faceBlendshapes.length > 0) {
          const blendshapes = results.faceBlendshapes[0].categories;
          const eyeBlinkLeft = blendshapes.find(b => b.categoryName === 'eyeBlinkLeft')?.score || 0;
          const eyeBlinkRight = blendshapes.find(b => b.categoryName === 'eyeBlinkRight')?.score || 0;

          if (eyeBlinkLeft > 0.4 && eyeBlinkRight > 0.4) {
            setIsVerified(true);
            setInstruction('¡Identidad verificada! Ya puedes tomar la foto.');
            return;
          }
        }
      } catch (e) {
        // En caso de micro-error en frame, no romper el loop
      }
    }

    if (!isVerified) {
      requestRef.current = requestAnimationFrame(detectLiveness);
    }
  };

  const handleSnap = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      onCapture(dataUrl);
    }
  };

  const handleFallbackFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          onCapture(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  return (
    <div className="flex flex-col items-center w-full max-w-sm mx-auto space-y-4">
      {/* Input nativo oculto para abrir cámara de celular directamente si falla WebRTC */}
      <input 
        ref={fileInputRef}
        type="file" 
        accept="image/*" 
        capture="user" 
        className="hidden" 
        onChange={handleFallbackFile}
      />

      {/* CASO: PERMISO DE CÁMARA BLOQUEADO O NO DISPONIBLE */}
      {cameraError ? (
        <div className="w-full bg-gradient-to-b from-amber-50 to-red-50 border-2 border-red-300 rounded-3xl p-5 shadow-xl animate-in fade-in zoom-in-95 duration-300 text-left">
          
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-red-600 text-white rounded-2xl shadow-md shrink-0 animate-bounce">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-red-950 text-base leading-tight">
                ⚠️ Habilite la cámara para continuar
              </h3>
              <p className="text-xs text-red-800 font-medium">
                Tu navegador tiene bloqueado el acceso a la cámara
              </p>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 border border-red-100 shadow-sm space-y-3 mb-4">
            <p className="text-xs font-bold text-gray-800 uppercase tracking-wider">
              Cómo desbloquearla en 3 pasos:
            </p>

            <div className="flex items-start gap-2.5 text-xs text-gray-700">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-red-100 text-red-800 font-bold shrink-0 mt-0.5">
                1
              </span>
              <p>
                Toca el <strong>ícono del candado 🔒</strong> (o ajustes del sitio) arriba a la izquierda, en la barra de direcciones.
              </p>
            </div>

            <div className="flex items-start gap-2.5 text-xs text-gray-700">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-red-100 text-red-800 font-bold shrink-0 mt-0.5">
                2
              </span>
              <p>
                Busca la opción <strong>Cámara</strong> y cámbiala a <strong>&quot;Permitir&quot;</strong> (o activa el interruptor azul).
              </p>
            </div>

            <div className="flex items-start gap-2.5 text-xs text-gray-700">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-red-100 text-red-800 font-bold shrink-0 mt-0.5">
                3
              </span>
              <p>
                Toca el botón verde de abajo <strong>&quot;Reintentar cámara&quot;</strong>.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => startCamera(true)}
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-2xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              🔄 Ya la habilité, Reintentar cámara
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-3 px-4 bg-red-800 hover:bg-red-900 active:scale-95 text-white font-bold rounded-2xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-red-900/30 transition-all"
            >
              <CameraIcon className="w-4 h-4" />
              📸 Abrir cámara del teléfono directamente
            </button>

            <button
              type="button"
              onClick={handleCopyLink}
              className="w-full py-2.5 px-3 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 font-semibold rounded-2xl text-xs flex items-center justify-center gap-2 transition-all mt-1"
            >
              {copiedLink ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-700">¡Enlace copiado! Ábrelo en Chrome</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-gray-500" />
                  <span>Copiar enlace para abrir en Google Chrome</span>
                </>
              )}
            </button>
          </div>

        </div>
      ) : (
        /* CASO NORMAL: VISOR DE CÁMARA ACTIVO */
        <>
          <div className="relative w-full aspect-[3/4] bg-slate-900 rounded-2xl overflow-hidden shadow-xl border-4 border-gray-800 flex items-center justify-center">
            
            {/* Elemento de Video */}
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              onPlaying={() => setIsVideoPlaying(true)}
              className="absolute inset-0 w-full h-full object-cover transform -scale-x-100"
            />

            {/* Spinner de carga antes de que el video empiece a reproducirse */}
            {!isVideoPlaying && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 text-gray-300 z-10 gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-red-600" />
                <span className="text-xs font-medium">Conectando cámara...</span>
              </div>
            )}

            {/* Guía visual (óvalo facial) */}
            {isVideoPlaying && !isVerified && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className={`w-2/3 h-1/2 border-2 border-dashed rounded-[100%] transition-colors duration-300 ${isModelLoaded ? 'border-red-500 animate-pulse' : 'border-gray-400'}`}></div>
              </div>
            )}

            {/* Verificación exitosa */}
            {isVerified && (
              <div className="absolute inset-0 border-4 border-green-500 pointer-events-none">
                <div className="absolute top-4 right-4 bg-green-500 text-white rounded-full p-1.5 shadow-lg animate-in zoom-in">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
              </div>
            )}
          </div>

          {/* Cartel de instrucciones */}
          <div className={`w-full p-3.5 rounded-xl text-center shadow-inner font-medium transition-colors ${isVerified ? 'bg-green-100 text-green-800' : 'bg-blue-50 text-blue-900'}`}>
            <div className="flex items-center justify-center gap-2 mb-0.5">
              <ScanFace className="w-4 h-4 shrink-0" />
              <p className="text-sm font-semibold">{instruction}</p>
            </div>
            {!isVerified && isModelLoaded && (
              <p className="text-xs opacity-75">Parpadea mirando a la cámara o espera unos segundos.</p>
            )}
          </div>

          {/* Botón de Captura principal */}
          <button
            type="button"
            disabled={!isVerified}
            onClick={handleSnap}
            className={`w-full py-3.5 rounded-xl flex items-center justify-center gap-2 font-bold text-base transition-all shadow-lg ${
              isVerified 
                ? 'bg-red-800 text-white hover:bg-red-900 active:scale-95' 
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            <CameraIcon className="w-5 h-5" />
            Tomar Foto y Marcar
          </button>

          {/* Opción de respaldo accesible siempre */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-xs text-gray-500 hover:text-red-800 hover:underline flex items-center gap-1.5 pt-1 transition-colors"
          >
            <ImageIcon className="w-3.5 h-3.5" />
            ¿Problemas con el video? Usar cámara nativa del teléfono
          </button>
        </>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
