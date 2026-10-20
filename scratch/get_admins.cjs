const fs = require('fs');
const pg = require("c:/VOB's/US24-VOB/node_modules/pg");

const envText = fs.readFileSync("c:/VOB's/US24-VOB/.env", 'utf8');
const directUrl = envText.match(/DIRECT_URL="([^"]+)"/)[1];

async function getAdmins() {
  const client = new pg.Client({ connectionString: directUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('=== Database Admins (table: app_user) ===');
  const res = await client.query("SELECT id, name, email, role, active, created_at, updated_at FROM app_user WHERE role::text = 'admin' ORDER BY name;");
  console.table(res.rows);

  console.log('\n=== All Users and Roles (for full context) ===');
  const all = await client.query("SELECT id, name, email, role, active FROM app_user ORDER BY role, name;");
  console.table(all.rows);

  await client.end();
}

getAdmins().catch(console.error);
