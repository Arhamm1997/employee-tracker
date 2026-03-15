import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const COMPANY_ID = 'cmmplmwiv0004fyjbae4gpp7q';

async function main() {
  // Delete related records first
  await prisma.emailVerificationToken.deleteMany({ where: { companyId: COMPANY_ID } });
  console.log('✓ Deleted email verification tokens');

  // Add more cleanup here if you hit more FK errors, e.g:
  // await prisma.employee.deleteMany({ where: { companyId: COMPANY_ID } });
  // await prisma.user.deleteMany({ where: { companyId: COMPANY_ID } });

  // Finally delete the company
  const deleted = await prisma.company.delete({ where: { id: COMPANY_ID } });
  console.log('✓ Deleted company:', deleted.name);
}

main().finally(() => prisma.$disconnect());