import { PrismaClient } from 'file:///C:/VOB\'s/US24-VOB/node_modules/@prisma/client/default.js';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres.gzeivxscvsrvkecahafl:Ranisingh%40123@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require"
    }
  }
});

async function run() {
  const vobs = await prisma.vob.findMany({
    select: {
      id: true,
      status: true,
      failures: true,
      authorizationRequired: true,
      authNumber: true,
      authValidFrom: true,
      authValidTo: true,
      extra: true
    }
  });
  console.log(`Total VOBs: ${vobs.length}`);
  const byStatus = {};
  for (const v of vobs) {
    byStatus[v.status] = (byStatus[v.status] || 0) + 1;
    if (v.status === 'error' || v.status === 'auth_queue') {
      console.log(`[${v.status}] ID: ${v.id}, failures: ${JSON.stringify(v.failures)}, authRequired: ${v.authorizationRequired}, authNumber: ${v.authNumber}`);
    }
  }
  console.log('By status:', byStatus);
}

run().catch(console.error).finally(() => prisma.$disconnect());
