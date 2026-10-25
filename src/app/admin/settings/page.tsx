'use client';

import { useState, useRef } from 'react';
import { 
  Lock, 
  Save, 
  Loader2, 
  CheckCircle, 
  Eye, 
  EyeOff, 
  Database, 
  Download, 
  UploadCloud, 
  ShieldCheck, 
  FileText, 
  HardDrive 
} from 'lucide-react';

export default function SettingsPage() {
  // Estados para Cambio de Contraseña
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  
  // Estado para ver la contraseña
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Estados para Copia de Seguridad
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [backupMessage, setBackupMessage] = useState<{ text: string; type: 'success' | 'error' | '' }>({ text: '', type: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setMessage({ text: 'Las contraseñas nuevas no coinciden.', type: 'error' });
      return;
    }
    if (newPassword.length < 4) {
      setMessage({ text: 'La nueva contraseña debe tener al menos 4 caracteres.', type: 'error' });
      return;
    }

    setLoading(true);
    setMessage({ text: '', type: '' });

    try {
      const res = await fetch('/api/auth', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      if (res.ok) {
        setMessage({ text: 'Contraseña actualizada exitosamente.', type: 'success' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        const data = await res.json();
        setMessage({ text: data.error || 'Error al actualizar.', type: 'error' });
      }
    } catch (e) {
      setMessage({ text: 'Error de conexión.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadBackup = async () => {
    setBackupLoading(true);
    setBackupMessage({ text: '', type: '' });
    try {
      const res = await fetch('/api/admin/backup');
      if (!res.ok) {
        throw new Error('Error al descargar copia de seguridad');
      }
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Respaldo_AFEMEC_Asistencias_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setBackupMessage({
        text: `Copia descargada exitosamente en tu computadora (${data.counts?.employees || 0} funcionarios y ${data.counts?.attendances || 0} marcaciones con fotos incluidas).`,
        type: 'success'
      });
    } catch (e) {
      setBackupMessage({ text: 'Error al generar la copia de seguridad.', type: 'error' });
    } finally {
      setBackupLoading(false);
    }
  };

  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm(`¿Estás seguro de restaurar los datos desde el archivo "${file.name}"? Los datos existentes se actualizarán y los faltantes se incorporarán de forma segura.`)) {
      e.target.value = '';
      return;
    }

    setRestoreLoading(true);
    setBackupMessage({ text: '', type: '' });

    try {
      const text = await file.text();
      const json = JSON.parse(text);

      const res = await fetch('/api/admin/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(json)
      });

      const result = await res.json();
      if (res.ok) {
        setBackupMessage({
          text: `Restauración exitosa: se sincronizaron ${result.restoredEmployees} funcionarios y ${result.restoredAttendances} marcaciones en la base de datos.`,
          type: 'success'
        });
      } else {
        setBackupMessage({ text: result.error || 'Error al procesar el archivo de respaldo.', type: 'error' });
      }
    } catch (err) {
      setBackupMessage({ text: 'El archivo seleccionado no tiene un formato válido de respaldo de AFEMEC.', type: 'error' });
    } finally {
      setRestoreLoading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-8">
      
      {/* Encabezado General */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <ShieldCheck className="w-7 h-7 text-red-800" />
          Seguridad, Accesos y Respaldo
        </h1>
        <p className="text-gray-500 mt-1 text-sm">Gestiona la clave del administrador y descarga copias de seguridad completas de toda la base de datos</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Módulo 1: Copia de Seguridad Inmutable (Tu control total) */}
        <div className="bg-white p-6 sm:p-7 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="p-2 bg-red-50 text-red-800 rounded-xl">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-800">Copia de Seguridad Local</h2>
                <span className="text-xs text-green-700 bg-green-50 font-semibold px-2 py-0.5 rounded border border-green-200">
                  Respaldo 100% Inmutable
                </span>
              </div>
            </div>

            <p className="text-sm text-gray-600 mb-4 leading-relaxed">
              Descarga un archivo con <strong>todos los funcionarios, marcaciones históricas, fotos y coordenadas</strong> directamente a tu computadora.
            </p>

            <div className="bg-gray-50 rounded-xl p-3.5 mb-5 border border-gray-200/70 text-xs text-gray-600 space-y-2">
              <p className="font-bold text-gray-700 flex items-center gap-1.5">
                <HardDrive className="w-4 h-4 text-red-800 shrink-0" />
                ¿Para qué sirve esta copia y dónde usarla?
              </p>
              <ul className="list-disc pl-4 space-y-1 text-gray-600 leading-normal">
                <li><strong>Tu seguro de vida:</strong> Guárdala en tu PC, pendrive o Google Drive. Nadie la puede borrar.</li>
                <li><strong>Restauración en caso de desastre:</strong> Si se borrara la base de datos o cambiaras de servidor, puedes subir este mismo archivo y el sistema revive con todos los datos.</li>
                <li><strong>Auditoría legal y fiscal:</strong> Contiene el registro oficial de asistencias en formato abierto y transparente.</li>
              </ul>
            </div>
          </div>

          <div>
            {backupMessage.text && (
              <div className={`p-3 rounded-xl mb-4 text-xs font-medium flex items-start gap-2 ${
                backupMessage.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
              }`}>
                {backupMessage.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" /> : null}
                <span>{backupMessage.text}</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={handleDownloadBackup}
                disabled={backupLoading || restoreLoading}
                className="flex-1 flex items-center justify-center gap-2 bg-red-800 hover:bg-red-900 disabled:opacity-50 text-white px-4 py-3 rounded-xl text-sm font-semibold transition-all shadow-sm"
              >
                {backupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Descargar Copia (.JSON)
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={backupLoading || restoreLoading}
                className="flex items-center justify-center gap-2 bg-gray-50 hover:bg-gray-100 disabled:opacity-50 text-gray-700 border border-gray-300 px-4 py-3 rounded-xl text-sm font-semibold transition-all"
                title="Subir un archivo previamente descargado para restaurar los datos"
              >
                {restoreLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                Restaurar
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleRestoreFile}
              />
            </div>
          </div>
        </div>

        {/* Módulo 2: Cambio de Contraseña de Administrador */}
        <div className="bg-white p-6 sm:p-7 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="p-2 bg-gray-100 text-gray-700 rounded-xl">
                <Lock className="w-5 h-5 text-gray-700" />
              </div>
              <h2 className="text-lg font-bold text-gray-800">Contraseña de Administrador</h2>
            </div>

            <p className="text-sm text-gray-500 mb-5">
              Actualiza periódicamente la clave para asegurar el acceso al panel.
            </p>

            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Contraseña Actual</label>
                <div className="relative">
                  <input 
                    type={showCurrent ? "text" : "password"} 
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full pl-3.5 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-red-800 font-medium"
                    placeholder="••••••••"
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                  >
                    {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Nueva Contraseña</label>
                <div className="relative">
                  <input 
                    type={showNew ? "text" : "password"} 
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-3.5 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-red-800 font-medium"
                    placeholder="Mínimo 4 caracteres"
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                  >
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Confirmar Nueva Contraseña</label>
                <div className="relative">
                  <input 
                    type={showConfirm ? "text" : "password"} 
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-3.5 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-red-800 font-medium"
                    placeholder="Repite la nueva contraseña"
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {message.text && (
                <div className={`p-3 rounded-xl flex items-center gap-2 font-medium text-xs ${
                  message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  {message.type === 'success' && <CheckCircle className="w-4 h-4 shrink-0" />}
                  <span>{message.text}</span>
                </div>
              )}

              <div className="pt-2">
                <button 
                  type="submit"
                  disabled={loading}
                  className="flex items-center justify-center gap-2 bg-gray-900 hover:bg-black text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-all w-full sm:w-auto shadow-sm"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Actualizar Clave
                </button>
              </div>
            </form>
          </div>
        </div>

      </div>

    </div>
  );
}
