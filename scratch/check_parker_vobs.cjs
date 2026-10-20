const fs = require('fs');
const pg = require("c:/VOB's/US24-VOB/node_modules/pg");

const envText = fs.readFileSync("c:/VOB's/US24-VOB/.env", 'utf8');
const directUrl = envText.match(/DIRECT_URL="([^"]+)"/)[1];

async function checkParkerVobs() {
  const client = new pg.Client({ connectionString: directUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const res = await client.query(`
    SELECT count(*)
    FROM vob
    WHERE client_id = 'CLIENT-01';
  `);
  console.log('VOBs with CLIENT-01:', res.rows[0].count);

  await client.end();
}

checkParkerVobs().catch(console.error);
