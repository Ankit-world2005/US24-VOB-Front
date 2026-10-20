const fs = require('fs');
const pg = require("c:/VOB's/US24-VOB/node_modules/pg");

const envText = fs.readFileSync("c:/VOB's/US24-VOB/.env", 'utf8');
const directUrl = envText.match(/DIRECT_URL="([^"]+)"/)[1];

async function checkBlob() {
  const client = new pg.Client({ connectionString: directUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const res = await client.query(`
    SELECT *
    FROM storage_blobs
    ORDER BY created_at DESC
    LIMIT 5;
  `);
  console.log('Blobs:', res.rows);

  await client.end();
}

checkBlob().catch(console.error);
