const fs = require('fs');
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

async function main() {
  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(env.SMTP_PORT || '587', 10),
    secure: env.SMTP_SECURE === 'true',
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });

  const fromAddress = env.SMTP_FROM || env.SMTP_USER;
  console.log('Sending test email to saurabh@us24solutions.com...');
  console.log('From:', fromAddress);

  try {
    const info = await transporter.sendMail({
      from: `"VOB Verification Service" <${fromAddress}>`,
      to: 'saurabh@us24solutions.com',
      subject: '[Test / Debug] VOB Verification Code Test',
      text: 'This is a diagnostic email to test mailbox delivery for saurabh@us24solutions.com.',
      html: '<p>This is a diagnostic email to test mailbox delivery for saurabh@us24solutions.com.</p>'
    });
    console.log('SendMail SUCCESS!');
    console.log('Message ID:', info.messageId);
    console.log('Accepted:', info.accepted);
    console.log('Rejected:', info.rejected);
    console.log('Pending:', info.pending);
    console.log('Response:', info.response);
  } catch (err) {
    console.error('SendMail FAILED:', err);
  }
}

main().catch(console.error);
