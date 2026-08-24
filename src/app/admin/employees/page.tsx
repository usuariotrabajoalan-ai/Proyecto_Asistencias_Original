'use client';

import { useState, useEffect } from 'react';
import { UserPlus, Loader2, Search, Edit2, Trash2, X } from 'lucide-react';

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Nuevo empleado Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({ ci: '', firstName: '', lastName: '' });
  const [submitLoading, setSubmitLoading] = useState(false);

  // Editar Empleado Modal
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [editFormData, setEditFormData] = useState({ ci: '', firstName: '', lastName: '' });
  const [editLoading, setEditLoading] = useState(false);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const res = await fetch('/api/employees');
      if (res.ok) setEmployees(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);
    try {
      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setFormData({ ci: '', firstName: '', lastName: '' });
        setShowAddModal(false);
        fetchEmployees();
      } else {
        const err = await res.json();
        alert(err.error || 'Error al guardar');
      }
    } catch (error) {
      alert('Error de conexión');
    } finally {
      setSubmitLoading(false);
    }
  };

  const openEditModal = (emp: any) => {
    setSelectedEmployee(emp);
    setEditFormData({ ci: emp.ci, firstName: emp.firstName, lastName: emp.lastName });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditLoading(true);
    try {
      const res = await fetch(`/api/employees/${selectedEmployee.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editFormData),
      });
      if (res.ok) {
        setSelectedEmployee(null);
        fetchEmployees();
      } else {
        const err = await res.json();
        alert(err.error || 'Error al actualizar');
      }
    } catch (error) {
      alert('Error de conexión');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteEmployee = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este empleado? Esto también borrará TODO su historial de asistencias de forma permanente.')) return;
    
    try {
      const res = await fetch(`/api/employees/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setSelectedEmployee(null);
        fetchEmployees();
      } else {
        alert('Error al eliminar empleado');
      }
    } catch (e) {
      alert('Error de conexión');
    }
  };

  const filteredEmployees = employees.filter(emp => 
    emp.ci.includes(searchTerm) || 
    emp.firstName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    emp.lastName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      
      {/* Cabecera */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Directorio de Personal</h1>
          <p className="text-gray-500 text-sm mt-1">Gestiona los funcionarios autorizados para marcar asistencia</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-red-800 text-white px-5 py-2.5 rounded-lg hover:bg-red-900 shadow-md font-medium transition-colors"
        >
          <UserPlus className="w-5 h-5" /> Agregar Nuevo Funcionario
        </button>
      </div>

      {/* Buscador */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Buscar por cédula, nombre o apellido..."
          className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-800 focus:border-red-800 sm:text-sm text-black shadow-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Grid de Empleados */}
      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 text-red-800 animate-spin" />
        </div>
      ) : filteredEmployees.length === 0 ? (
        <div className="text-center p-12 bg-white rounded-xl shadow-sm border border-gray-100">
          <p className="text-gray-500">No se encontraron funcionarios.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEmployees.map((emp) => (
            <div 
              key={emp.id} 
              onClick={() => openEditModal(emp)}
              className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-red-200 cursor-pointer transition-all flex flex-col group"
            >
              <div className="flex justify-between items-start mb-2">
                <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center text-red-800 font-bold text-lg">
                  {emp.firstName.charAt(0).toUpperCase()}{emp.lastName.charAt(0).toUpperCase()}
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-gray-400 hover:text-red-800 p-1">
                    <Edit2 className="w-4 h-4" />
                  </span>
                </div>
              </div>
              <h3 className="text-lg font-bold text-gray-800 capitalize mt-2">
                {emp.firstName} {emp.lastName}
              </h3>
              <p className="text-gray-500 text-sm flex items-center gap-1 mt-1 font-medium">
                CI: {emp.ci}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Modal Agregar Nuevo */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden text-black">
            <div className="flex justify-between items-center p-5 border-b bg-gray-50">
              <h3 className="text-lg font-bold text-gray-800">Agregar Funcionario</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button>
            </div>
            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Cédula (CI)</label>
                <input required type="text" value={formData.ci} onChange={(e) => setFormData({...formData, ci: e.target.value})} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-800 outline-none" placeholder="Ej. 1234567" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Nombre</label>
                <input required type="text" value={formData.firstName} onChange={(e) => setFormData({...formData, firstName: e.target.value})} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-800 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Apellido</label>
                <input required type="text" value={formData.lastName} onChange={(e) => setFormData({...formData, lastName: e.target.value})} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-800 outline-none" />
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-5 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg">Cancelar</button>
                <button type="submit" disabled={submitLoading} className="px-5 py-2 bg-red-800 text-white font-medium rounded-lg hover:bg-red-900 flex items-center gap-2">
                  {submitLoading ? <Loader2 className="w-4 h-4 animate-spin"/> : null} Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar / Eliminar */}
      {selectedEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden text-black">
            <div className="flex justify-between items-center p-5 border-b bg-gray-50">
              <h3 className="text-lg font-bold text-gray-800">Detalles del Funcionario</h3>
              <button onClick={() => setSelectedEmployee(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Cédula (CI)</label>
                <input required type="text" value={editFormData.ci} onChange={(e) => setEditFormData({...editFormData, ci: e.target.value})} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-800 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Nombre</label>
                <input required type="text" value={editFormData.firstName} onChange={(e) => setEditFormData({...editFormData, firstName: e.target.value})} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-800 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Apellido</label>
                <input required type="text" value={editFormData.lastName} onChange={(e) => setEditFormData({...editFormData, lastName: e.target.value})} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-800 outline-none" />
              </div>
              
              <div className="pt-6 flex justify-between items-center border-t mt-6">
                <button type="button" onClick={() => handleDeleteEmployee(selectedEmployee.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg flex items-center gap-1 font-medium transition-colors" title="Eliminar Funcionario">
                  <Trash2 className="w-5 h-5"/>
                </button>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setSelectedEmployee(null)} className="px-5 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg">Cancelar</button>
                  <button type="submit" disabled={editLoading} className="px-5 py-2 bg-red-800 text-white font-medium rounded-lg hover:bg-red-900 flex items-center gap-2">
                    {editLoading ? <Loader2 className="w-4 h-4 animate-spin"/> : null} Actualizar
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
