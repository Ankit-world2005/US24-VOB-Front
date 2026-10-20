const fs = require('fs');
const pg = require("c:/VOB's/US24-VOB/node_modules/pg");
const bcrypt = require("c:/VOB's/US24-VOB/node_modules/bcryptjs");

const envText = fs.readFileSync("c:/VOB's/US24-VOB/.env", 'utf8');
const directUrl = envText.match(/DIRECT_URL="([^"]+)"/)[1];

async function main() {
  const client = new pg.Client({ connectionString: directUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const res = await client.query('SELECT email, dev_password_hash FROM app_user WHERE email ILIKE $1;', ['saurabh@us24solutions.com']);
  const user = res.rows[0];
  console.log('User found:', user.email);
  console.log('Hash in DB:', user.dev_password_hash);
  
  const passwordsToTest = ['Kashi@123#', 'Kashi@123', 'kashi@123', 'DevPassword123!', 'password123', 'Welcome@123'];
  let matchedPassword = null;
  for (const p of passwordsToTest) {
    const match = await bcrypt.compare(p, user.dev_password_hash);
    console.log('Testing password:', p, '-> Match:', match);
    if (match) matchedPassword = p;
  }
  await client.end();

  if (matchedPassword) {
    console.log('\n--- Testing login against https://us-24-vob.vercel.app ---');
    try {
      const res1 = await fetch('https://us-24-vob.vercel.app/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'saurabh@us24solutions.com', password: matchedPassword })
      });
      console.log('Status us-24-vob:', res1.status);
      const json1 = await res1.json();
      console.log('Response us-24-vob:', json1);
    } catch (e) {
      console.error('Error us-24-vob:', e.message);
    }

    console.log('\n--- Testing login against https://us24-vob-uat.vercel.app ---');
    try {
      const res2 = await fetch('https://us24-vob-uat.vercel.app/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'saurabh@us24solutions.com', password: matchedPassword })
      });
      console.log('Status us24-vob-uat:', res2.status);
      const json2 = await res2.json();
      console.log('Response us24-vob-uat:', json2);
    } catch (e) {
      console.error('Error us24-vob-uat:', e.message);
    }

    console.log('\n--- Testing login against local backend http://localhost:8000 ---');
    try {
      const res3 = await fetch('http://localhost:8000/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'saurabh@us24solutions.com', password: matchedPassword })
      });
      console.log('Status local:', res3.status);
      const json3 = await res3.json();
      console.log('Response local:', json3);
    } catch (e) {
      console.error('Error local:', e.message);
    }
  }
}

main().catch(console.error);
