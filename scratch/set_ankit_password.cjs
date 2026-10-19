const bcrypt = require("c:/VOB's/US24-VOB/node_modules/bcryptjs");
const pg = require("c:/VOB's/US24-VOB/node_modules/pg");
const fs = require('fs');

const AZURE_DB_URL = 'postgresql://us24admin:Ankitsingh%40123@us24-vob-db.postgres.database.azure.com:5432/vob?sslmode=require';
const targetEmail = 'ankit.k@us24solutions.com';
const newPassword = 'Ankitkumar@123';

async function setPassword() {
  console.log(`1. Generating bcrypt hash for ${targetEmail}...`);
  const hash = await bcrypt.hash(newPassword, 10);
  console.log('✓ Hash generated successfully.');

  console.log('2. Connecting to Azure PostgreSQL database...');
  const client = new pg.Client({ connectionString: AZURE_DB_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log(`3. Updating dev_password_hash for ${targetEmail} in table app_user...`);
  const updateRes = await client.query(`
    UPDATE app_user
    SET dev_password_hash = $1,
        active = true,
        updated_at = NOW()
    WHERE email ILIKE $2
    RETURNING id, email, name, role, active;
  `, [hash, targetEmail]);

  if (updateRes.rowCount === 0) {
    console.error(`User with email ${targetEmail} not found!`);
  } else {
    console.log('✓ Password updated in Azure PostgreSQL successfully!');
    console.log('User Record:', updateRes.rows[0]);
  }

  await client.end();

  // 4. Update SEED_PW_ANKIT in .env
  console.log('4. Updating SEED_PW_ANKIT in backend .env...');
  const envPath = "c:/VOB's/US24-VOB/.env";
  if (fs.existsSync(envPath)) {
    let envContent = fs.readFileSync(envPath, 'utf8');
    if (envContent.includes('SEED_PW_ANKIT=')) {
      envContent = envContent.replace(/^SEED_PW_ANKIT=.*$/m, `SEED_PW_ANKIT="${newPassword}"`);
    } else {
      envContent += `\nSEED_PW_ANKIT="${newPassword}"\n`;
    }
    fs.writeFileSync(envPath, envContent, 'utf8');
    console.log('✓ Updated SEED_PW_ANKIT in .env');
  }

  // 5. Test Live Login
  console.log('\n5. Testing live login on UAT backend (https://us24-vob-uat.vercel.app)...');
  const loginRes = await fetch('https://us24-vob-uat.vercel.app/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: targetEmail, password: newPassword })
  });

  const loginData = await loginRes.json();
  console.log('Login Response Status:', loginRes.status);
  console.log('Login Result:', loginData);

  if (loginRes.ok || loginData.requires_2fa || loginData.access_token) {
    console.log('\n🎉 SUCCESS! Password is now active and login succeeds!');
  } else {
    console.log('\n⚠️ Login response:', loginData);
  }
}

setPassword().catch(console.error);
