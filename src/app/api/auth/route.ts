export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { password } = await request.json();
    
    let config = await prisma.asistenciaConfig.findUnique({ where: { id: 'main' } });
    if (!config) {
      config = await prisma.asistenciaConfig.create({ data: { id: 'main', adminPassword: 'admin123' } });
    }

    if (password === config.adminPassword) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 401 });
    }
  } catch (error) {
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { currentPassword, newPassword } = await request.json();

    let config = await prisma.asistenciaConfig.findUnique({ where: { id: 'main' } });
    if (!config) {
      config = await prisma.asistenciaConfig.create({ data: { id: 'main', adminPassword: 'admin123' } });
    }

    if (currentPassword !== config.adminPassword) {
      return NextResponse.json({ error: 'La contraseña actual es incorrecta' }, { status: 401 });
    }

    await prisma.asistenciaConfig.update({
      where: { id: 'main' },
      data: { adminPassword: newPassword }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}


