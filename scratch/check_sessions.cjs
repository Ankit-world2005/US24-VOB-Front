const fs = require('fs');
const pg = require("c:/VOB's/US24-VOB/node_modules/pg");

const envText = fs.readFileSync("c:/VOB's/US24-VOB/.env", 'utf8');
const directUrl = envText.match(/DIRECT_URL="([^"]+)"/)[1];

async function checkSessions() {
  const client = new pg.Client({ connectionString: directUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('--- Checking Session Table ---');
  const sessions = await client.query(`
    SELECT s.id, s.user_id, u.email, s.issued_at, s.expires_at, s.revoked_at 
    FROM session s
    JOIN app_user u ON s.user_id = u.id
    ORDER BY s.issued_at DESC 
    LIMIT 10;
  `);
  console.log('Recent sessions:');
  console.table(sessions.rows);

  await client.end();
}

checkSessions().catch(console.error);
