const fs = require('fs');
const pg = require("c:/VOB's/US24-VOB/node_modules/pg");

const envText = fs.readFileSync("c:/VOB's/US24-VOB/.env", 'utf8');
const directUrl = envText.match(/DIRECT_URL="([^"]+)"/)[1];

async function checkAudit() {
  const client = new pg.Client({ connectionString: directUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('--- Checking Audit Table for Login / Auth events ---');
  const audits = await client.query(`
    SELECT id, occurred_at, actor_id, action, detail 
    FROM audit_event 
    WHERE action IN ('login', 'login_failed') OR actor_id = 'US24-04'
    ORDER BY occurred_at DESC 
    LIMIT 20;
  `);
  console.log('Recent login audit events:');
  console.table(audits.rows);

  // Also check all audit events in the last 24 hours
  const recentAll = await client.query(`
    SELECT id, occurred_at, actor_id, action, detail 
    FROM audit_event 
    ORDER BY occurred_at DESC 
    LIMIT 15;
  `);
  console.log('All recent audit events:');
  console.table(recentAll.rows);

  await client.end();
}

checkAudit().catch(console.error);
