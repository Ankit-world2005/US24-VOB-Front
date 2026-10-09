const fs = require('fs');
const envText = fs.readFileSync("c:/VOB's/US24-VOB/.env", 'utf8');
const directUrl = envText.match(/DIRECT_URL="([^"]+)"/)?.[1] || envText.match(/DATABASE_URL="([^"]+)"/)?.[1];
if (directUrl) {
  try {
    const url = new URL(directUrl);
    console.log('Database Host:', url.host);
    console.log('Database Port:', url.port);
    console.log('Database Name:', url.pathname);
  } catch (e) {
    console.log('Could not parse URL:', e.message);
  }
} else {
  console.log('No directUrl or DATABASE_URL found.');
}
