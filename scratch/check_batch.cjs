const fs = require('fs');
const pg = require("c:/VOB's/US24-VOB/node_modules/pg");

const envText = fs.readFileSync("c:/VOB's/US24-VOB/.env", 'utf8');
const directUrl = envText.match(/DIRECT_URL="([^"]+)"/)[1];

async function checkBatch() {
  const client = new pg.Client({ connectionString: directUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const res = await client.query(`
    SELECT *
    FROM upload_batch
    ORDER BY created_at DESC
    LIMIT 5;
  `);
  console.log('Batches:', res.rows);

  await client.end();
}

checkBatch().catch(console.error);
