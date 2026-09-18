'use client';

import { useEffect, useRef, useState } from 'react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { CheckCircle2, ScanFace, Camera as CameraIcon } from 'lucide-react';

interface LivenessCameraProps {
  onCapture: (base64Image: string) => void;
}

export default function LivenessCamera({ onCapture }: LivenessCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [instruction, setInstruction] = useState('Cargando motor de IA...');
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const requestRef = useRef<number>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;

    const initCameraAndAI = async () => {
      try {
        // Iniciar cámara
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        // Cargar MediaPipe FaceLandmarker
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

        setIsModelLoaded(true);
        setInstruction('Por favor, PARPADEA para confirmar tu identidad');
        
        // Empezar detección
        detectLiveness();
      } catch (err) {
        console.error('Error inicializando cámara o IA:', err);
        setInstruction('Error de cámara. Asegúrate de dar permisos.');
      }
    };

    initCameraAndAI();

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (stream) stream.getTracks().forEach(track => track.stop());
      if (faceLandmarkerRef.current) faceLandmarkerRef.current.close();
    };
  }, []);

  const detectLiveness = () => {
    if (!videoRef.current || !faceLandmarkerRef.current || isVerified) return;

    const video = videoRef.current;
    
    // Check if video is playing
    if (video.currentTime > 0 && !video.paused && !video.ended) {
      const results = faceLandmarkerRef.current.detectForVideo(video, performance.now());
      
      if (results.faceBlendshapes && results.faceBlendshapes.length > 0) {
        const blendshapes = results.faceBlendshapes[0].categories;
        const eyeBlinkLeft = blendshapes.find(b => b.categoryName === 'eyeBlinkLeft')?.score || 0;
        const eyeBlinkRight = blendshapes.find(b => b.categoryName === 'eyeBlinkRight')?.score || 0;

        // Umbral típico para parpadeo cerrado
        if (eyeBlinkLeft > 0.4 && eyeBlinkRight > 0.4) {
          setIsVerified(true);
          setInstruction('¡Identidad verificada! Ya puedes tomar la foto.');
          return; // Stop loop
        }
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
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      onCapture(dataUrl);
    }
  };

  return (
    <div className="flex flex-col items-center w-full max-w-sm mx-auto space-y-4">
      <div className="relative w-full aspect-[3/4] bg-black rounded-2xl overflow-hidden shadow-xl border-4 border-gray-800">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted 
          className="absolute inset-0 w-full h-full object-cover transform -scale-x-100"
        />
        
        {/* Guía visual (óvalo facial) */}
        {!isVerified && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className={`w-2/3 h-1/2 border-2 border-dashed rounded-[100%] transition-colors duration-300 ${isModelLoaded ? 'border-red-500 animate-pulse' : 'border-gray-500'}`}></div>
          </div>
        )}

        {/* Capa de Verificación Exitosa */}
        {isVerified && (
          <div className="absolute inset-0 border-4 border-green-500 pointer-events-none">
            <div className="absolute top-4 right-4 bg-green-500 text-white rounded-full p-1 shadow-lg animate-in zoom-in">
              <CheckCircle2 className="w-8 h-8" />
            </div>
          </div>
        )}
      </div>

      <div className={`w-full p-4 rounded-xl text-center shadow-inner font-medium transition-colors ${isVerified ? 'bg-green-100 text-green-800' : 'bg-blue-50 text-blue-800'}`}>
        <div className="flex items-center justify-center gap-2 mb-1">
          <ScanFace className="w-5 h-5" />
          <p>{instruction}</p>
        </div>
        {!isVerified && isModelLoaded && (
          <p className="text-xs opacity-70">Espera que la cámara detecte tu parpadeo.</p>
        )}
      </div>

      <button
        type="button"
        disabled={!isVerified}
        onClick={handleSnap}
        className={`w-full py-4 rounded-xl flex items-center justify-center gap-2 font-bold text-lg transition-all shadow-lg ${
          isVerified 
            ? 'bg-red-800 text-white hover:bg-red-900 active:scale-95' 
            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
        }`}
      >
        <CameraIcon className="w-6 h-6" />
        Tomar Foto y Marcar
      </button>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
