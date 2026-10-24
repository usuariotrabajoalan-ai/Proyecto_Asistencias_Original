export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month'); // Formato: YYYY-MM
    const employeeId = searchParams.get('employeeId');
    const includeRawPhotos = searchParams.get('includePhotos') === 'true';

    let dateFilter = {};
    if (month) {
      const startDate = new Date(`${month}-01T00:00:00.000Z`);
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 1);

      dateFilter = {
        timestamp: {
          gte: startDate,
          lt: endDate,
        },
      };
    }

    const whereClause: any = { ...dateFilter };
    if (employeeId) {
      whereClause.employeeId = employeeId;
    }

    if (includeRawPhotos) {
      // Modo retrocompatible explícito si alguien requiere las fotos inline
      const attendances = await prisma.attendanceRecord.findMany({
        where: whereClause,
        include: {
          employee: true,
        },
        orderBy: {
          timestamp: 'desc',
        },
      });
      return NextResponse.json(attendances);
    }

    // Consulta ultra-optimizada para evitar superar el límite de payload de Vercel (4.5 MB).
    // Omitimos photoBase64 de la transferencia y proveemos photoUrl bajo demanda.
    const records = await prisma.attendanceRecord.findMany({
      where: whereClause,
      select: {
        id: true,
        employeeId: true,
        type: true,
        timestamp: true,
        latitude: true,
        longitude: true,
        observation: true,
        employee: true,
      },
      orderBy: {
        timestamp: 'desc',
      },
    });

    const attendances = records.map((r) => ({
      ...r,
      hasPhoto: true,
      photoUrl: `/api/attendance/${r.id}/photo`,
      photoBase64: null,
    }));

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

    if (!ci || typeof ci !== 'string' || ci.trim().length === 0) {
      return NextResponse.json({ error: 'CI es requerido y debe ser válido' }, { status: 400 });
    }

    const cleanCi = ci.trim();

    if (!type || (type !== 'ENTRADA' && type !== 'SALIDA')) {
      return NextResponse.json({ error: 'Tipo inválido (debe ser ENTRADA o SALIDA)' }, { status: 400 });
    }

    // Validación robusta de coordenadas geográficas
    let validLat: number | null = null;
    let validLng: number | null = null;
    if (typeof latitude === 'number' && !isNaN(latitude) && latitude >= -90 && latitude <= 90) {
      validLat = latitude;
    }
    if (typeof longitude === 'number' && !isNaN(longitude) && longitude >= -180 && longitude <= 180) {
      validLng = longitude;
    }

    // Sanitización de foto y observación
    let cleanPhoto: string | null = null;
    if (photoBase64 && typeof photoBase64 === 'string') {
      if (photoBase64.length < 7 * 1024 * 1024) {
        cleanPhoto = photoBase64;
      }
    }

    let cleanObservation: string | null = null;
    if (observation && typeof observation === 'string') {
      cleanObservation = observation.trim().slice(0, 500);
    }

    const employee = await prisma.employee.findUnique({ where: { ci: cleanCi } });
    if (!employee) {
      return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
    }

    const attendance = await prisma.attendanceRecord.create({
      data: {
        employeeId: employee.id,
        type,
        latitude: validLat,
        longitude: validLng,
        photoBase64: cleanPhoto,
        observation: cleanObservation,
      },
      include: {
        employee: true,
      },
    });

    return NextResponse.json(attendance, { status: 201 });
  } catch (error) {
    console.error('Error registering attendance:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
