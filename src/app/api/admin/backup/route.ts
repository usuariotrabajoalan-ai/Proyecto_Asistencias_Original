export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';
import { ADMIN_COOKIE_NAME, verifyAdminToken } from '@/lib/auth';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
    const isValid = await verifyAdminToken(token);
    if (!isValid) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const employees = await prisma.employee.findMany({
      orderBy: { createdAt: 'asc' },
    });

    const attendances = await prisma.attendanceRecord.findMany({
      orderBy: { timestamp: 'asc' },
    });

    const backupPayload = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      institution: 'AFEMEC',
      system: 'Control de Asistencia del Personal',
      counts: {
        employees: employees.length,
        attendances: attendances.length,
      },
      data: {
        employees,
        attendances,
      },
    };

    const fileName = `Respaldo_AFEMEC_Asistencias_${new Date().toISOString().slice(0, 10)}.json`;

    return new NextResponse(JSON.stringify(backupPayload, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error('Error generating backup:', error);
    return NextResponse.json({ error: 'Error al generar la copia de seguridad' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
    const isValid = await verifyAdminToken(token);
    if (!isValid) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    if (!body || !body.data || !Array.isArray(body.data.employees)) {
      return NextResponse.json({ error: 'Formato de archivo de respaldo inválido' }, { status: 400 });
    }

    const { employees, attendances } = body.data;

    let restoredEmployees = 0;
    let restoredAttendances = 0;

    // Restaurar empleados con upsert para no duplicar ni generar inconsistencias
    for (const emp of employees) {
      if (!emp.id || !emp.ci) continue;
      await prisma.employee.upsert({
        where: { id: emp.id },
        update: {
          ci: emp.ci,
          firstName: emp.firstName,
          lastName: emp.lastName,
        },
        create: {
          id: emp.id,
          ci: emp.ci,
          firstName: emp.firstName,
          lastName: emp.lastName,
          createdAt: emp.createdAt ? new Date(emp.createdAt) : new Date(),
        },
      });
      restoredEmployees++;
    }

    // Restaurar marcaciones con upsert
    if (Array.isArray(attendances)) {
      for (const att of attendances) {
        if (!att.id || !att.employeeId) continue;
        await prisma.attendanceRecord.upsert({
          where: { id: att.id },
          update: {
            type: att.type,
            timestamp: new Date(att.timestamp),
            latitude: att.latitude,
            longitude: att.longitude,
            photoBase64: att.photoBase64,
            observation: att.observation,
          },
          create: {
            id: att.id,
            employeeId: att.employeeId,
            type: att.type,
            timestamp: new Date(att.timestamp),
            latitude: att.latitude,
            longitude: att.longitude,
            photoBase64: att.photoBase64,
            observation: att.observation,
          },
        });
        restoredAttendances++;
      }
    }

    return NextResponse.json({
      success: true,
      restoredEmployees,
      restoredAttendances,
    });
  } catch (error) {
    console.error('Error restoring backup:', error);
    return NextResponse.json({ error: 'Error al restaurar los datos' }, { status: 500 });
  }
}
