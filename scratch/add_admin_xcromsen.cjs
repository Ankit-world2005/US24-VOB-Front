const bcrypt = require("c:/VOB's/US24-VOB/node_modules/bcryptjs");
const pg = require("c:/VOB's/US24-VOB/node_modules/pg");

const AZURE_DB_URL = 'postgresql://us24admin:Ankitsingh%40123@us24-vob-db.postgres.database.azure.com:5432/vob?sslmode=require';
const email = 'xcromsen@gmail.com';
const name = 'Ankit Singh';
const role = 'admin';
const password = 'ankitsingh@123';

async function main() {
  console.log(`1. Generating bcrypt hash for ${email}...`);
  const hash = await bcrypt.hash(password, 10);

  console.log('2. Connecting to Azure PostgreSQL database...');
  const client = new pg.Client({ connectionString: AZURE_DB_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log(`3. Checking if ${email} already exists in app_user...`);
  const check = await client.query('SELECT id, email, role FROM app_user WHERE email ILIKE $1;', [email]);

  let userId;
  if (check.rows.length > 0) {
    userId = check.rows[0].id;
    console.log(`User exists with ID: ${userId}. Updating role to admin and password...`);
    await client.query(`
      UPDATE app_user
      SET role = 'admin'::role,
          name = $1,
          dev_password_hash = $2,
          active = true,
          updated_at = NOW()
      WHERE id = $3;
    `, [name, hash, userId]);
  } else {
    console.log(`Creating new admin account for ${email}...`);
    const insertRes = await client.query(`
      INSERT INTO app_user (email, name, role, dev_password_hash, active, updated_at)
      VALUES ($1, $2, 'admin'::role, $3, true, NOW())
      RETURNING id, email, name, role, active;
    `, [email, name, hash]);
    userId = insertRes.rows[0].id;
    console.log('✓ Created admin user:', insertRes.rows[0]);
  }

  // Grant access to all clients for this admin
  console.log('4. Granting access to all clients in user_client_access...');
  const grantRes = await client.query(`
    INSERT INTO user_client_access (user_id, client_id)
    SELECT $1, id FROM client
    ON CONFLICT DO NOTHING;
  `, [userId]);
  console.log(`✓ Client access grants assigned for user ${userId}.`);

  // Verify full record
  const verifyRes = await client.query('SELECT id, email, name, role, active FROM app_user WHERE id = $1;', [userId]);
  console.log('\nVerified Azure Database Record:');
  console.table(verifyRes.rows);

  await client.end();

  // 5. Test Live Login
  console.log('\n5. Testing live login on UAT backend (https://us24-vob-uat.vercel.app)...');
  const loginRes = await fetch('https://us24-vob-uat.vercel.app/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  const loginData = await loginRes.json();
  console.log('Login Response Status:', loginRes.status);
  console.log('Login Result:', loginData);

  if (loginRes.ok || loginData.requires_2fa || loginData.access_token) {
    console.log('\n🎉 SUCCESS! xcromsen@gmail.com is now an active ADMIN and login succeeds!');
  } else {
    console.log('\n⚠️ Login response check:', loginData);
  }
}

main().catch(console.error);
