const tls = require('tls');
const fs = require('fs');

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

async function checkRecentOtpMails() {
  return new Promise((resolve, reject) => {
    const socket = tls.connect(993, 'imap.gmail.com', { rejectUnauthorized: false }, () => {
      console.log('Connected to imap.gmail.com');
    });

    let buffer = '';
    let step = 0;

    socket.on('data', (data) => {
      const str = data.toString();
      buffer += str;

      if (step === 0 && buffer.includes('* OK')) {
        step = 1;
        buffer = '';
        socket.write(`A01 LOGIN ${env.SMTP_USER} "${env.SMTP_PASS}"\r\n`);
      } else if (step === 1 && buffer.includes('A01 OK')) {
        step = 2;
        buffer = '';
        socket.write(`A02 SELECT "[Gmail]/Sent Mail"\r\n`);
      } else if (step === 2 && buffer.includes('A02 OK')) {
        step = 3;
        buffer = '';
        // Fetch headers for 131, 133, 134, 135
        socket.write(`A03 FETCH 131:135 (BODY[HEADER.FIELDS (DATE TO SUBJECT)])\r\n`);
      } else if (step === 3 && buffer.includes('A03 OK')) {
        console.log('Recent sent messages:');
        console.log(buffer);
        socket.write(`A04 LOGOUT\r\n`);
        socket.end();
        resolve();
      }
    });

    socket.on('error', (err) => {
      console.error('IMAP Error:', err);
      reject(err);
    });

    setTimeout(() => {
      socket.end();
      resolve();
    }, 10000);
  });
}

checkRecentOtpMails().catch(console.error);
