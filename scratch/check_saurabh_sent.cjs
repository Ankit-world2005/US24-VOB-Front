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

async function checkSaurabhBounces() {
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
        socket.write(`A03 SEARCH TEXT "saurabh"\r\n`);
      } else if (step === 3 && buffer.includes('A03 OK')) {
        console.log('Search text "saurabh" in INBOX:', buffer.trim());
        step = 4;
        buffer = '';
        socket.write(`A04 SELECT "[Gmail]/Sent Mail"\r\n`);
      } else if (step === 4 && buffer.includes('A04 OK')) {
        step = 5;
        buffer = '';
        socket.write(`A05 SEARCH TO "saurabh@us24solutions.com"\r\n`);
      } else if (step === 5 && buffer.includes('A05 OK')) {
        console.log('Search TO saurabh in Sent Mail:', buffer.trim());
        const match = buffer.match(/\* SEARCH ([\d\s]+)/);
        if (match && match[1].trim()) {
          const ids = match[1].trim().split(/\s+/);
          const lastId = ids[ids.length - 1];
          step = 6;
          buffer = '';
          socket.write(`A06 FETCH ${lastId} (BODY[HEADER.FIELDS (DATE FROM TO SUBJECT)] BODY[TEXT]<0.500>)\r\n`);
        } else {
          socket.write(`A06 LOGOUT\r\n`);
          socket.end();
          resolve();
        }
      } else if (step === 6 && buffer.includes('A06 OK')) {
        console.log('Latest sent email to Saurabh:');
        console.log(buffer);
        socket.write(`A07 LOGOUT\r\n`);
        socket.end();
        resolve();
      }
    });

    socket.on('error', (err) => {
      console.error('IMAP Error:', err);
      reject(err);
    });

    setTimeout(() => {
      console.log('Timeout.');
      socket.end();
      resolve();
    }, 12000);
  });
}

checkSaurabhBounces().catch(console.error);
