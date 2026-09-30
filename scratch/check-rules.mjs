import { PrismaClient } from 'file:///C:/VOB\'s/US24-VOB/node_modules/@prisma/client/default.js';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://app_role.gzeivxscvsrvkecahafl:QWICkpbUVz8JBebg0YLt_e_4J-kUVymc@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require"
    }
  }
});

async function run() {
  const formats = await prisma.clientFormat.findMany({
    include: {
      columns: { where: { required: true } },
      rules: { where: { active: true } },
      client: true
    }
  });
  for (const f of formats) {
    console.log('=== Client:', f.client.name, '===');
    console.log('Required columns:');
    for (const c of f.columns) {
      console.log(' -', c.canonicalField || c.extraKey, ':', c.label);
    }
    console.log('Rules:');
    for (const r of f.rules) {
      console.log(' -', r.field, r.type, r.message);
    }
  }
}

run().catch(console.error).finally(() => prisma.$disconnect());
