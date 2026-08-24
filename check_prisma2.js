const { PrismaClient } = require('@prisma/client');
async function run() {
  const prisma = new PrismaClient({
    datasourceUrl: 'postgresql://postgres.uwnqhalizmlzizfnhblp:Kt8AWKh*aPLY2Vt@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1'
  });
  try {
    const config = await prisma.asistenciaConfig.findUnique({ where: { id: 'main' } });
    console.log('Config:', config);
  } catch (err) {
    console.error('Prisma Error:', err);
  }
}
run();
