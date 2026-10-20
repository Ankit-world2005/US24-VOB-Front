const fs = require('fs');
const pg = require("c:/VOB's/US24-VOB/node_modules/pg");

const envText = fs.readFileSync("c:/VOB's/US24-VOB/.env", 'utf8');
const directUrl = envText.match(/DIRECT_URL="([^"]+)"/)[1];

async function checkAllParkerRefs() {
  const client = new pg.Client({ connectionString: directUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('--- Checking client_format ---');
  const fmt = await client.query(`SELECT * FROM client_format WHERE client_id = 'CLIENT-01'`);
  console.log('client_format:', fmt.rows);

  console.log('--- Checking vob ---');
  const vob = await client.query(`SELECT count(*) FROM vob WHERE client_id = 'CLIENT-01'`);
  console.log('vob count:', vob.rows[0].count);

  console.log('--- Checking user_client ---');
  const uc = await client.query(`SELECT * FROM user_client WHERE client_id = 'CLIENT-01'`);
  console.log('user_client:', uc.rows);

  await client.end();
}

checkAllParkerRefs().catch(console.error);
