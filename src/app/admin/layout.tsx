import Link from 'next/link';
import { Users, Clock, Settings, LogOut } from 'lucide-react';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row">
      <aside className="w-full md:w-64 bg-white shadow-md flex flex-col md:min-h-screen">
        <div className="p-4 border-b bg-red-900 flex items-center justify-center">
          <div className="bg-white px-4 py-2 rounded-lg w-full flex justify-center">
            <img src="/logo.jpg" alt="Logo" className="h-12 object-contain" />
          </div>
        </div>
        <nav className="flex flex-row md:flex-col md:flex-1 p-2 md:p-4 space-x-2 md:space-x-0 md:space-y-2 overflow-x-auto">
          <Link href="/admin" className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded text-gray-700">
            <Clock className="w-5 h-5" />
            Asistencias
          </Link>
          <Link href="/admin/employees" className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded text-gray-700 font-medium">
            <Users className="w-5 h-5" />
            Empleados
          </Link>
          <Link href="/admin/settings" className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded text-gray-700 font-medium">
            <Settings className="w-5 h-5" />
            Seguridad
          </Link>
        </nav>
        <div className="p-4 border-t">
          <Link href="/" className="flex items-center gap-2 p-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl text-gray-700 font-medium transition-colors">
            <LogOut className="w-5 h-5 text-red-800" />
            Volver al Fichero
          </Link>
        </div>
      </aside>
      <main className="flex-1 p-4 md:p-8 overflow-auto w-full">
        {children}
      </main>
    </div>
  );
}

