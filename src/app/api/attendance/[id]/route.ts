import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { observation } = body;

    const attendance = await prisma.attendanceRecord.update({
      where: { id },
      data: { observation },
    });

    return NextResponse.json(attendance);
  } catch (error) {
    console.error('Error updating observation:', error);
    return NextResponse.json({ error: 'Error al actualizar observación' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    await prisma.attendanceRecord.delete({
      where: { id },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting record:', error);
    return NextResponse.json({ error: 'Error al eliminar registro' }, { status: 500 });
  }
}


