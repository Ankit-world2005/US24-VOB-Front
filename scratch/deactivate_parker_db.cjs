const fs = require('fs');
const pg = require("c:/VOB's/US24-VOB/node_modules/pg");

const envText = fs.readFileSync("c:/VOB's/US24-VOB/.env", 'utf8');
const directUrl = envText.match(/DIRECT_URL="([^"]+)"/)[1];

async function deactivateParker() {
  const client = new pg.Client({ connectionString: directUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('--- Deactivating Parker Clinic (CLIENT-01) in DB ---');
  await client.query(`UPDATE client SET active = false WHERE id = 'CLIENT-01' OR name ILIKE '%parker%';`);
  await client.query(`UPDATE client_format SET active = false WHERE client_id = 'CLIENT-01';`);

  const res = await client.query(`SELECT id, name, active FROM client ORDER BY id;`);
  console.log('Active clients in DB:', res.rows.filter(r => r.active));
  console.log('Inactive clients in DB:', res.rows.filter(r => !r.active));

  await client.end();
}

deactivateParker().catch(console.error);
