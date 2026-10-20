const fs = require('fs');
const pg = require("c:/VOB's/US24-VOB/node_modules/pg");
const nodemailer = require("c:/VOB's/US24-VOB/node_modules/nodemailer");

const envText = fs.readFileSync("c:/VOB's/US24-VOB/.env", 'utf8');
const env = {};
envText.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return;
  const idx = trimmed.indexOf('=');
  if (idx !== -1) {
    const k = trimmed.slice(0, idx).trim();
    let v = trimmed.slice(idx + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    env[k] = v;
  }
});

async function checkAll() {
  console.log('--- 1. Checking Database for saurabh ---');
  const client = new pg.Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    const res = await client.query('SELECT id, email, name, role, active, dev_password_hash IS NOT NULL as has_password, updated_at FROM app_user WHERE email ILIKE $1;', ['%saurabh%']);
    console.log('User query result for Saurabh:');
    console.table(res.rows);
    
    const allUsers = await client.query('SELECT id, email, name, role, active FROM app_user ORDER BY email;');
    console.log('\nAll users in DB:');
    console.table(allUsers.rows);
  } catch (err) {
    console.error('DB query error:', err.message);
  } finally {
    await client.end();
  }

  console.log('\n--- 2. Testing SMTP Connection ---');
  console.log('SMTP Host:', env.SMTP_HOST);
  console.log('SMTP Port:', env.SMTP_PORT);
  console.log('SMTP User:', env.SMTP_USER);
  console.log('SMTP Pass raw:', JSON.stringify(env.SMTP_PASS));
  console.log('SMTP Pass length:', env.SMTP_PASS ? env.SMTP_PASS.length : 0);
  
  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(env.SMTP_PORT || '587', 10),
    secure: env.SMTP_SECURE === 'true',
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });

  try {
    await transporter.verify();
    console.log('SMTP Connection: SUCCESS (Transporter verified)');
  } catch (err) {
    console.error('SMTP Connection: FAILED ->', err.message);
    if (err.response) console.error('SMTP Error response:', err.response);
  }
}

checkAll();
