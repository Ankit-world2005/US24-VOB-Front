const fs = require('fs');
const pg = require("c:/VOB's/US24-VOB/node_modules/pg");

const envText = fs.readFileSync("c:/VOB's/US24-VOB/.env", 'utf8');
const directUrl = envText.match(/DIRECT_URL="([^"]+)"/)[1];

async function checkVobs() {
  const client = new pg.Client({ connectionString: directUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const res = await client.query(`
    SELECT v.id, v.dos, v.appointment_type, v.insurance
    FROM vob v
    ORDER BY v.id
    LIMIT 20;
  `);
  console.log('Count:', res.rows.length);
  console.table(res.rows);

  await client.end();
}

checkVobs().catch(console.error);
