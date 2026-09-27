import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Esta consulta es ultra rápida, solo sirve para que Supabase registre actividad
    // y no ponga la base de datos a dormir (por inactividad de 7 días).
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ message: 'Robot despertador ejecutado exitosamente. Supabase está vivo.' }, { status: 200 });
  } catch (error) {
    console.error('Error en el robot despertador:', error);
    return NextResponse.json({ error: 'Fallo al despertar Supabase' }, { status: 500 });
  }
}
