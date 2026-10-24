export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const record = await prisma.attendanceRecord.findUnique({
      where: { id },
      select: { photoBase64: true },
    });

    if (!record || !record.photoBase64) {
      return new NextResponse('Foto no encontrada', { status: 404 });
    }

    let mimeType = 'image/jpeg';
    let base64Data = record.photoBase64;

    if (base64Data.startsWith('data:')) {
      const match = base64Data.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        base64Data = match[2];
      }
    }

    const imageBuffer = Buffer.from(base64Data, 'base64');

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Length': imageBuffer.length.toString(),
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      },
    });
  } catch (error) {
    console.error('Error fetching attendance photo:', error);
    return new NextResponse('Error al cargar imagen', { status: 500 });
  }
}
