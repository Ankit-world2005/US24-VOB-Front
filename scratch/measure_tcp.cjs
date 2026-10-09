const net = require('net');

async function measure() {
  const times = [];
  for (let i = 0; i < 4; i++) {
    const start = Date.now();
    await new Promise((resolve, reject) => {
      const socket = net.createConnection({ host: 'aws-0-ap-northeast-1.pooler.supabase.com', port: 5432 }, () => {
        times.push(Date.now() - start);
        socket.end();
        resolve();
      });
      socket.on('error', reject);
    });
  }
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  console.log(`TCP Connect times to Supabase (Tokyo, Japan): ${times.join(' ms, ')} ms (Avg: ${avg} ms)`);
}

measure().catch(console.error);
