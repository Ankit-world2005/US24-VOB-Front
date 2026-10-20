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

async function checkImap() {
  return new Promise((resolve, reject) => {
    const socket = tls.connect(993, 'imap.gmail.com', { rejectUnauthorized: false }, () => {
      console.log('Connected to imap.gmail.com');
    });

    let buffer = '';
    let step = 0;

    socket.on('data', (data) => {
      const str = data.toString();
      // console.log('S:', str.trim());
      buffer += str;

      if (step === 0 && buffer.includes('* OK')) {
        step = 1;
        buffer = '';
        socket.write(`A01 LOGIN ${env.SMTP_USER} "${env.SMTP_PASS}"\r\n`);
      } else if (step === 1 && (buffer.includes('A01 OK') || buffer.includes('A01 NO') || buffer.includes('A01 BAD'))) {
        if (buffer.includes('A01 OK')) {
          console.log('IMAP Login: SUCCESS');
          step = 2;
          buffer = '';
          socket.write(`A02 SELECT INBOX\r\n`);
        } else {
          console.log('IMAP Login FAILED:', buffer);
          socket.end();
          resolve();
        }
      } else if (step === 2 && buffer.includes('A02 OK')) {
        console.log('Inbox Selected. Searching for bounces / Mail Delivery Subsystem...');
        step = 3;
        buffer = '';
        socket.write(`A03 SEARCH FROM "mailer-daemon"\r\n`);
      } else if (step === 3 && buffer.includes('A03 OK')) {
        console.log('Search mailer-daemon result:', buffer.trim());
        step = 4;
        buffer = '';
        socket.write(`A04 SEARCH ALL\r\n`);
      } else if (step === 4 && buffer.includes('A04 OK')) {
        console.log('Search ALL in inbox:', buffer.trim());
        socket.write(`A05 LOGOUT\r\n`);
        socket.end();
        resolve();
      }
    });

    socket.on('error', (err) => {
      console.error('IMAP Error:', err.message);
      reject(err);
    });

    setTimeout(() => {
      console.log('IMAP check timeout');
      socket.end();
      resolve();
    }, 10000);
  });
}

checkImap().catch(console.error);
