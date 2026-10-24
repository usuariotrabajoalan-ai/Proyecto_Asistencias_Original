export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { 
  ADMIN_COOKIE_NAME, 
  ADMIN_COOKIE_OPTIONS, 
  createAdminToken, 
  verifyPassword, 
  hashPassword 
} from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { password } = await request.json();
    if (!password || typeof password !== 'string') {
      return NextResponse.json({ error: 'Contraseña requerida' }, { status: 400 });
    }
    
    let config = await prisma.asistenciaConfig.findUnique({ where: { id: 'main' } });
    if (!config) {
      const initialHash = await hashPassword('admin123');
      config = await prisma.asistenciaConfig.create({ 
        data: { id: 'main', adminPassword: initialHash } 
      });
    }

    const verification = await verifyPassword(password, config.adminPassword);

    if (verification.valid) {
      // Migración silenciosa de contraseña en texto plano si correspondiera
      if (verification.needsRehash) {
        try {
          const secureHash = await hashPassword(password);
          await prisma.asistenciaConfig.update({
            where: { id: 'main' },
            data: { adminPassword: secureHash }
          });
        } catch (migrationErr) {
          console.warn('Advertencia migrando hash:', migrationErr);
        }
      }

      const token = await createAdminToken();
      const response = NextResponse.json({ success: true });
      response.cookies.set(ADMIN_COOKIE_NAME, token, ADMIN_COOKIE_OPTIONS);
      return response;
    } else {
      return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 401 });
    }
  } catch (error) {
    console.error('Error en autenticación:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { currentPassword, newPassword } = await request.json();

    if (!newPassword || newPassword.length < 4) {
      return NextResponse.json({ error: 'La nueva contraseña debe tener al menos 4 caracteres' }, { status: 400 });
    }

    let config = await prisma.asistenciaConfig.findUnique({ where: { id: 'main' } });
    if (!config) {
      const initialHash = await hashPassword('admin123');
      config = await prisma.asistenciaConfig.create({ 
        data: { id: 'main', adminPassword: initialHash } 
      });
    }

    const verification = await verifyPassword(currentPassword, config.adminPassword);
    if (!verification.valid) {
      return NextResponse.json({ error: 'La contraseña actual es incorrecta' }, { status: 401 });
    }

    const secureHash = await hashPassword(newPassword);
    await prisma.asistenciaConfig.update({
      where: { id: 'main' },
      data: { adminPassword: secureHash }
    });

    const token = await createAdminToken();
    const response = NextResponse.json({ success: true });
    response.cookies.set(ADMIN_COOKIE_NAME, token, ADMIN_COOKIE_OPTIONS);
    return response;
  } catch (error) {
    console.error('Error actualizando contraseña:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
