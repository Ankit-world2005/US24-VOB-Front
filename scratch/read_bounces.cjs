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

async function readBounces() {
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
        socket.write(`A02 SELECT INBOX\r\n`);
      } else if (step === 2 && buffer.includes('A02 OK')) {
        step = 3;
        buffer = '';
        // Fetch the headers and snippets of the latest messages: 26, 27, 28
        socket.write(`A03 FETCH 25:28 (BODY[HEADER.FIELDS (DATE FROM TO SUBJECT)] BODY[TEXT]<0.1000>)\r\n`);
      } else if (step === 3 && buffer.includes('A03 OK')) {
        console.log('=== Bounce Message Details ===');
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
      console.log('Timeout. Current buffer:\n', buffer);
      socket.end();
      resolve();
    }, 12000);
  });
}

readBounces().catch(console.error);
