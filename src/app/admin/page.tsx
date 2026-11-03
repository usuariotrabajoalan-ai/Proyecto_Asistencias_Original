'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Download, 
  MapPin, 
  Search, 
  Trash2, 
  Loader2, 
  X, 
  Check, 
  Calendar, 
  Users,
  Clock,
  Moon,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Eye,
  FileSpreadsheet
} from 'lucide-react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

import { evaluateLocation, SEDES, getDistanceInMeters } from '@/lib/geo';

export interface WorkdayShift {
  id: string;
  employee: any;
  date: Date;
  dateLabel: string;
  dayOfWeek: string;
  entrada: any | null;
  salida: any | null;
  durationMinutes: number | null;
  durationLabel: string;
  isOvernight: boolean;
  isGuard24h: boolean;
  status: 'COMPLETA' | 'EN_CURSO' | 'SIN_SALIDA' | 'SIN_ENTRADA';
}

export default function AdminAttendancesPage() {
  const [attendances, setAttendances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modo de vista: 'PLANILLA' (Jornadas y turnos) vs 'DETALLE' (Marcaciones individuales)
  const [viewMode, setViewMode] = useState<'PLANILLA' | 'DETALLE'>('PLANILLA');

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

  // Marcaciones individuales filtradas por Sede
  const filteredAttendances = useMemo(() => {
    return attendances.filter((record) => {
      if (sedeFilter === 'ALL') return true;
      const evalLoc = evaluateLocation(record.latitude, record.longitude);
      if (sedeFilter === 'OUT_OF_RANGE') return !evalLoc.inRange;
      return evalLoc.inRange && evalLoc.sede.id === sedeFilter;
    });
  }, [attendances, sedeFilter]);

  // MOTOR DE PAREO DE JORNADAS Y TURNOS (Soporte completo para Guardias 12h/24h y turnos nocturnos)
  const workdayShifts = useMemo<WorkdayShift[]>(() => {
    if (!attendances || attendances.length === 0) return [];

    // 1. Agrupar por funcionario
    const byEmp: { [empId: string]: any[] } = {};
    attendances.forEach((rec) => {
      if (!byEmp[rec.employeeId]) byEmp[rec.employeeId] = [];
      byEmp[rec.employeeId].push(rec);
    });

    const allShifts: WorkdayShift[] = [];

    // 2. Procesar cada funcionario cronológicamente
    Object.keys(byEmp).forEach((empId) => {
      const empRecords = [...byEmp[empId]].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      const processedIds = new Set<string>();

      for (let i = 0; i < empRecords.length; i++) {
        const cur = empRecords[i];
        if (processedIds.has(cur.id)) continue;

        if (cur.type === 'ENTRADA') {
          processedIds.add(cur.id);
          const tIn = new Date(cur.timestamp).getTime();
          let matchedSalida: any = null;

          // Buscar la salida consecutiva dentro de una ventana de hasta 28 horas
          for (let j = i + 1; j < empRecords.length; j++) {
            const cand = empRecords[j];
            if (processedIds.has(cand.id)) continue;

            const tCand = new Date(cand.timestamp).getTime();
            const diffHours = (tCand - tIn) / (1000 * 60 * 60);

            // Si hay otra entrada antes de una salida, cur queda sin salida
            if (cand.type === 'ENTRADA') {
              break;
            }

            if (cand.type === 'SALIDA') {
              if (diffHours <= 28) {
                matchedSalida = cand;
                processedIds.add(cand.id);
              }
              break;
            }
          }

          let durationMinutes: number | null = null;
          let durationLabel = '--';
          let isOvernight = false;
          let isGuard24h = false;

          if (matchedSalida) {
            const tOut = new Date(matchedSalida.timestamp).getTime();
            durationMinutes = Math.max(0, Math.round((tOut - tIn) / (1000 * 60)));
            const h = Math.floor(durationMinutes / 60);
            const m = durationMinutes % 60;
            durationLabel = `${h}h ${m.toString().padStart(2, '0')}m`;

            const dIn = new Date(cur.timestamp);
            const dOut = new Date(matchedSalida.timestamp);
            isOvernight = dIn.toLocaleDateString() !== dOut.toLocaleDateString();
            if (h >= 20) isGuard24h = true;
          }

          let status: 'COMPLETA' | 'EN_CURSO' | 'SIN_SALIDA' = 'COMPLETA';
          if (!matchedSalida) {
            const now = Date.now();
            const ageHours = (now - tIn) / (1000 * 60 * 60);
            status = ageHours <= 24 ? 'EN_CURSO' : 'SIN_SALIDA';
          }

          const shiftDate = new Date(cur.timestamp);
          const dayOfWeek = new Intl.DateTimeFormat('es-ES', { weekday: 'long' }).format(shiftDate);
          const dateLabel = new Intl.DateTimeFormat('es-ES', { 
            weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' 
          }).format(shiftDate);

          allShifts.push({
            id: cur.id,
            employee: cur.employee,
            date: shiftDate,
            dateLabel,
            dayOfWeek,
            entrada: cur,
            salida: matchedSalida,
            durationMinutes,
            durationLabel,
            isOvernight,
            isGuard24h,
            status,
          });
        } else if (cur.type === 'SALIDA') {
          // Salida sin entrada previa registrada
          processedIds.add(cur.id);
          const shiftDate = new Date(cur.timestamp);
          const dayOfWeek = new Intl.DateTimeFormat('es-ES', { weekday: 'long' }).format(shiftDate);
          const dateLabel = new Intl.DateTimeFormat('es-ES', { 
            weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' 
          }).format(shiftDate);

          allShifts.push({
            id: cur.id,
            employee: cur.employee,
            date: shiftDate,
            dateLabel,
            dayOfWeek,
            entrada: null,
            salida: cur,
            durationMinutes: null,
            durationLabel: '--',
            isOvernight: false,
            isGuard24h: false,
            status: 'SIN_ENTRADA',
          });
        }
      }
    });

    // 3. Filtrar por el mes seleccionado y por sede institucional
    return allShifts
      .filter((shift) => {
        // Filtro de mes (el turno pertenece al mes de inicio de su jornada)
        if (month) {
          const shiftMonthStr = shift.date.toISOString().slice(0, 7);
          if (shiftMonthStr !== month) return false;
        }

        // Filtro de sede
        if (sedeFilter !== 'ALL') {
          const evalIn = shift.entrada ? evaluateLocation(shift.entrada.latitude, shift.entrada.longitude) : null;
          const evalOut = shift.salida ? evaluateLocation(shift.salida.latitude, shift.salida.longitude) : null;

          if (sedeFilter === 'OUT_OF_RANGE') {
            const inOutOfRange = evalIn && !evalIn.inRange;
            const outOutOfRange = evalOut && !evalOut.inRange;
            if (!inOutOfRange && !outOutOfRange) return false;
          } else {
            const inMatches = evalIn && evalIn.inRange && evalIn.sede.id === sedeFilter;
            const outMatches = evalOut && evalOut.inRange && evalOut.sede.id === sedeFilter;
            if (!inMatches && !outMatches) return false;
          }
        }

        return true;
      })
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [attendances, month, sedeFilter]);

  // Métricas agregadas de Jornadas
  const shiftMetrics = useMemo(() => {
    let totalMinutes = 0;
    let completeCount = 0;
    let overnightCount = 0;
    let inProgressCount = 0;
    let alertCount = 0;

    workdayShifts.forEach((s) => {
      if (s.durationMinutes) totalMinutes += s.durationMinutes;
      if (s.status === 'COMPLETA') completeCount++;
      if (s.isOvernight) overnightCount++;
      if (s.status === 'EN_CURSO') inProgressCount++;
      if (s.status === 'SIN_SALIDA' || s.status === 'SIN_ENTRADA') alertCount++;
    });

    const totalHours = Math.floor(totalMinutes / 60);
    const totalRemainingMinutes = totalMinutes % 60;
    const totalHoursStr = `${totalHours}h ${totalRemainingMinutes.toString().padStart(2, '0')}m`;

    return {
      totalShifts: workdayShifts.length,
      totalHoursStr,
      completeCount,
      overnightCount,
      inProgressCount,
      alertCount,
    };
  }, [workdayShifts]);

  const getSedeLabel = (id: string) => {
    if (id === 'SEDE_SOCIAL') return 'Sede Social (Lambaré)';
    if (id === 'SEDE_ADMINISTRATIVA') return 'Sede Administrativa (14 de Mayo)';
    if (id === 'OUT_OF_RANGE') return 'Fuera de Rango';
    return 'Todas las sedes';
  };

  // EXPORTACIÓN A EXCEL (Compatible con Jornadas Pareadas y Turnos de Guardia)
  const handleExportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Planilla de Asistencias');

    const isIndividual = employeeId !== '';
    const selectedEmp = isIndividual ? selectedEmpObj : null;
    const sedeLabel = getSedeLabel(sedeFilter);

    worksheet.pageSetup.margins = { left: 0.5, right: 0.5, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 };
    worksheet.pageSetup.fitToPage = true;
    worksheet.pageSetup.fitToWidth = 1;

    if (isIndividual && selectedEmp) {
      // --- REPORTE INDIVIDUAL PAREADO ---
      worksheet.mergeCells('A1:H1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = `PLANILLA DE ASISTENCIA: ${selectedEmp.firstName.toUpperCase()} ${selectedEmp.lastName.toUpperCase()} - PERÍODO: ${month} (${sedeLabel.toUpperCase()})`;
      titleCell.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7C2128' } };
      titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
      worksheet.getRow(1).height = 32;

      worksheet.addRow([]);

      const headerRow = worksheet.addRow([
        'Día y Fecha Inicio',
        'Hora Entrada',
        'Sede Entrada',
        'Fecha de Salida',
        'Hora Salida',
        'Sede Salida',
        'Horas Trabajadas',
        'Detalle del Turno / Observación'
      ]);
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2A2F3D' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      });

      worksheet.columns = [
        { width: 28 }, // Día Entrada
        { width: 14 }, // Hora Entrada
        { width: 22 }, // Sede In
        { width: 34 }, // Fecha Salida (Con descripción completa y clara)
        { width: 14 }, // Hora Salida
        { width: 22 }, // Sede Out
        { width: 18 }, // Horas
        { width: 42 }, // Detalle
      ];

      // Exportar en orden cronológico (del 1 al último día)
      const chronologicalShifts = [...workdayShifts].sort((a, b) => a.date.getTime() - b.date.getTime());

      chronologicalShifts.forEach((shift) => {
        const inStr = shift.entrada
          ? new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' }).format(new Date(shift.entrada.timestamp))
          : '---';

        let fechaSalidaStr = '---';
        let horaSalidaStr = '---';

        if (shift.salida) {
          horaSalidaStr = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' }).format(new Date(shift.salida.timestamp));
          const dOut = new Date(shift.salida.timestamp);
          const dateOutFull = new Intl.DateTimeFormat('es-ES', { 
            weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' 
          }).format(dOut);

          if (shift.isOvernight) {
            fechaSalidaStr = `${dateOutFull} (Día Siguiente)`;
          } else {
            fechaSalidaStr = `${dateOutFull} (Mismo Día)`;
          }
        } else if (shift.status === 'EN_CURSO') {
          fechaSalidaStr = 'En Curso (Pendiente de salida)';
          horaSalidaStr = '---';
        } else if (shift.status === 'SIN_SALIDA') {
          fechaSalidaStr = 'Sin Marcación de Salida';
          horaSalidaStr = '---';
        }

        const evalIn = shift.entrada ? evaluateLocation(shift.entrada.latitude, shift.entrada.longitude) : null;
        const evalOut = shift.salida ? evaluateLocation(shift.salida.latitude, shift.salida.longitude) : null;

        const sedeInStr = evalIn ? evalIn.shortLabel : '---';
        const sedeOutStr = evalOut ? evalOut.shortLabel : '---';

        let detalleTurno = '';
        if (shift.isGuard24h) {
          detalleTurno = 'Guardia 24 Horas (Cruza al día siguiente)';
        } else if (shift.isOvernight) {
          const dInName = shift.dayOfWeek;
          const dOutName = shift.salida ? new Intl.DateTimeFormat('es-ES', { weekday: 'long' }).format(new Date(shift.salida.timestamp)) : '';
          detalleTurno = `Guardia Nocturna (Inició ${dInName} y salió ${dOutName} por la mañana)`;
        } else if (shift.status === 'EN_CURSO') {
          detalleTurno = 'Turno en curso activo';
        } else if (shift.status === 'SIN_SALIDA') {
          detalleTurno = 'Sin marcación de salida';
        } else if (shift.status === 'SIN_ENTRADA') {
          detalleTurno = 'Sin marcación de entrada previa';
        } else {
          detalleTurno = 'Jornada diurna estándar';
        }

        const userObs = [shift.entrada?.observation, shift.salida?.observation].filter(Boolean).join(' | ');
        const obsFinal = userObs ? `${detalleTurno} | Nota: ${userObs}` : detalleTurno;

        const row = worksheet.addRow([
          shift.dateLabel,
          inStr,
          sedeInStr,
          fechaSalidaStr,
          horaSalidaStr,
          sedeOutStr,
          shift.durationLabel !== '--' ? shift.durationLabel : '---',
          obsFinal
        ]);

        for (let i = 1; i <= 8; i++) {
          const cell = row.getCell(i);
          cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
          cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
        }

        if (shift.isOvernight) {
          row.getCell(4).font = { bold: true, color: { argb: 'FF1D4ED8' } };
          row.getCell(5).font = { bold: true, color: { argb: 'FF1D4ED8' } };
        }
        if (shift.durationLabel !== '--') {
          row.getCell(7).font = { bold: true };
        }
      });

      // Fila de Totales
      worksheet.addRow([]);
      const totalRow = worksheet.addRow([
        'TOTALES DEL MES:',
        '',
        '',
        '',
        'HORAS ACUMULADAS:',
        shiftMetrics.totalHoursStr,
        '',
        `${shiftMetrics.totalShifts} jornadas (${shiftMetrics.completeCount} completas, ${shiftMetrics.overnightCount} nocturnas)`
      ]);
      totalRow.eachCell((cell) => {
        cell.font = { bold: true };
      });

      // Espacio para la firma
      worksheet.addRow([]);
      worksheet.addRow([]);
      worksheet.addRow([]);
      const signRow1 = worksheet.addRow(['', '', '', '', '____________________________________', '', '']);
      const signRow2 = worksheet.addRow(['', '', '', '', 'Firma y Sello de Administración', '', '']);
      worksheet.mergeCells(`E${signRow1.number}:F${signRow1.number}`);
      worksheet.mergeCells(`E${signRow2.number}:F${signRow2.number}`);
      signRow1.getCell(5).alignment = { horizontal: 'center' };
      signRow2.getCell(5).alignment = { horizontal: 'center' };
      signRow2.getCell(5).font = { bold: true };

    } else {
      // --- REPORTE GENERAL CON JORNADAS PAREADAS ---
      worksheet.mergeCells('A1:I1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = `PLANILLA GENERAL DE JORNADAS Y ASISTENCIA - MES: ${month} (${sedeLabel.toUpperCase()})`;
      titleCell.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7C2128' } };
      titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
      worksheet.getRow(1).height = 32;

      worksheet.addRow([]);

      const headerRow = worksheet.addRow([
        'Fecha Inicio',
        'CI',
        'Funcionario',
        'Hora Entrada',
        'Fecha de Salida',
        'Hora Salida',
        'Sede Institucional',
        'Horas Trabajadas',
        'Detalle del Turno / Observaciones'
      ]);
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2A2F3D' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      });

      worksheet.columns = [
        { width: 22 }, // Fecha Inicio
        { width: 14 }, // CI
        { width: 32 }, // Nombre
        { width: 15 }, // Hora Entrada
        { width: 30 }, // Fecha Salida
        { width: 15 }, // Hora Salida
        { width: 22 }, // Sede
        { width: 18 }, // Horas
        { width: 42 }, // Detalle
      ];

      workdayShifts.forEach((shift) => {
        const inStr = shift.entrada
          ? new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' }).format(new Date(shift.entrada.timestamp))
          : '---';

        let fechaSalidaStr = '---';
        let horaSalidaStr = '---';

        if (shift.salida) {
          horaSalidaStr = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' }).format(new Date(shift.salida.timestamp));
          const dOut = new Date(shift.salida.timestamp);
          const dateOutFull = new Intl.DateTimeFormat('es-ES', { 
            weekday: 'short', day: '2-digit', month: 'short' 
          }).format(dOut);

          if (shift.isOvernight) {
            fechaSalidaStr = `${dateOutFull} (Día Siguiente)`;
          } else {
            fechaSalidaStr = `${dateOutFull} (Mismo Día)`;
          }
        } else if (shift.status === 'EN_CURSO') {
          fechaSalidaStr = 'En Curso (Pendiente)';
          horaSalidaStr = '---';
        } else if (shift.status === 'SIN_SALIDA') {
          fechaSalidaStr = 'Sin Marcación de Salida';
          horaSalidaStr = '---';
        }

        const evalIn = shift.entrada ? evaluateLocation(shift.entrada.latitude, shift.entrada.longitude) : null;
        const evalOut = shift.salida ? evaluateLocation(shift.salida.latitude, shift.salida.longitude) : null;
        const sedeStr = evalIn ? evalIn.shortLabel : (evalOut ? evalOut.shortLabel : '---');

        let tipoTurno = 'Turno Diurno';
        if (shift.isGuard24h) tipoTurno = 'Guardia 24 Horas';
        else if (shift.isOvernight) tipoTurno = 'Guardia Nocturna (Salió al día siguiente)';
        else if (shift.status === 'EN_CURSO') tipoTurno = 'En Curso';
        else if (shift.status === 'SIN_SALIDA') tipoTurno = 'Sin Salida';
        else if (shift.status === 'SIN_ENTRADA') tipoTurno = 'Sin Entrada';

        const userObs = [shift.entrada?.observation, shift.salida?.observation].filter(Boolean).join(' | ');
        const obsFinal = userObs ? `${tipoTurno} - Nota: ${userObs}` : tipoTurno;

        const row = worksheet.addRow([
          shift.dateLabel,
          shift.employee.ci,
          `${shift.employee.firstName} ${shift.employee.lastName}`,
          inStr,
          fechaSalidaStr,
          horaSalidaStr,
          sedeStr,
          shift.durationLabel !== '--' ? shift.durationLabel : '---',
          obsFinal
        ]);

        for (let i = 1; i <= 9; i++) {
          const cell = row.getCell(i);
          cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
          cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
        }

        if (shift.isOvernight) {
          row.getCell(5).font = { bold: true, color: { argb: 'FF1D4ED8' } };
          row.getCell(6).font = { bold: true, color: { argb: 'FF1D4ED8' } };
        }
        if (shift.durationLabel !== '--') {
          row.getCell(8).font = { bold: true };
        }
      });
    }

    const sanitizeFileName = (str: string) => str.replace(/[^a-zA-Z0-9_\-]/g, '_');
    const fileName = isIndividual && selectedEmp 
      ? `Planilla_Asistencia_${sanitizeFileName(selectedEmp.firstName)}_${sanitizeFileName(selectedEmp.lastName)}_${month}.xlsx`
      : `Planilla_General_Jornadas_AFEMEC_${month}.xlsx`;

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

  const formatHourMin = (dateObj: Date | string) => {
    return new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' }).format(new Date(dateObj));
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      
      {/* 1. Encabezado Principal y Acción de Exportar */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2.5">
            <span>Control de Asistencia</span>
            <span className="bg-red-50 text-red-800 text-xs font-bold px-2.5 py-0.5 rounded-full border border-red-200">
              AFEMEC
            </span>
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Planilla interactiva con cálculo de turnos de guardias, horas cumplidas y control biométrico
          </p>
        </div>

        <button 
          onClick={handleExportExcel}
          disabled={loading || (viewMode === 'PLANILLA' ? workdayShifts.length === 0 : filteredAttendances.length === 0)}
          className="flex items-center justify-center gap-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl shadow-sm hover:shadow-md transition-all font-semibold text-sm w-full md:w-auto shrink-0"
        >
          <Download className="w-4 h-4" />
          Exportar Planilla Excel
        </button>
      </div>

      {/* 2. Barra de Filtros Inteligentes */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          
          {/* Filtro 1: Buscador de Funcionario */}
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
                autoComplete="off"
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

            {/* Menú de Sugerencias */}
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

          {/* Filtro 2: Período por Mes */}
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

          {/* Filtro 3: Sede Institucional */}
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

      {/* 3. Selector de Pestañas de Vista */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="inline-flex p-1 bg-gray-100 rounded-xl border border-gray-200 shadow-inner">
          <button
            type="button"
            onClick={() => setViewMode('PLANILLA')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'PLANILLA'
                ? 'bg-white text-red-900 shadow-sm border border-gray-200/60'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Calendar className="w-4 h-4 text-red-800" />
            <span>Vista Planilla (Jornadas y Turnos)</span>
            <span className="ml-1 bg-red-100 text-red-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
              {loading ? '...' : workdayShifts.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('DETALLE')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'DETALLE'
                ? 'bg-white text-gray-900 shadow-sm border border-gray-200/60'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Clock className="w-4 h-4 text-gray-500" />
            <span>Vista Historial de Marcaciones</span>
            <span className="ml-1 bg-gray-200 text-gray-700 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
              {loading ? '...' : filteredAttendances.length}
            </span>
          </button>
        </div>

        {viewMode === 'PLANILLA' && selectedEmpObj && (
          <div className="text-xs font-semibold text-gray-600 bg-white px-3.5 py-1.5 rounded-lg border border-gray-200 shadow-sm flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            Planilla mensual de <b className="text-gray-900">{selectedEmpObj.firstName} {selectedEmpObj.lastName}</b>
          </div>
        )}
      </div>

      {/* 4. Indicadores Estadísticos Dinámicos según la vista activa */}
      {viewMode === 'PLANILLA' ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-center items-center">
            <span className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Jornadas / Turnos</span>
            <span className="text-2xl font-black text-gray-900">
              {loading ? <Loader2 className="w-5 h-5 animate-spin text-gray-400" /> : shiftMetrics.totalShifts}
            </span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-center items-center">
            <span className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Horas Acumuladas</span>
            <span className="text-2xl font-black text-blue-700">
              {loading ? <Loader2 className="w-5 h-5 animate-spin text-gray-400" /> : shiftMetrics.totalHoursStr}
            </span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-center items-center">
            <span className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Turnos Completos</span>
            <span className="text-2xl font-black text-green-600">
              {loading ? <Loader2 className="w-5 h-5 animate-spin text-gray-400" /> : shiftMetrics.completeCount}
            </span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-center items-center">
            <span className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
              <Moon className="w-3.5 h-3.5 text-indigo-500" />
              <span>Guardias (+1 día)</span>
            </span>
            <span className="text-2xl font-black text-indigo-600">
              {loading ? <Loader2 className="w-5 h-5 animate-spin text-gray-400" /> : shiftMetrics.overnightCount}
            </span>
          </div>

          <div className="col-span-2 md:col-span-1 bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-center items-center">
            <span className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Alertas / Incompletos</span>
            <span className={`text-2xl font-black ${shiftMetrics.alertCount > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
              {loading ? <Loader2 className="w-5 h-5 animate-spin text-gray-400" /> : shiftMetrics.alertCount}
            </span>
          </div>
        </div>
      ) : (
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
      )}

      {/* 5. TABLA PRINCIPAL DE ASISTENCIAS */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          {viewMode === 'PLANILLA' ? (
            /* TABLA VISTA PLANILLA (JORNADAS PAREADAS) */
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50/90 text-gray-500 text-[11px] font-black uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5 text-left">Día y Jornada</th>
                  <th className="px-5 py-3.5 text-left">Funcionario</th>
                  <th className="px-5 py-3.5 text-left">Entrada (Selfie + Hora)</th>
                  <th className="px-5 py-3.5 text-left">Salida (Selfie + Hora)</th>
                  <th className="px-5 py-3.5 text-center">Horas Cumplidas</th>
                  <th className="px-5 py-3.5 text-left">Estado / Observación</th>
                  <th className="px-4 py-3.5 text-center">Detalles</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100 text-gray-800 text-sm">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center text-gray-500 font-medium">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-red-800" />
                      Organizando planilla de jornadas y turnos...
                    </td>
                  </tr>
                ) : workdayShifts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center text-gray-500 font-medium">
                      <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                      No se encontraron jornadas en este período para los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  workdayShifts.map((shift) => {
                    const evalIn = shift.entrada ? evaluateLocation(shift.entrada.latitude, shift.entrada.longitude) : null;
                    const evalOut = shift.salida ? evaluateLocation(shift.salida.latitude, shift.salida.longitude) : null;

                    return (
                      <tr 
                        key={shift.id} 
                        className="hover:bg-red-50/40 transition-colors group"
                      >
                        {/* 1. Día y Jornada */}
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="font-bold text-gray-900 capitalize flex items-center gap-1.5">
                            <span>{shift.dateLabel}</span>
                          </div>
                          <div className="text-xs text-gray-400 font-medium capitalize mt-0.5 flex items-center gap-1">
                            <span>{shift.dayOfWeek}</span>
                            {shift.isOvernight && (
                              <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-md border border-indigo-200">
                                <Moon className="w-3 h-3" /> Guardia Nocturna (Cruza medianoche)
                              </span>
                            )}
                            {shift.isGuard24h && (
                              <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 text-[10px] font-bold px-2 py-0.5 rounded-md border border-purple-200">
                                <Shield className="w-3 h-3" /> Guardia 24h
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 2. Funcionario */}
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="font-bold text-gray-900 capitalize">
                            {shift.employee.firstName} {shift.employee.lastName}
                          </div>
                          <div className="text-gray-400 text-xs font-mono">
                            CI: {shift.employee.ci}
                          </div>
                        </td>

                        {/* 3. Entrada */}
                        <td className="px-5 py-4 whitespace-nowrap">
                          {shift.entrada ? (
                            <div className="flex items-center gap-3">
                              <div 
                                onClick={() => { setSelectedRecord(shift.entrada); setObservationText(shift.entrada.observation || ''); }}
                                className="relative w-11 h-11 rounded-xl overflow-hidden border-2 border-green-200 shadow-sm bg-gray-100 cursor-pointer hover:ring-2 hover:ring-green-400 transition-all shrink-0"
                                title="Ver selfie de entrada"
                              >
                                {shift.entrada.photoBase64 ? (
                                  <img src={shift.entrada.photoBase64} alt="Selfie Entrada" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-xs font-bold text-gray-400">Sin foto</div>
                                )}
                              </div>
                              <div className="flex flex-col">
                                <span className="font-extrabold text-gray-900 text-sm">
                                  {formatHourMin(shift.entrada.timestamp)}
                                </span>
                                {evalIn && (
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded w-max mt-0.5 ${
                                    evalIn.inRange ? 'text-green-700 bg-green-50' : 'text-orange-700 bg-orange-50'
                                  }`}>
                                    {evalIn.shortLabel}
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-md font-semibold border border-amber-200">
                              Sin Entrada
                            </span>
                          )}
                        </td>

                        {/* 4. Salida */}
                        <td className="px-5 py-4 whitespace-nowrap">
                          {shift.salida ? (
                            <div className="flex items-center gap-3">
                              <div 
                                onClick={() => { setSelectedRecord(shift.salida); setObservationText(shift.salida.observation || ''); }}
                                className="relative w-11 h-11 rounded-xl overflow-hidden border-2 border-red-200 shadow-sm bg-gray-100 cursor-pointer hover:ring-2 hover:ring-red-400 transition-all shrink-0"
                                title="Ver selfie de salida"
                              >
                                {shift.salida.photoBase64 ? (
                                  <img src={shift.salida.photoBase64} alt="Selfie Salida" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-xs font-bold text-gray-400">Sin foto</div>
                                )}
                              </div>
                              <div className="flex flex-col">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-extrabold text-gray-900 text-sm">
                                    {formatHourMin(shift.salida.timestamp)}
                                  </span>
                                  {shift.isOvernight && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded capitalize">
                                      <Moon className="w-2.5 h-2.5 text-indigo-600" />
                                      {new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: '2-digit', month: 'short' }).format(new Date(shift.salida.timestamp))} (Día sig.)
                                    </span>
                                  )}
                                </div>
                                {evalOut && (
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded w-max mt-0.5 ${
                                    evalOut.inRange ? 'text-green-700 bg-green-50' : 'text-orange-700 bg-orange-50'
                                  }`}>
                                    {evalOut.shortLabel}
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : shift.status === 'EN_CURSO' ? (
                            <div className="flex items-center gap-1.5 text-xs text-blue-700 bg-blue-50 px-2.5 py-1.5 rounded-lg font-bold border border-blue-200 w-max">
                              <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping"></span>
                              <span>Turno en curso</span>
                            </div>
                          ) : (
                            <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded-md font-semibold border border-red-200">
                              Sin Salida
                            </span>
                          )}
                        </td>

                        {/* 5. Horas Cumplidas */}
                        <td className="px-5 py-4 whitespace-nowrap text-center">
                          {shift.durationLabel !== '--' ? (
                            <div className="inline-flex flex-col items-center">
                              <span className="text-base font-black text-gray-900 font-mono tracking-tight">
                                {shift.durationLabel}
                              </span>
                              <span className="text-[10px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full mt-0.5">
                                Jornada {shift.isGuard24h ? '24h' : shift.isOvernight ? 'Guardia 12h' : 'Estándar'}
                              </span>
                            </div>
                          ) : shift.status === 'EN_CURSO' ? (
                            <span className="text-xs font-semibold text-gray-400 italic">Calculando al salir</span>
                          ) : (
                            <span className="text-xs font-semibold text-gray-300">--</span>
                          )}
                        </td>

                        {/* 6. Estado y Observación */}
                        <td className="px-5 py-4 text-xs">
                          {shift.status === 'COMPLETA' ? (
                            <span className="inline-flex items-center gap-1 text-green-700 font-bold bg-green-50 border border-green-200 px-2 py-0.5 rounded-md">
                              <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> Completa
                            </span>
                          ) : shift.status === 'EN_CURSO' ? (
                            <span className="inline-flex items-center gap-1 text-blue-700 font-bold bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                              <Clock className="w-3.5 h-3.5 text-blue-600" /> En Turno
                            </span>
                          ) : shift.status === 'SIN_SALIDA' ? (
                            <span className="inline-flex items-center gap-1 text-amber-700 font-bold bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Sin Salida
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-amber-700 font-bold bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Sin Entrada
                            </span>
                          )}

                          {(shift.entrada?.observation || shift.salida?.observation) && (
                            <p className="text-[11px] text-gray-500 italic mt-1 line-clamp-2 max-w-[220px]">
                              &quot;{[shift.entrada?.observation, shift.salida?.observation].filter(Boolean).join(' | ')}&quot;
                            </p>
                          )}
                        </td>

                        {/* 7. Acciones */}
                        <td className="px-4 py-4 whitespace-nowrap text-center">
                          <button
                            type="button"
                            onClick={() => {
                              const targetRec = shift.entrada || shift.salida;
                              setSelectedRecord(targetRec);
                              setObservationText(targetRec?.observation || '');
                            }}
                            className="p-2 text-gray-400 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                            title="Ver detalle completo de la jornada"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          ) : (
            /* TABLA VISTA HISTORIAL DETALLADO (REGISTROS EN BRUTO) */
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
                            record.type === 'ENTRADA' ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'
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
          )}
        </div>
      </div>

      {/* Modal para Detalles, Foto Ampliada y Observación */}
      {selectedRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col md:flex-row overflow-hidden">
            {/* Izquierda: Foto y Mapa */}
            <div className="bg-gray-100 p-6 flex flex-col items-center justify-center border-r md:w-1/2">
              {selectedRecord.photoBase64 ? (
                <img src={selectedRecord.photoBase64} alt="Selfie Completa" className="w-48 h-48 rounded-xl object-cover shadow-md mb-4 border-2 border-white" />
              ) : (
                <div className="w-48 h-48 bg-gray-200 rounded-xl flex items-center justify-center mb-4">
                  <span className="text-gray-500 text-sm font-semibold">Sin foto registrada</span>
                </div>
              )}
              <a 
                href={`https://www.google.com/maps/search/?api=1&query=${selectedRecord.latitude},${selectedRecord.longitude}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl transition-all w-full shadow-sm text-sm font-semibold"
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
              <h3 className="text-xl font-bold mb-1 text-gray-900">Detalles de Marcación</h3>
              <p className="text-sm text-gray-500 mb-6 border-b pb-4">
                <span className="font-bold text-gray-800 text-base">{selectedRecord.employee.firstName} {selectedRecord.employee.lastName}</span> <br/>
                <span className="font-mono text-xs text-gray-500">CI: {selectedRecord.employee.ci}</span> <br/>
                <span className={`inline-block mt-2 px-2.5 py-0.5 text-xs font-bold rounded ${selectedRecord.type === 'ENTRADA' ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'}`}>
                  {selectedRecord.type}
                </span> el {new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(selectedRecord.timestamp))}
              </p>

              <label className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Observación (Admin / Empleado)</label>
              <textarea
                className="w-full border-2 border-gray-200 rounded-xl p-3 mb-4 text-gray-800 focus:border-red-800 focus:ring-0 outline-none resize-none flex-1 text-sm transition-all"
                value={observationText}
                onChange={(e) => setObservationText(e.target.value)}
                placeholder="Escribe o edita la observación aquí..."
              ></textarea>
              
              <div className="flex justify-between items-center mt-auto">
                <button 
                  type="button"
                  onClick={() => handleDeleteRecord(selectedRecord.id)}
                  className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-2.5 rounded-xl transition-colors"
                  title="Eliminar este registro"
                >
                  <Trash2 className="w-5 h-5" />
                </button>

                <div className="flex gap-2">
                  <button 
                    type="button"
                    onClick={() => setSelectedRecord(null)}
                    className="px-4 py-2 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 text-sm font-semibold transition-colors"
                  >
                    Cerrar
                  </button>
                  <button 
                    type="button"
                    onClick={handleSaveObservation}
                    className="px-5 py-2 bg-red-800 hover:bg-red-900 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
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
