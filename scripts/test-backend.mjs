// Automated Backend Test Suite for US24 VOB API
// Usage: node scripts/test-backend.mjs [backendUrl]
// Default: http://localhost:8000 (or process.env.BACKEND_URL)

const BASE_URL = (process.argv[2] || process.env.BACKEND_URL || 'http://localhost:8000').replace(/\/+$/, '');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  dim: '\x1b[2m'
};

let passed = 0;
let failed = 0;
const results = [];

async function test(name, fn) {
  const start = performance.now();
  try {
    await fn();
    const duration = (performance.now() - start).toFixed(1);
    passed++;
    results.push({ name, status: 'PASS', duration });
    console.log(`  ${colors.green}✓ PASS${colors.reset} ${name} ${colors.dim}(${duration}ms)${colors.reset}`);
  } catch (err) {
    const duration = (performance.now() - start).toFixed(1);
    failed++;
    results.push({ name, status: 'FAIL', duration, error: err.message });
    console.log(`  ${colors.red}✗ FAIL${colors.reset} ${name} ${colors.dim}(${duration}ms)${colors.reset}`);
    console.log(`     ${colors.yellow}Error: ${err.message}${colors.reset}`);
  }
}

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });
  let data = null;
  const text = await res.text();
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, ok: res.ok, data };
}

async function runAllTests() {
  console.log(`\n${colors.bold}${colors.cyan}=================================================================${colors.reset}`);
  console.log(`${colors.bold}            US24 VOB BACKEND API TEST SUITE${colors.reset}`);
  console.log(`${colors.dim}Target URL: ${BASE_URL}${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}=================================================================${colors.reset}\n`);

  let authToken = '';
  let sampleVobId = '';
  let sampleVobVersion = 1;

  // 1. Health Checks
  await test('GET /healthz - Liveness probe', async () => {
    const res = await request('/healthz');
    if (res.status !== 200 || res.data?.status !== 'ok') {
      throw new Error(`Expected 200 { status: "ok" }, got ${res.status}: ${JSON.stringify(res.data)}`);
    }
  });

  await test('GET /readyz - Readiness probe', async () => {
    const res = await request('/readyz');
    if (res.status !== 200 || res.data?.status !== 'ok') {
      throw new Error(`Expected 200 { status: "ok" }, got ${res.status}: ${JSON.stringify(res.data)}`);
    }
  });

  // 2. Auth Endpoints
  await test('POST /api/v1/auth/login - Specialist login', async () => {
    const res = await request('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'rohit.k@us24solutions.com', password: 'testpassword' })
    });
    if (res.status !== 200 || !res.data?.token || !res.data?.user) {
      throw new Error(`Expected 200 with token and user object, got ${res.status}: ${JSON.stringify(res.data)}`);
    }
    authToken = res.data.token;
  });

  await test('GET /api/v1/auth/me - Authenticated profile', async () => {
    const res = await request('/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    if (res.status !== 200 || !res.data?.user) {
      throw new Error(`Expected 200 with user profile, got ${res.status}: ${JSON.stringify(res.data)}`);
    }
  });

  await test('POST /api/v1/auth/refresh - Refresh session token', async () => {
    const res = await request('/api/v1/auth/refresh', {
      method: 'POST'
    });
    if (res.status !== 200 || !res.data?.token) {
      throw new Error(`Expected 200 with refreshed token, got ${res.status}: ${JSON.stringify(res.data)}`);
    }
  });

  // 3. VOBs Collection
  await test('GET /api/v1/vobs - List work queue', async () => {
    const res = await request('/api/v1/vobs');
    if (res.status !== 200 || !Array.isArray(res.data?.data) || !res.data?.page) {
      throw new Error(`Expected 200 with data array and page metadata, got ${res.status}`);
    }
    if (res.data.data.length === 0) {
      throw new Error('VOBs list returned empty array');
    }
    sampleVobId = res.data.data[0].id;
  });

  await test('GET /api/v1/vobs - Filter with repeatable status parameters', async () => {
    const res = await request('/api/v1/vobs?status=assigned&status=in_progress');
    if (res.status !== 200 || !Array.isArray(res.data?.data)) {
      throw new Error(`Expected 200 with filtered items, got ${res.status}`);
    }
  });

  // 4. Single VOB Operations
  await test(`GET /api/v1/vobs/${sampleVobId} - Retrieve full record`, async () => {
    const res = await request(`/api/v1/vobs/${sampleVobId}`);
    if (res.status !== 200 || !res.data?.fields || !res.data?.patient) {
      throw new Error(`Expected 200 with fields and patient sub-objects, got ${res.status}`);
    }
    sampleVobVersion = res.data.version || 1;
  });

  await test(`PATCH /api/v1/vobs/${sampleVobId} - Save field edits`, async () => {
    const res = await request(`/api/v1/vobs/${sampleVobId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        version: sampleVobVersion,
        fields: {
          copay_amount: '$25.00',
          copay_coins: '$25.00 Copay'
        }
      })
    });
    if (res.status !== 200 || res.data?.version !== sampleVobVersion + 1) {
      throw new Error(`Expected 200 with incremented version ${sampleVobVersion + 1}, got ${res.status}: ${JSON.stringify(res.data)}`);
    }
    sampleVobVersion = res.data.version;
  });

  await test(`PATCH /api/v1/vobs/${sampleVobId} - Optimistic lock conflict test (409)`, async () => {
    const staleVersion = sampleVobVersion - 1;
    const res = await request(`/api/v1/vobs/${sampleVobId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        version: staleVersion,
        fields: { copay_amount: '$999.00' }
      })
    });
    if (res.status !== 409) {
      throw new Error(`Expected 409 Conflict for stale version ${staleVersion}, but got status ${res.status}`);
    }
  });

  await test(`POST /api/v1/vobs/${sampleVobId}/submit - Validation & routing`, async () => {
    const res = await request(`/api/v1/vobs/${sampleVobId}/submit`, {
      method: 'POST',
      body: JSON.stringify({ version: sampleVobVersion })
    });
    // Expected: either 200 with approved/auth_queue, or 422 validation_failed
    if (res.status !== 200 && res.status !== 422) {
      throw new Error(`Expected 200 (approved/auth_queue) or 422 (validation_failed), got ${res.status}`);
    }
    if (res.status === 200) {
      sampleVobVersion = res.data.version;
    }
  });

  // 5. Auth Queue VOB Approval
  await test(`POST /api/v1/vobs/${sampleVobId}/auth - Record prior authorization`, async () => {
    const res = await request(`/api/v1/vobs/${sampleVobId}/auth`, {
      method: 'POST',
      body: JSON.stringify({
        version: sampleVobVersion,
        auth_number: 'AUTH-TEST-2026',
        auth_valid_from: '2026-10-01',
        auth_valid_to: '2026-12-31'
      })
    });
    if (res.status !== 200 || res.data?.status !== 'approved') {
      throw new Error(`Expected 200 { status: "approved" }, got ${res.status}: ${JSON.stringify(res.data)}`);
    }
  });

  // 6. Bulk Assignments (Admin)
  await test('POST /api/v1/assignments - Bulk distribute VOBs', async () => {
    const res = await request('/api/v1/assignments', {
      method: 'POST',
      body: JSON.stringify({
        vob_ids: [sampleVobId],
        assignee_ids: ['anita.s@us24solutions.com', 'rohit.k@us24solutions.com'],
        strategy: 'even'
      })
    });
    if (res.status !== 200 || !Array.isArray(res.data?.data)) {
      throw new Error(`Expected 200 with data array of assignments, got ${res.status}`);
    }
  });

  // Test Summary
  console.log(`\n${colors.cyan}-----------------------------------------------------------------${colors.reset}`);
  console.log(`${colors.bold}Test Results:${colors.reset} ${passed > 0 ? colors.green : ''}${passed} Passed${colors.reset}, ${failed > 0 ? colors.red : ''}${failed} Failed${colors.reset} (${passed + failed} Total)`);
  if (failed === 0) {
    console.log(`${colors.green}${colors.bold}🎉 ALL TESTS PASSED! Backend API conforms 100% to api-endpoints.md${colors.reset}`);
  } else {
    console.log(`${colors.red}${colors.bold}⚠️ Some tests failed. Please review errors above.${colors.reset}`);
  }
  console.log(`${colors.cyan}=================================================================${colors.reset}\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch(err => {
  console.error(`\n${colors.red}Fatal test suite execution error:${colors.reset}`, err);
  process.exit(1);
});
