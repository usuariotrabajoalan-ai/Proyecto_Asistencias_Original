'use client';

import { useState } from 'react';
import { Shield } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AdminLoginForm() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      
      if (res.ok) {
        router.refresh();
      } else {
        setError(true);
        setTimeout(() => setError(false), 2000);
      }
    } catch (err) {
      alert('Error de conexión al servidor.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm relative text-black border border-gray-100">
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4 shadow-inner">
            <Shield className="w-8 h-8 text-red-800" />
          </div>
          <h2 className="text-2xl font-extrabold text-gray-800">Panel Restringido</h2>
          <p className="text-sm text-gray-500 mt-2 text-center">Por favor, ingresa tu contraseña para acceder a la administración</p>
        </div>
        
        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña"
              className={`w-full px-4 py-3 border ${error ? 'border-red-500 bg-red-50' : 'border-gray-300'} rounded-xl focus:outline-none focus:ring-2 focus:ring-red-800 transition-colors text-lg`}
              autoFocus
            />
            {error && (
              <p className="text-red-500 text-sm font-medium mt-2 text-center animate-pulse">
                Contraseña incorrecta
              </p>
            )}
          </div>
          
          <button 
            type="submit"
            className="w-full bg-red-800 text-white font-bold py-3.5 rounded-xl hover:bg-red-900 transition-colors shadow-lg shadow-red-900/20 active:scale-95"
          >
            Ingresar al Panel
          </button>
        </form>
        
        <div className="mt-6 pt-6 border-t border-gray-100 text-center">
          <Link href="/" className="text-sm text-gray-500 hover:text-red-800 font-medium transition-colors">
            ← Volver al Fichero Principal
          </Link>
        </div>
      </div>
    </div>
  );
}
