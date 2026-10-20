const fs = require('fs');
const pg = require("c:/VOB's/US24-VOB/node_modules/pg");

const envText = fs.readFileSync("c:/VOB's/US24-VOB/.env", 'utf8');
const directUrl = envText.match(/DIRECT_URL="([^"]+)"/)[1];

async function checkCounts() {
  const client = new pg.Client({ connectionString: directUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const tables = [
    'vob',
    'task',
    'auth_queue_item',
    'upload_batch',
    'patient',
    'storage_blobs',
    'task_reassignment_log',
    'vob_field_source',
    'audit_event',
    'session',
    'app_user',
    'client',
    'client_format'
  ];

  console.log('=== Current Table Counts ===');
  for (const t of tables) {
    try {
      const res = await client.query(`SELECT count(*) FROM "${t}";`);
      console.log(`${t}: ${res.rows[0].count} rows`);
    } catch (e) {
      console.log(`${t}: [error: ${e.message}]`);
    }
  }

  await client.end();
}

checkCounts().catch(console.error);
