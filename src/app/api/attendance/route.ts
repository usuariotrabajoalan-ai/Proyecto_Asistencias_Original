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
      const baseStart = new Date(`${month}-01T00:00:00.000Z`);
      const baseEnd = new Date(baseStart);
      baseEnd.setMonth(baseEnd.getMonth() + 1);

      // Margen de 36 horas antes y después para capturar turnos nocturnos/guardias que cruzan fin de mes
      const marginStart = new Date(baseStart.getTime() - 36 * 60 * 60 * 1000);
      const marginEnd = new Date(baseEnd.getTime() + 36 * 60 * 60 * 1000);

      dateFilter = {
        timestamp: {
          gte: marginStart,
          lt: marginEnd,
        },
      };
    }

    const whereClause: any = { ...dateFilter };
    if (employeeId) {
      whereClause.employeeId = employeeId;
    }

    const includePhotos = searchParams.get('includePhotos') === 'true';

    const attendances = await prisma.attendanceRecord.findMany({
      where: whereClause,
      include: {
        employee: true,
      },
      orderBy: {
        timestamp: 'desc',
      },
    });

    if (!includePhotos) {
      const lightweight = attendances.map((r) => ({
        id: r.id,
        employeeId: r.employeeId,
        type: r.type,
        timestamp: r.timestamp,
        latitude: r.latitude,
        longitude: r.longitude,
        observation: r.observation,
        hasPhoto: Boolean(r.photoBase64),
        employee: r.employee,
      }));
      return NextResponse.json(lightweight);
    }

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
