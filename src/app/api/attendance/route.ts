export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month'); // Formato: YYYY-MM
    const employeeId = searchParams.get('employeeId');
    
    let dateFilter = {};
    if (month) {
      const startDate = new Date(`${month}-01T00:00:00.000Z`);
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 1);
      
      dateFilter = {
        timestamp: {
          gte: startDate,
          lt: endDate
        }
      };
    }

    const whereClause: any = { ...dateFilter };
    if (employeeId) {
      whereClause.employeeId = employeeId;
    }

    const attendances = await prisma.attendanceRecord.findMany({
      where: whereClause,
      include: {
        employee: true
      },
      orderBy: {
        timestamp: 'desc'
      }
    });

    return NextResponse.json(attendances);
  } catch (error) {
    console.error('Error fetching attendances:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { ci, type, latitude, longitude, photoBase64, observation } = body;

    if (!ci || !type) {
      return NextResponse.json({ error: 'CI y tipo son requeridos' }, { status: 400 });
    }

    if (type !== 'ENTRADA' && type !== 'SALIDA') {
      return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 });
    }

    const employee = await prisma.employee.findUnique({ where: { ci } });
    if (!employee) {
      return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
    }

    const attendance = await prisma.attendanceRecord.create({
      data: {
        employeeId: employee.id,
        type,
        latitude,
        longitude,
        photoBase64,
        observation,
        // El servidor asigna la fecha automáticamente (default now())
      },
      include: {
        employee: true
      }
    });

    return NextResponse.json(attendance, { status: 201 });
  } catch (error) {
    console.error('Error registering attendance:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

