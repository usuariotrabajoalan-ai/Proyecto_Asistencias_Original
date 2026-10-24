import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ADMIN_COOKIE_NAME, verifyAdminToken } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  // 1. Proteger APIs administrativas de asistencias
  const isAttendanceAdminApi = 
    (pathname === '/api/attendance' && method === 'GET') ||
    (pathname.startsWith('/api/attendance/') && (method === 'PUT' || method === 'DELETE'));

  // 2. Proteger APIs administrativas de empleados
  const isEmployeeAdminApi =
    (pathname === '/api/employees' && (method === 'GET' || method === 'POST')) ||
    (pathname.startsWith('/api/employees/') && (method === 'PUT' || method === 'DELETE'));

  if (isAttendanceAdminApi || isEmployeeAdminApi) {
    const sessionToken = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
    const isValid = await verifyAdminToken(sessionToken);

    if (!isValid) {
      return NextResponse.json(
        { error: 'No autorizado. Se requiere sesión de administrador activa.' },
        { status: 401 }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/api/attendance/:path*',
    '/api/employees/:path*',
  ],
};
