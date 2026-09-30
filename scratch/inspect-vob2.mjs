import { PrismaClient } from 'file:///C:/VOB\'s/US24-VOB/node_modules/@prisma/client/default.js';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres.gzeivxscvsrvkecahafl:Ranisingh%40123@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require"
    }
  }
});

async function run() {
  const vob = await prisma.vob.findUnique({
    where: { id: '05b85f03-f3ca-4bb7-9c21-478df5dfa745' }
  });
  console.log(JSON.stringify(vob, null, 2));
}

run().catch(console.error).finally(() => prisma.$disconnect());
