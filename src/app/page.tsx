'use client';

import { useState, useEffect, useRef } from 'react';
import { Camera, MapPin, Loader2, Clock, CheckCircle, Shield, X, Menu } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [ci, setCi] = useState('');
  const [employee, setEmployee] = useState<any>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [observation, setObservation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<boolean>(false);
  const [successName, setSuccessName] = useState('');
  const [successType, setSuccessType] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());

  const [menuOpen, setMenuOpen] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [passwordError, setPasswordError] = useState(false);
  const router = useRouter();

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (ci.length >= 6) {
      const timeoutId = setTimeout(() => {
        handleSearchEmployee(ci);
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [ci]);

  const handleSearchEmployee = async (searchCi: string) => {
    if (!searchCi) return;
    setLoading(true);
    setError('');
    try {
      let res = await fetch('/api/employees/' + searchCi);
      if (!res.ok && res.status >= 500) {
        await new Promise(r => setTimeout(r, 1500));
        res = await fetch('/api/employees/' + searchCi);
      }
      if (res.ok) {
        const data = await res.json();
        setEmployee(data);
      } else if (res.status === 404) {
        setEmployee(null);
        setError('Empleado no encontrado');
      } else {
        setEmployee(null);
        setError('Error del servidor al buscar');
      }
    } catch (e) {
      setError('Error al buscar empleado');
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const requestLocation = (): Promise<{lat: number, lng: number}> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject('Geolocalización no soportada por el navegador');
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => reject('No se pudo obtener la ubicación. ' + err.message)
      );
    });
  };

  const handleAttendance = async (type: 'ENTRADA' | 'SALIDA') => {
    if (!employee || !location) return;
    setLoading(true);
    setError('');
    
    try {
      const payload = {
        ci,
        type,
        latitude: location.lat,
        longitude: location.lng,
        photoBase64,
        observation: observation.trim() || null
      };
      let res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok && res.status >= 500) {
        await new Promise(r => setTimeout(r, 1500));
        res = await fetch('/api/attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }
      
      if (res.ok) {
        setSuccessType(type);
        setSuccessName(`${employee.firstName} ${employee.lastName}`);
        setSuccess(true);
        setTimeout(() => {
          setCi('');
          setEmployee(null);
          setPhotoBase64('');
          setObservation('');
          setSuccess(false);
          setLocation(null);
        }, 3000);
      } else {
        const err = await res.json();
        setError(err.error || 'Error al registrar marcación');
      }
    } catch (e) {
      setError('Error de red al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPassword })
      });
      if (res.ok) {
        router.push('/admin');
      } else {
        setPasswordError(true);
        setTimeout(() => setPasswordError(false), 2000);
      }
    } catch (error) {
      alert('Error de conexión');
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col justify-between items-center px-4 py-6 sm:p-8 relative">
      <div className="absolute top-4 right-4 sm:top-8 sm:right-8 z-40">
        <button 
          onClick={() => setMenuOpen(!menuOpen)}
          className="p-3 bg-white text-gray-700 hover:text-red-800 rounded-full shadow-md border border-gray-200 transition-colors"
        >
          <Menu className="w-6 h-6" />
        </button>

        {menuOpen && (
          <div className="absolute top-14 right-0 w-56 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden animate-in slide-in-from-top-2">
            <button 
              onClick={() => { setMenuOpen(false); setShowLogin(true); }}
              className="w-full px-4 py-3 text-left flex items-center gap-3 text-gray-700 hover:bg-gray-50 hover:text-red-800 transition-colors font-medium"
            >
              <Shield className="w-5 h-5" />
              Panel Administrador
            </button>
          </div>
        )}
      </div>

      {showLogin && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm relative text-black">
            <button 
              onClick={() => { setShowLogin(false); setAdminPassword(''); setPasswordError(false); }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex flex-col items-center mb-6 mt-2">
              <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mb-3">
                <Shield className="w-6 h-6 text-red-800" />
              </div>
              <h2 className="text-xl font-bold text-gray-800">Acceso Restringido</h2>
              <p className="text-sm text-gray-500 mt-1">Ingrese la contraseña administrativa</p>
            </div>
            
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div className="relative">
                <input
                  type={showAdminPassword ? "text" : "password"}
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Contraseña"
                  className={`w-full pl-4 pr-12 py-3 border ${passwordError ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-red-800'} rounded-xl focus:outline-none focus:ring-2`}
                  autoFocus
                />
              </div>
              
              {passwordError && (
                <p className="text-red-500 text-sm font-medium animate-in slide-in-from-top-1">
                  Contraseña incorrecta
                </p>
              )}
              <button 
                type="submit"
                className="w-full bg-red-800 text-white font-bold py-3 rounded-xl hover:bg-red-900 transition-colors shadow-md"
              >
                Ingresar al Panel
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white p-6 sm:p-10 rounded-3xl shadow-xl w-full max-w-md border border-gray-100 flex-grow-0 mb-8 mt-12 sm:mt-0 relative z-10">
        
        <div className="flex flex-col items-center mb-8 pb-6 border-b border-gray-100">
          <img src="/logo.jpg" alt="Logo AFEMEC" className="h-20 sm:h-24 object-contain mb-4" />
          <h1 className="text-2xl sm:text-3xl font-extrabold text-red-900 mb-2">Control de Asistencia</h1>
          
          {!success && (
            <div className="flex flex-col items-center bg-gray-50 px-6 py-3 rounded-2xl border border-gray-100 w-full">
              <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                {new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(currentTime)}
              </span>
              <div className="flex items-center gap-2 mt-1">
                <Clock className="w-5 h-5 text-red-800" />
                <span className="text-2xl font-bold text-gray-900 tracking-wider">
                  {new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(currentTime)}
                </span>
              </div>
            </div>
          )}
        </div>

        {success ? (
          <div className="flex flex-col items-center justify-center p-6 space-y-4 text-green-600 animate-in fade-in duration-500">
            <CheckCircle className="w-20 h-20" />
            <h2 className="text-2xl font-bold text-center">¡Éxito!</h2>
            <p className="text-center text-gray-700 text-lg">
              Ha registrado su {successType} de manera exitosa<br/>
              <span className="font-bold text-black">{successName}</span>
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Cédula de Identidad</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  value={ci}
                  onChange={(e) => {
                    setCi(e.target.value);
                    if (e.target.value === '') setEmployee(null);
                  }}
                  className="flex-1 px-4 py-3 sm:py-2 border rounded-lg focus:ring-2 focus:ring-red-800 outline-none text-black text-lg sm:text-base"
                  placeholder="Ej: 1234567"
                />
                <button
                  onClick={() => handleSearchEmployee(ci)}
                  disabled={loading || !ci}
                  className="bg-red-800 text-white px-5 py-3 sm:py-2 rounded-lg hover:bg-red-900 disabled:opacity-50 font-medium"
                >
                  {loading && !employee ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Buscar'}
                </button>
              </div>
            </div>

            {error && <p className="text-red-500 text-sm text-center font-medium">{error}</p>}

            {employee && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg animate-in slide-in-from-top-4">
                <p className="text-sm text-green-800 font-semibold mb-1">Empleado verificado:</p>
                <p className="text-xl font-bold text-gray-800">{employee.firstName} {employee.lastName}</p>
              </div>
            )}

            {employee && (
              <div className="space-y-5 animate-in fade-in duration-500">
                <div className="flex flex-col items-center gap-4 mt-2">
                  <input
                    type="file"
                    accept="image/*"
                    capture="user"
                    ref={fileInputRef}
                    onChange={handlePhotoCapture}
                    className="hidden"
                  />
                  
                  {photoBase64 ? (
                    <div className="relative">
                      <img src={photoBase64} alt="Selfie" className="w-40 h-40 sm:w-48 sm:h-48 rounded-full object-cover border-4 border-red-100 shadow-sm" />
                      <button onClick={() => setPhotoBase64('')} className="absolute bottom-2 right-2 bg-red-600 text-white rounded-full px-3 py-1 text-xs hover:bg-red-700 shadow-md font-medium">
                        Cambiar
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex flex-col items-center justify-center gap-2 w-40 h-40 sm:w-48 sm:h-48 bg-gray-100 text-gray-600 rounded-full border-2 border-dashed border-gray-300 hover:bg-gray-200 hover:text-red-800 transition-colors"
                    >
                      <Camera className="w-10 h-10 sm:w-12 sm:h-12" />
                      <span className="font-medium text-sm sm:text-base">Tomar Selfie</span>
                    </button>
                  )}
                </div>

                <div className="pt-2">
                  <label className="text-sm font-medium text-gray-700 block mb-1">Observación (Opcional)</label>
                  <textarea
                    value={observation}
                    onChange={(e) => setObservation(e.target.value)}
                    placeholder="Ej: Llegué tarde por lluvia..."
                    className="w-full px-4 py-3 sm:py-2 border rounded-lg focus:ring-2 focus:ring-red-800 outline-none text-black resize-none text-base"
                    rows={2}
                  />
                </div>

                {!location ? (
                  <div className="pt-2 flex flex-col gap-2">
                    <button
                      onClick={async () => {
                        setLoading(true);
                        setError('');
                        try {
                          const loc = await requestLocation();
                          setLocation(loc);
                        } catch (e) {
                          setError(e as string + ' (Revisa que el sitio tenga permiso de ubicación)');
                        } finally {
                          setLoading(false);
                        }
                      }}
                      disabled={loading || !photoBase64}
                      className="flex justify-center items-center py-4 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 disabled:opacity-50 shadow-md transition-transform active:scale-95 w-full"
                    >
                      {loading ? <Loader2 className="animate-spin" /> : '📍 Permitir y Obtener Ubicación'}
                    </button>
                  </div>
                ) : (
                  <div className="pt-2 animate-in fade-in zoom-in duration-300">
                    <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-2 rounded-lg mb-4 flex items-center justify-center gap-2 font-medium">
                      <MapPin className="w-5 h-5" /> Ubicación Obtenida
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:gap-4">
                      <button
                        onClick={() => handleAttendance('ENTRADA')}
                        disabled={loading}
                        className="flex justify-center items-center py-4 bg-green-600 text-white rounded-xl font-bold text-lg sm:text-xl hover:bg-green-700 disabled:opacity-50 shadow-md transition-transform active:scale-95"
                      >
                        {loading ? <Loader2 className="animate-spin" /> : 'ENTRADA'}
                      </button>
                      <button
                        onClick={() => handleAttendance('SALIDA')}
                        disabled={loading}
                        className="flex justify-center items-center py-4 bg-red-600 text-white rounded-xl font-bold text-lg sm:text-xl hover:bg-red-700 disabled:opacity-50 shadow-md transition-transform active:scale-95"
                      >
                        {loading ? <Loader2 className="animate-spin" /> : 'SALIDA'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <div className="w-full max-w-md flex justify-center pb-4 opacity-90 hover:opacity-100 transition-opacity">
        <img src="/footer.png" alt="Desarrollado por AR Software Engineer" className="w-64 sm:w-80 object-contain mix-blend-multiply" />
      </div>
    </main>
  );
}
