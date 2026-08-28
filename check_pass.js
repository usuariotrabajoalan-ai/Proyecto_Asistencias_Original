const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const config = await prisma.asistenciaConfig.findUnique({ where: { id: 'main' } });
  console.log(config);
}
main().finally(() => prisma.$disconnect());
