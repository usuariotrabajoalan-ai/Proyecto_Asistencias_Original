'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Download, 
  MessageSquare, 
  MapPin, 
  Search, 
  Trash2, 
  Loader2, 
  User, 
  X, 
  Check, 
  ChevronDown,
  Calendar,
  Building2,
  Users
} from 'lucide-react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

import { evaluateLocation, SEDES, getDistanceInMeters } from '@/lib/geo';

export default function AdminAttendancesPage() {
  const [attendances, setAttendances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filtros reactivos
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [employeeId, setEmployeeId] = useState('');
  const [sedeFilter, setSedeFilter] = useState('ALL'); // 'ALL', 'SEDE_SOCIAL', 'SEDE_ADMINISTRATIVA', 'OUT_OF_RANGE'
  const [employeesList, setEmployeesList] = useState<any[]>([]);

  // Buscador de Funcionario
  const [searchEmpTerm, setSearchEmpTerm] = useState('');
  const [isEmpDropdownOpen, setIsEmpDropdownOpen] = useState(false);
  const empDropdownRef = useRef<HTMLDivElement>(null);

  // Observación Modal
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [observationText, setObservationText] = useState('');

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    fetchAttendances();
  }, [month, employeeId]);

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (empDropdownRef.current && !empDropdownRef.current.contains(event.target as Node)) {
        setIsEmpDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchEmployees = async () => {
    try {
      const res = await fetch('/api/employees', { cache: 'no-store' });
      if (res.ok) setEmployeesList(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAttendances = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (month) params.append('month', month);
      if (employeeId) params.append('employeeId', employeeId);
      
      const res = await fetch(`/api/attendance?${params.toString()}`, { cache: 'no-store' });
      if (res.ok) setAttendances(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const normalizeText = (text: string) =>
    (text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

  // Lista filtrada de sugerencias de funcionarios
  const filteredEmployeesList = useMemo(() => {
    if (!searchEmpTerm.trim()) return employeesList;
    const q = normalizeText(searchEmpTerm);
    return employeesList.filter((emp) => {
      const fullName = normalizeText(`${emp.firstName} ${emp.lastName}`);
      const ci = normalizeText(emp.ci || '');
      return fullName.includes(q) || ci.includes(q);
    });
  }, [employeesList, searchEmpTerm]);

  const selectedEmpObj = useMemo(() => {
    return employeesList.find((e) => e.id === employeeId) || null;
  }, [employeesList, employeeId]);

  const handleSelectEmployee = (emp: any | null) => {
    if (!emp) {
      setEmployeeId('');
      setSearchEmpTerm('');
    } else {
      setEmployeeId(emp.id);
      setSearchEmpTerm(`${emp.firstName} ${emp.lastName}`);
    }
    setIsEmpDropdownOpen(false);
  };

  // Marcaciones filtradas combinando Empleado + Mes + Sede
  const filteredAttendances = useMemo(() => {
    return attendances.filter((record) => {
      if (sedeFilter === 'ALL') return true;
      const evalLoc = evaluateLocation(record.latitude, record.longitude);
      if (sedeFilter === 'OUT_OF_RANGE') return !evalLoc.inRange;
      return evalLoc.inRange && evalLoc.sede.id === sedeFilter;
    });
  }, [attendances, sedeFilter]);

  const getSedeLabel = (id: string) => {
    if (id === 'SEDE_SOCIAL') return 'Sede Social (Lambaré)';
    if (id === 'SEDE_ADMINISTRATIVA') return 'Sede Administrativa (14 de Mayo)';
    if (id === 'OUT_OF_RANGE') return 'Fuera de Rango';
    return 'Todas las sedes';
  };

  const handleExportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Asistencias');

    const isIndividual = employeeId !== '';
    const selectedEmp = isIndividual ? selectedEmpObj : null;
    const sedeLabel = getSedeLabel(sedeFilter);

    // Configuración para impresión
    worksheet.pageSetup.margins = { left: 0.5, right: 0.5, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 };
    worksheet.pageSetup.fitToPage = true;
    worksheet.pageSetup.fitToWidth = 1;

    if (isIndividual && selectedEmp) {
      // --- REPORTE INDIVIDUAL (CALENDARIO DEL MES) ---
      worksheet.mergeCells('A1:E1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = sedeFilter !== 'ALL'
        ? `ASISTENCIA DE ${selectedEmp.firstName.toUpperCase()} ${selectedEmp.lastName.toUpperCase()} - MES: ${month} (${sedeLabel.toUpperCase()})`
        : `ASISTENCIA DE ${selectedEmp.firstName.toUpperCase()} ${selectedEmp.lastName.toUpperCase()} - MES: ${month}`;
      titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7C2128' } };
      titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
      worksheet.getRow(1).height = 30;

      worksheet.addRow([]); // Fila en blanco

      const headerRow = worksheet.addRow(['Día y Fecha', 'Entrada', 'Salida', 'Estado Rango', 'Observación']);
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF333333' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
      });

      worksheet.columns = [
        { width: 30 }, // Día
        { width: 15 }, // Entrada
        { width: 15 }, // Salida
        { width: 20 }, // Estado
        { width: 45 }, // Observación
      ];

      const [yearStr, monthStr] = month.split('-');
      const year = parseInt(yearStr);
      const m = parseInt(monthStr) - 1;
      const daysInMonth = new Date(year, m + 1, 0).getDate();

      for (let day = 1; day <= daysInMonth; day++) {
        const dateObj = new Date(year, m, day);
        const dateStr = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: '2-digit', month: 'long' }).format(dateObj);
        
        // Marcaciones del día respetando los filtros activos (incluyendo Sede)
        const dayRecords = filteredAttendances.filter(a => {
          const d = new Date(a.timestamp);
          return d.getDate() === day && d.getMonth() === m && d.getFullYear() === year;
        });

        const entradas = dayRecords.filter(a => a.type === 'ENTRADA').sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        const salidas = dayRecords.filter(a => a.type === 'SALIDA').sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        const entrada = entradas.length > 0 ? entradas[0] : null;
        const salida = salidas.length > 0 ? salidas[0] : null;

        const formatHora = (record: any) => record ? new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' }).format(new Date(record.timestamp)) : '';
        
        let estadoTxt = '';
        if (entrada || salida) {
          const eEval = entrada ? evaluateLocation(entrada.latitude, entrada.longitude) : null;
          const sEval = salida ? evaluateLocation(salida.latitude, salida.longitude) : null;
          
          if (eEval && sEval) {
            estadoTxt = eEval.statusLabel === sEval.statusLabel ? eEval.statusLabel : `Ent.: ${eEval.shortLabel} | Sal.: ${sEval.shortLabel}`;
          } else if (eEval) {
            estadoTxt = eEval.statusLabel;
          } else if (sEval) {
            estadoTxt = sEval.statusLabel;
          }
        }

        const obs = dayRecords.map(a => a.observation).filter(Boolean).join(' | ');

        const row = worksheet.addRow([
          dateStr.charAt(0).toUpperCase() + dateStr.slice(1),
          formatHora(entrada),
          formatHora(salida),
          estadoTxt,
          obs
        ]);

        for(let i = 1; i <= 5; i++) {
          const cell = row.getCell(i);
          cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
          cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
        }
      }

      // Espacio para la firma
      worksheet.addRow([]);
      worksheet.addRow([]);
      worksheet.addRow([]);
      const signRow1 = worksheet.addRow(['', '', '', '____________________________________', '']);
      const signRow2 = worksheet.addRow(['', '', '', 'Firma Personal de Administración', '']);
      
      worksheet.mergeCells(`D${signRow1.number}:E${signRow1.number}`);
      worksheet.mergeCells(`D${signRow2.number}:E${signRow2.number}`);
      signRow1.getCell(4).alignment = { horizontal: 'center' };
      signRow2.getCell(4).alignment = { horizontal: 'center' };
      signRow2.getCell(4).font = { bold: true };

    } else {
      // --- REPORTE GENERAL ---
      worksheet.mergeCells('A1:G1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = sedeFilter !== 'ALL'
        ? `ASISTENCIA GENERAL DEL MES: ${month} - SEDE: ${sedeLabel.toUpperCase()}`
        : `ASISTENCIA GENERAL DEL MES: ${month}`;
      titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7C2128' } };
      titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
      worksheet.getRow(1).height = 30;
      worksheet.addRow([]);

      const headerRow = worksheet.addRow(['Fecha y Hora', 'CI', 'Nombre', 'Tipo', 'Estado Ubicación', 'Ubicación (Lat, Lng)', 'Observación']);
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF333333' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });

      worksheet.columns = [
        { width: 25 }, { width: 15 }, { width: 35 }, { width: 15 }, { width: 25 }, { width: 30 }, { width: 40 }
      ];

      filteredAttendances.forEach(record => {
        const formattedDate = new Intl.DateTimeFormat('es-ES', { 
          weekday: 'long', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' 
        }).format(new Date(record.timestamp));

        const evalLoc = evaluateLocation(record.latitude, record.longitude);
        const statusUbi = evalLoc.statusLabel;

        const row = worksheet.addRow([
          formattedDate, record.employee.ci, `${record.employee.firstName} ${record.employee.lastName}`,
          record.type, statusUbi, `${record.latitude}, ${record.longitude}`, record.observation || ''
        ]);
        
        row.getCell(4).font = { color: { argb: record.type === 'ENTRADA' ? 'FF008000' : 'FFFF0000' }, bold: true };
        row.getCell(5).font = { color: { argb: evalLoc.inRange ? 'FF008000' : 'FFFF0000' }, bold: true };
        
        for(let i = 1; i <= 7; i++) {
          const cell = row.getCell(i);
          cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
          if (i !== 4 && i !== 5) {
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
          }
        }
      });
    }

    const sanitizeFileName = (str: string) => str.replace(/[^a-zA-Z0-9_\-]/g, '_');
    const fileName = isIndividual && selectedEmp 
      ? `Asistencia_${sanitizeFileName(selectedEmp.firstName)}_${sanitizeFileName(selectedEmp.lastName)}_${month}${sedeFilter !== 'ALL' ? `_${sanitizeFileName(sedeFilter)}` : ''}.xlsx`
      : `Asistencias_AFEMEC_${month}${sedeFilter !== 'ALL' ? `_${sanitizeFileName(sedeFilter)}` : ''}.xlsx`;

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, fileName);
  };

  const handleSaveObservation = async () => {
    if (!selectedRecord) return;
    try {
      const res = await fetch(`/api/attendance/${selectedRecord.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ observation: observationText })
      });
      if (res.ok) {
        setAttendances(attendances.map(a => a.id === selectedRecord.id ? { ...a, observation: observationText } : a));
        setSelectedRecord(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteRecord = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este registro de asistencia? Esta acción no se puede deshacer.')) return;
    try {
      const res = await fetch(`/api/attendance/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setAttendances(attendances.filter(a => a.id !== id));
        setSelectedRecord(null);
      } else {
        alert('Error al eliminar registro');
      }
    } catch (e) {
      alert('Error de conexión');
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      
      {/* 1. Encabezado Principal y Acción de Exportar */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Control de Asistencia</h1>
          <p className="text-sm text-gray-500 mt-1">Monitorea, filtra y exporta las marcaciones institucionales del personal</p>
        </div>

        <button 
          onClick={handleExportExcel}
          disabled={loading || filteredAttendances.length === 0}
          className="flex items-center justify-center gap-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl shadow-sm hover:shadow-md transition-all font-semibold text-sm w-full md:w-auto shrink-0"
        >
          <Download className="w-4 h-4" />
          Exportar Planilla Excel
        </button>
      </div>

      {/* 2. Barra de Filtros Inteligentes (Compacta, Automática y Proporcional) */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          
          {/* Filtro 1: Buscador Inteligente de Funcionario (5 columnas en desktop) */}
          <div className="md:col-span-5 relative" ref={empDropdownRef}>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Filtrar por Funcionario</span>
              {selectedEmpObj && (
                <span className="text-green-700 bg-green-50 px-2 py-0.5 rounded-md text-[11px] font-semibold border border-green-200">
                  Individual
                </span>
              )}
            </label>
            
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="search"
                name="funcionario_smart_filter_no_autofill"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-lpignore="true"
                data-form-type="other"
                aria-autocomplete="none"
                value={searchEmpTerm}
                onChange={(e) => {
                  setSearchEmpTerm(e.target.value);
                  if (!isEmpDropdownOpen) setIsEmpDropdownOpen(true);
                }}
                onFocus={() => setIsEmpDropdownOpen(true)}
                placeholder={selectedEmpObj ? `${selectedEmpObj.firstName} ${selectedEmpObj.lastName}` : "Buscar por nombre, apellido o CI..."}
                className={`w-full pl-10 pr-9 py-2.5 bg-gray-50 border ${
                  selectedEmpObj 
                    ? 'border-red-300 ring-1 ring-red-800/20 bg-red-50/20 font-bold text-gray-900' 
                    : 'border-gray-200 font-medium text-gray-800'
                } rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-800 focus:bg-white transition-all shadow-sm`}
              />
              {(searchEmpTerm || employeeId) && (
                <button
                  type="button"
                  onClick={() => handleSelectEmployee(null)}
                  title="Limpiar búsqueda y ver todos los empleados"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-700 hover:bg-gray-200/60 p-1 rounded-full transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Menú Flotante de Sugerencias */}
            {isEmpDropdownOpen && (
              <div className="absolute z-50 left-0 right-0 mt-1 max-h-72 overflow-y-auto bg-white rounded-2xl shadow-2xl border border-gray-200 divide-y divide-gray-100 animate-in fade-in slide-in-from-top-1 duration-150">
                <div 
                  onClick={() => handleSelectEmployee(null)}
                  className={`px-4 py-3 text-xs font-bold flex items-center justify-between cursor-pointer transition-colors ${
                    !employeeId ? 'bg-red-50 text-red-900' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-gray-400" />
                    <span>Todos los funcionarios (Reporte General)</span>
                  </div>
                  {!employeeId && <Check className="w-4 h-4 text-red-800" />}
                </div>

                {filteredEmployeesList.length > 0 ? (
                  filteredEmployeesList.map((emp) => {
                    const isSelected = emp.id === employeeId;
                    return (
                      <div
                        key={emp.id}
                        onClick={() => handleSelectEmployee(emp)}
                        className={`px-4 py-2.5 text-sm flex items-center justify-between cursor-pointer transition-colors ${
                          isSelected ? 'bg-red-50 text-red-900 font-bold' : 'hover:bg-red-50/50 text-gray-800'
                        }`}
                      >
                        <div className="flex flex-col">
                          <span className="font-semibold text-gray-900 leading-tight">
                            {emp.firstName} {emp.lastName}
                          </span>
                          <span className="text-xs text-gray-500 font-mono mt-0.5">
                            CI: {emp.ci}
                          </span>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-red-800 shrink-0" />}
                      </div>
                    );
                  })
                ) : (
                  <div className="px-4 py-4 text-xs text-gray-500 text-center">
                    No se encontró ningún funcionario con &quot;{searchEmpTerm}&quot;
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Filtro 2: Período por Mes (4 columnas en desktop) */}
          <div className="md:col-span-4">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              Período (Mes y Año)
            </label>
            <div className="relative">
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-red-800 focus:bg-white transition-all font-medium shadow-sm cursor-pointer"
              />
            </div>
          </div>

          {/* Filtro 3: Sede Institucional (3 columnas en desktop) */}
          <div className="md:col-span-3">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              Sede Institucional
            </label>
            <select
              value={sedeFilter}
              onChange={(e) => setSedeFilter(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-red-800 focus:bg-white transition-all font-medium shadow-sm cursor-pointer"
            >
              <option value="ALL">Todas las sedes</option>
              <option value="SEDE_SOCIAL">🌳 Sede Social (Lambaré)</option>
              <option value="SEDE_ADMINISTRATIVA">🏢 Sede Adm. (14 de Mayo)</option>
              <option value="OUT_OF_RANGE">⚠️ Fuera de rango</option>
            </select>
          </div>

        </div>
      </div>

      {/* 3. Indicadores Estadísticos (KPIs sincronizados con los filtros activos) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-center items-center">
          <span className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Total Marcaciones</span>
          <span className="text-2xl font-black text-gray-800">
            {loading ? <Loader2 className="w-5 h-5 animate-spin text-gray-400" /> : filteredAttendances.length}
          </span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-center items-center">
          <span className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Entradas</span>
          <span className="text-2xl font-black text-green-600">
            {loading ? <Loader2 className="w-5 h-5 animate-spin text-gray-400" /> : filteredAttendances.filter(a => a.type === 'ENTRADA').length}
          </span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-center items-center">
          <span className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Salidas</span>
          <span className="text-2xl font-black text-red-600">
            {loading ? <Loader2 className="w-5 h-5 animate-spin text-gray-400" /> : filteredAttendances.filter(a => a.type === 'SALIDA').length}
          </span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-center items-center">
          <span className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Fuera de Rango</span>
          <span className="text-2xl font-black text-orange-500">
            {loading ? <Loader2 className="w-5 h-5 animate-spin text-gray-400" /> : filteredAttendances.filter(a => !evaluateLocation(a.latitude, a.longitude).inRange).length}
          </span>
        </div>
      </div>

      {/* 4. Tabla de Resultados */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50/80">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Fecha y Hora</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Empleado</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Tipo</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Ubicación</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Observación</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Selfie</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100 text-black">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500 font-medium">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-red-800" />
                    Cargando registros...
                  </td>
                </tr>
              ) : filteredAttendances.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500 font-medium">
                    No hay registros que coincidan con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filteredAttendances.map((record) => {
                  const evalLoc = evaluateLocation(record.latitude, record.longitude);
                  return (
                    <tr 
                      key={record.id} 
                      className="hover:bg-red-50/50 cursor-pointer transition-all border-l-4 border-transparent hover:border-red-800 group" 
                      onClick={() => { setSelectedRecord(record); setObservationText(record.observation || ''); }}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                        <span className="capitalize">{new Intl.DateTimeFormat('es-ES', { weekday: 'short' }).format(new Date(record.timestamp))}</span>
                        {' '}{new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(record.timestamp)).replace(',', '')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="font-bold text-gray-800 capitalize">{record.employee.firstName} {record.employee.lastName}</div>
                        <div className="text-gray-400 text-xs font-medium">CI: {record.employee.ci}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-lg ${
                          record.type === 'ENTRADA' ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-green-200'
                        }`}>
                          {record.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm flex flex-col gap-1.5">
                        <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-md w-max border ${
                          evalLoc.inRange 
                            ? (evalLoc.sede.id === 'SEDE_ADMINISTRATIVA' 
                                ? 'bg-blue-50 text-blue-700 border-blue-200' 
                                : 'bg-green-50 text-green-700 border-green-200')
                            : 'bg-orange-50 text-orange-700 border-orange-200'
                        }`}>
                          {evalLoc.statusLabel}
                        </span>
                        {record.latitude && record.longitude && (
                          <a 
                            href={`https://www.google.com/maps?q=${record.latitude},${record.longitude}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 text-blue-500 hover:text-blue-700 transition-colors font-medium text-xs mt-0.5 hover:underline"
                          >
                            <MapPin className="w-3 h-3" /> Ver en mapa
                          </a>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 max-w-[200px] truncate">
                        {record.observation ? (
                          <span className="italic text-gray-700 bg-gray-50 px-2 py-1 rounded border border-gray-100">&quot;{record.observation}&quot;</span>
                        ) : (
                          <span className="text-gray-300">Sin observación</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {record.photoBase64 ? (
                          <div className="relative w-12 h-12 rounded-xl overflow-hidden border-2 border-gray-100 group-hover:border-red-200 transition-colors shadow-sm bg-gray-100">
                            <img src={record.photoBase64} alt="Selfie" className="w-full h-full object-cover" />
                          </div>
                        ) : '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal para Detalles y Observación */}
      {selectedRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col md:flex-row overflow-hidden">
            {/* Izquierda: Foto y Mapa */}
            <div className="bg-gray-100 p-6 flex flex-col items-center justify-center border-r md:w-1/2">
              {selectedRecord.photoBase64 ? (
                <img src={selectedRecord.photoBase64} alt="Selfie Completa" className="w-48 h-48 rounded-lg object-cover shadow-md mb-4 border-2 border-white" />
              ) : (
                <div className="w-48 h-48 bg-gray-200 rounded-lg flex items-center justify-center mb-4">
                  <span className="text-gray-500">Sin foto</span>
                </div>
              )}
              <a 
                href={`https://www.google.com/maps/search/?api=1&query=${selectedRecord.latitude},${selectedRecord.longitude}`} 
                target="_blank" 
                className="flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 w-full shadow-sm text-sm font-semibold"
              >
                <MapPin className="w-4 h-4" /> Abrir en Google Maps
              </a>
              {(() => {
                const evalLoc = evaluateLocation(selectedRecord.latitude, selectedRecord.longitude);
                return (
                  <div className="mt-3 text-center">
                    <span className={`inline-block px-2.5 py-1 text-xs font-bold rounded-lg border ${
                      evalLoc.inRange 
                        ? (evalLoc.sede.id === 'SEDE_ADMINISTRATIVA' ? 'bg-blue-50 text-blue-800 border-blue-200' : 'bg-green-50 text-green-800 border-green-200')
                        : 'bg-orange-50 text-orange-800 border-orange-200'
                    }`}>
                      {evalLoc.statusLabel}
                    </span>
                    <p className="text-xs text-gray-500 mt-1.5 font-mono">
                      Lat: {selectedRecord.latitude ? selectedRecord.latitude.toFixed(5) : 'N/A'} | Lng: {selectedRecord.longitude ? selectedRecord.longitude.toFixed(5) : 'N/A'}
                    </p>
                  </div>
                );
              })()}
            </div>

            {/* Derecha: Datos y Observación */}
            <div className="p-6 md:w-1/2 flex flex-col">
              <h3 className="text-xl font-bold mb-1 text-gray-800">Detalles de Asistencia</h3>
              <p className="text-sm text-gray-500 mb-6 border-b pb-4">
                <span className="font-semibold text-gray-700">{selectedRecord.employee.firstName} {selectedRecord.employee.lastName}</span> <br/>
                CI: {selectedRecord.employee.ci} <br/>
                <span className={`inline-block mt-1 px-2 py-0.5 text-xs font-bold rounded ${selectedRecord.type === 'ENTRADA' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {selectedRecord.type}
                </span> el {new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(selectedRecord.timestamp))}
              </p>

              <label className="text-sm font-semibold text-gray-700 mb-2">Observación (Admin / Empleado)</label>
              <textarea
                className="w-full border-2 border-gray-200 rounded-lg p-3 mb-4 text-gray-800 focus:border-red-800 focus:ring-0 outline-none resize-none flex-1 text-sm"
                value={observationText}
                onChange={(e) => setObservationText(e.target.value)}
                placeholder="Escribe o edita la observación aquí..."
              ></textarea>
              
              <div className="flex justify-between items-center mt-auto">
                <button 
                  onClick={() => handleDeleteRecord(selectedRecord.id)}
                  className="text-red-500 hover:text-red-700 bg-red-50 p-2.5 rounded-lg transition-colors"
                  title="Eliminar este registro"
                >
                  <Trash2 className="w-5 h-5" />
                </button>

                <div className="flex gap-2">
                  <button 
                    onClick={() => setSelectedRecord(null)}
                    className="px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 text-sm font-semibold transition-colors"
                  >
                    Cerrar
                  </button>
                  <button 
                    onClick={handleSaveObservation}
                    className="px-5 py-2 bg-red-800 hover:bg-red-900 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
                  >
                    Guardar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
