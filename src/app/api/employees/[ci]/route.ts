import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: { ci: string } }
) {
  try {
    const { ci } = await params;
    // Buscamos si es un ID de prisma (cuid) o una cédula
    const isId = ci.startsWith('c');
    
    const employee = await prisma.employee.findFirst({
      where: isId ? { id: ci } : { ci: ci }
    });
    
    if (!employee) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    return NextResponse.json(employee);
  } catch (error) {
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { ci: string } }
) {
  try {
    const { ci: paramId } = await params;
    const body = await request.json();
    const { ci, firstName, lastName } = body;
    
    const employee = await prisma.employee.update({
      where: { id: paramId },
      data: { ci, firstName, lastName }
    });
    return NextResponse.json(employee);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Esa CI ya está registrada.' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { ci: string } }
) {
  try {
    const { ci: paramId } = await params;
    
    // Identificamos si nos pasaron un ID o una CI
    const isId = paramId.startsWith('c');
    const employee = await prisma.employee.findFirst({
      where: isId ? { id: paramId } : { ci: paramId }
    });

    if (!employee) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    await prisma.attendanceRecord.deleteMany({ where: { employeeId: employee.id } });
    await prisma.employee.delete({ where: { id: employee.id } });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE Error:', error);
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 });
  }
}
