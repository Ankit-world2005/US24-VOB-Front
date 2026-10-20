const fs = require('fs');
const pg = require("c:/VOB's/US24-VOB/node_modules/pg");

const envText = fs.readFileSync("c:/VOB's/US24-VOB/.env", 'utf8');
const directUrl = envText.match(/DIRECT_URL="([^"]+)"/)[1];

async function checkAudit() {
  const client = new pg.Client({ connectionString: directUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('--- Checking Audit Table for Login / Auth events ---');
  // Check tables in public schema
  const tables = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);
  console.log('Tables:', tables.rows.map(r => r.table_name));

  if (tables.rows.some(r => r.table_name === 'audit_event')) {
    const audits = await client.query(`
      SELECT * FROM audit_event 
      ORDER BY created_at DESC 
      LIMIT 20;
    `);
    console.log('Recent audit events:');
    console.table(audits.rows);
  }

  // Check sessions
  if (tables.rows.some(r => r.table_name === 'session')) {
    const sessions = await client.query(`
      SELECT s.id, s.user_id, u.email, s.created_at, s.expires_at, s.revoked_at 
      FROM session s
      JOIN app_user u ON s.user_id = u.id
      ORDER BY s.created_at DESC 
      LIMIT 10;
    `);
    console.log('Recent sessions:');
    console.table(sessions.rows);
  }

  await client.end();
}

checkAudit().catch(console.error);
