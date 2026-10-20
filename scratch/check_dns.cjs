const dns = require('dns').promises;

async function checkDns() {
  const domain = 'us24solutions.com';
  console.log(`--- Checking DNS for ${domain} ---`);
  try {
    const mx = await dns.resolveMx(domain);
    console.log('MX records:', mx);
  } catch (err) {
    console.error('MX resolution error:', err.message);
  }

  try {
    const txt = await dns.resolveTxt(domain);
    console.log('TXT records (SPF / DMARC verification):', txt);
  } catch (err) {
    console.error('TXT resolution error:', err.message);
  }

  try {
    const dmarc = await dns.resolveTxt('_dmarc.' + domain);
    console.log('DMARC record:', dmarc);
  } catch (err) {
    console.error('DMARC resolution error:', err.message);
  }
}

checkDns();
