async function crawl() {
  const visited = new Set();
  const queue = ['/src/main.jsx'];
  const start = Date.now();
  let count = 0;
  const slow = [];

  while (queue.length > 0) {
    const urlPath = queue.shift();
    if (visited.has(urlPath)) continue;
    visited.add(urlPath);
    count++;
    
    const t0 = Date.now();
    try {
      const res = await fetch('http://127.0.0.1:3000' + urlPath);
      const elapsed = Date.now() - t0;
      if (elapsed > 80) slow.push({ path: urlPath, time: elapsed });
      
      const text = await res.text();
      const importRegex = /from\s+["']([^"']+)["']/g;
      let match;
      while ((match = importRegex.exec(text)) !== null) {
        let imp = match[1];
        if (imp.startsWith('.')) {
          const base = urlPath.substring(0, urlPath.lastIndexOf('/'));
          const parts = (base + '/' + imp).split('/');
          const resolved = [];
          for (const p of parts) {
            if (p === '..') resolved.pop();
            else if (p !== '.' && p !== '') resolved.push(p);
          }
          imp = '/' + resolved.join('/');
        }
        if (!visited.has(imp) && !queue.includes(imp)) {
          queue.push(imp);
        }
      }
    } catch (err) {
      console.error('Error fetching', urlPath, err.message);
    }
  }
  console.log('Total modules requested:', count);
  console.log('Total crawl time:', Date.now() - start, 'ms');
  console.log('Slowest modules (>80ms):', slow.sort((a,b) => b.time - a.time).slice(0, 15));
}
crawl();
