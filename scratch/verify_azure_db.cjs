const fs = require('fs');
const pg = require("c:/VOB's/US24-VOB/node_modules/pg");

const envText = fs.readFileSync("c:/VOB's/US24-VOB/.env", 'utf8');
const directUrl = envText.match(/DIRECT_URL="([^"]+)"/)[1];
const parsed = new URL(directUrl);

async function main() {
  console.log('=== Connected Azure Server Details ===');
  console.log('Azure Host:    ', parsed.hostname);
  console.log('Port:          ', parsed.port);
  console.log('Database Name: ', parsed.pathname.replace('/', ''));
  console.log('Admin User:    ', parsed.username);

  const client = new pg.Client({ connectionString: directUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('\n=== Live Azure PostgreSQL Verification ===');
  const vobCount = await client.query('SELECT count(*) FROM vob;');
  const taskCount = await client.query('SELECT count(*) FROM task;');
  const batchCount = await client.query('SELECT count(*) FROM upload_batch;');
  const patientCount = await client.query('SELECT count(*) FROM patient;');
  const blobCount = await client.query('SELECT count(*) FROM storage_blobs;');
  const authQueueCount = await client.query('SELECT count(*) FROM auth_queue_item;');

  console.log('vob:             ', vobCount.rows[0].count, 'rows');
  console.log('task:            ', taskCount.rows[0].count, 'rows');
  console.log('upload_batch:    ', batchCount.rows[0].count, 'rows');
  console.log('patient:         ', patientCount.rows[0].count, 'rows');
  console.log('storage_blobs:   ', blobCount.rows[0].count, 'rows');
  console.log('auth_queue_item: ', authQueueCount.rows[0].count, 'rows');

  await client.end();
}

main().catch(console.error);
