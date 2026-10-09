const { PrismaClient } = require("c:/VOB's/US24-VOB/node_modules/@prisma/client");
const bcrypt = require("c:/VOB's/US24-VOB/node_modules/bcryptjs");
const fs = require('fs');

const envText = fs.readFileSync("c:/VOB's/US24-VOB/.env", 'utf8');
const directUrl = envText.match(/DIRECT_URL="([^"]+)"/)[1];

const prisma = new PrismaClient({ datasources: { db: { url: directUrl } } });

async function main() {
  const user = await prisma.appUser.findUnique({ where: { email: 'user@us24.test' } });
  console.log('user@us24.test hash:', user.devPasswordHash);
  
  // Test common words
  const list = ['password', 'password123', 'Password123!', 'test', 'user', 'user123', 'admin', 'admin123', '12345678', 'Welcome123!', 'Welcome@123'];
  for (const p of list) {
    if (await bcrypt.compare(p, user.devPasswordHash)) {
      console.log('Match found! Password is:', p);
      return;
    }
  }
  console.log('No match found in common list.');
}

main().finally(() => prisma.$disconnect());
