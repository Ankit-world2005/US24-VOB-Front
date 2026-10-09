async function testApi() {
  console.log('Testing API timings on http://127.0.0.1:8000 with real credentials...');
  
  const t0 = Date.now();
  const loginRes = await fetch('http://127.0.0.1:8000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'rohit.k@us24solutions.com', password: 'password123' })
  });
  const loginTime = Date.now() - t0;
  console.log('Login status:', loginRes.status, `(${loginTime} ms)`);
  
  const auth = await loginRes.json();
  const token = auth.token;
  console.log('User:', auth.user?.name, 'Role:', auth.user?.role);

  async function measure(name, url) {
    const start = Date.now();
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const elapsed = Date.now() - start;
      const json = await res.json().catch(() => ({}));
      const itemCount = Array.isArray(json) ? json.length : (Array.isArray(json?.vobs) ? json.vobs.length : (Array.isArray(json?.data) ? json.data.length : 'object'));
      console.log(`[${res.status}] ${name.padEnd(30)}: ${elapsed} ms (count/size: ${itemCount})`);
    } catch (e) {
      console.log(`[ERR] ${name.padEnd(30)}: ${Date.now() - start} ms - ${e.message}`);
    }
  }

  if (token) {
    console.log('\n--- Measuring standard dashboard API calls ---');
    await measure('GET /auth/me', 'http://127.0.0.1:8000/api/v1/auth/me');
    await measure('GET /dashboard/summary', 'http://127.0.0.1:8000/api/v1/dashboard/summary');
    await measure('GET /vobs (limit 100)', 'http://127.0.0.1:8000/api/v1/vobs?limit=100');
    await measure('GET /users', 'http://127.0.0.1:8000/api/v1/users');
    await measure('GET /vobs (status=Error)', 'http://127.0.0.1:8000/api/v1/vobs?status=Error&limit=50');
    await measure('GET /vobs (status=auth_queue)', 'http://127.0.0.1:8000/api/v1/vobs?status=auth_queue&limit=50');

    console.log('\n--- Measuring parallel burst (like page mount) ---');
    const burstStart = Date.now();
    await Promise.all([
      measure('Burst: GET /auth/me', 'http://127.0.0.1:8000/api/v1/auth/me'),
      measure('Burst: GET /dashboard/summary', 'http://127.0.0.1:8000/api/v1/dashboard/summary'),
      measure('Burst: GET /vobs (limit 100)', 'http://127.0.0.1:8000/api/v1/vobs?limit=100'),
      measure('Burst: GET /users', 'http://127.0.0.1:8000/api/v1/users')
    ]);
    console.log(`Total burst time: ${Date.now() - burstStart} ms`);
  }
}
testApi();
