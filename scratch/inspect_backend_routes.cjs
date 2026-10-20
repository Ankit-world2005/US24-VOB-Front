const fs = require('fs');

const content = fs.readFileSync("c:/VOB's/US24-VOB/src/features/vobs/router.ts", 'utf8');
const lines = content.split('\n');

console.log('=== Routes in vobs/router.ts ===');
lines.forEach((l, i) => {
  if (l.includes('vobsRouter.get(') || l.includes('vobsRouter.post(') || l.includes('vobsRouter.patch(')) {
    console.log(`${i + 1}: ${l} -> ${lines[i + 1]}`);
  }
});

const getSingleIdx = content.indexOf("'/:id'");
if (getSingleIdx !== -1) {
  console.log('\n=== Single VOB handler ===');
  console.log(content.slice(getSingleIdx - 50, getSingleIdx + 600));
}
