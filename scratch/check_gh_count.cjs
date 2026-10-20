const fs = require('fs');
const pg = require("c:/VOB's/US24-VOB/node_modules/pg");

const envText = fs.readFileSync("c:/VOB's/US24-VOB/.env", 'utf8');
const directUrl = envText.match(/DIRECT_URL="([^"]+)"/)[1];

async function check() {
  const client = new pg.Client({ connectionString: directUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const res = await client.query("SELECT count(*) FROM vob WHERE insurance ILIKE '%general healthcare%';");
  console.log('Count with General Healthcare in DB:', res.rows[0].count);

  const nullCount = await client.query("SELECT count(*) FROM vob WHERE insurance IS NULL OR insurance = '';");
  console.log('Count with NULL or empty insurance in DB:', nullCount.rows[0].count);

  const total = await client.query("SELECT count(*) FROM vob;");
  console.log('Total VOBs in DB:', total.rows[0].count);

  await client.end();
}

check().catch(console.error);
