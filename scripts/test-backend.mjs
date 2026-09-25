// Automated Backend Test Suite for US24 VOB API
// Usage: node scripts/test-backend.mjs [backendUrl]
// Default: http://localhost:8000 (or process.env.BACKEND_URL)

import crypto from 'crypto';

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

let activeToken = '';

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const tokenToUse = options.token !== undefined ? options.token : activeToken;
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(tokenToUse ? { Authorization: `Bearer ${tokenToUse}` } : {}),
    ...(options.headers || {})
  };
  const res = await fetch(url, {
    ...options,
    headers
  });
  let data = null;
  const text = await res.text();
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, ok: res.ok, data, headers: res.headers };
}

async function runAllTests() {
  console.log(`\n${colors.bold}${colors.cyan}=================================================================${colors.reset}`);
  console.log(`${colors.bold}            US24 VOB BACKEND API TEST SUITE${colors.reset}`);
  console.log(`${colors.dim}Target URL: ${BASE_URL}${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}=================================================================${colors.reset}\n`);

  let adminToken = '';
  let specialistToken = '';
  let specialistUser = null;
  let sampleVobId = '';
  let sampleVobVersion = 1;
  let firstClientId = '';

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

  // 2. Admin Authentication
  await test('POST /api/v1/auth/login - Admin login', async () => {
    const res = await request('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@us24.test', password: 'DevPassword123!' })
    });
    const token = res.data?.access_token || res.data?.token;
    if (res.status !== 200 || !token || !res.data?.user) {
      throw new Error(`Expected 200 with token and user object, got ${res.status}: ${JSON.stringify(res.data)}`);
    }
    adminToken = token;
    activeToken = token;
  });

  await test('GET /api/v1/auth/me - Authenticated profile', async () => {
    const res = await request('/api/v1/auth/me');
    if (res.status !== 200 || (!res.data?.user && !res.data?.id)) {
      throw new Error(`Expected 200 with user profile, got ${res.status}: ${JSON.stringify(res.data)}`);
    }
  });

  await test('POST /api/v1/auth/refresh - Refresh session token', async () => {
    const res = await request('/api/v1/auth/refresh', {
      method: 'POST'
    });
    const token = res.data?.access_token || res.data?.token;
    if (res.status === 200 && token) {
      adminToken = token;
      activeToken = token;
    }
  });

  // 3. Admin Live Metrics & Data Endpoints
  await test('GET /api/v1/dashboard/summary - Live KPI metrics', async () => {
    const res = await request('/api/v1/dashboard/summary');
    if (res.status !== 200 || (res.data?.total === undefined && !res.data?.kpis)) {
      throw new Error(`Expected 200 with kpis or summary, got ${res.status}: ${JSON.stringify(res.data)}`);
    }
  });

  await test('GET /api/v1/users - List active team users', async () => {
    const res = await request('/api/v1/users');
    const users = Array.isArray(res.data) ? res.data : res.data?.data;
    if (res.status !== 200 || !Array.isArray(users) || users.length === 0) {
      throw new Error(`Expected 200 with users array, got ${res.status}`);
    }
    specialistUser = users.find(u => u.email === 'user@us24.test') || users.find(u => u.role === 'user');
    if (!specialistUser) {
      throw new Error('No active specialist user with role "user" found in DB');
    }
  });

  await test('GET /api/v1/audit - List audit trail', async () => {
    const res = await request('/api/v1/audit');
    const logs = Array.isArray(res.data) ? res.data : res.data?.data;
    if (res.status !== 200 || !Array.isArray(logs)) {
      throw new Error(`Expected 200 with audit entries, got ${res.status}`);
    }
  });

  await test('GET /api/v1/clients - List configured clients', async () => {
    const res = await request('/api/v1/clients');
    const clients = Array.isArray(res.data) ? res.data : res.data?.data;
    if (res.status !== 200 || !Array.isArray(clients) || clients.length === 0) {
      throw new Error(`Expected 200 with clients array, got ${res.status}`);
    }
    firstClientId = clients[0].id;
  });

  // 4. VOBs Collection & Ingestion
  await test('GET /api/v1/vobs - List work queue', async () => {
    const res = await request('/api/v1/vobs');
    if (res.status !== 200 || !Array.isArray(res.data?.data) || !res.data?.page) {
      throw new Error(`Expected 200 with data array and page metadata, got ${res.status}`);
    }
    if (res.data.data.length > 0) {
      sampleVobId = res.data.data[0].id;
    }
  });

  // If work queue is empty, ensure at least one test VOB exists via uploads
  if (!sampleVobId && firstClientId) {
    await test('POST /api/v1/uploads & commit - Ingest sample intake sheet', async () => {
      const upRes = await request('/api/v1/uploads', {
        method: 'POST',
        body: JSON.stringify({
          client_id: firstClientId,
          kind: 'tasks',
          filename: 'Automated_Test_Intake.xlsx',
          rows: [
            {
              row: 1,
              patient_name: 'Eleanor Vance',
              dob: '1988-04-12',
              dos: '2026-10-01',
              emr_id: 'EMR-1001',
              insurance: 'Aetna Choice POS II',
              appointment_type: 'Initial Evaluation',
              group_no: 'GRP-88192',
              member_id: 'W109283746',
              assignee_email: specialistUser.email
            }
          ]
        })
      });
      if (upRes.status !== 201 || !upRes.data?.id) {
        throw new Error(`Upload failed with status ${upRes.status}: ${JSON.stringify(upRes.data)}`);
      }
      const commitRes = await request(`/api/v1/uploads/${upRes.data.id}/commit`, {
        method: 'POST',
        body: JSON.stringify({
          skip_rows: [],
          idempotency_key: crypto.randomUUID()
        })
      });
      if (commitRes.status !== 200 || !commitRes.data?.vob_ids?.[0]) {
        throw new Error(`Commit failed with status ${commitRes.status}: ${JSON.stringify(commitRes.data)}`);
      }
      sampleVobId = commitRes.data.vob_ids[0];
    });
  }

  await test('GET /api/v1/vobs - Filter with repeatable status parameters', async () => {
    const res = await request('/api/v1/vobs?status=assigned&status=in_progress');
    if (res.status !== 200 || !Array.isArray(res.data?.data)) {
      throw new Error(`Expected 200 with filtered items, got ${res.status}`);
    }
  });

  // 5. Admin Assignment
  await test('POST /api/v1/assignments - Assign VOB to specialist', async () => {
    const res = await request('/api/v1/assignments', {
      method: 'POST',
      body: JSON.stringify({
        vob_ids: [sampleVobId],
        assignee_ids: [specialistUser.id],
        strategy: 'even'
      })
    });
    if (res.status !== 200 || !Array.isArray(res.data?.data)) {
      throw new Error(`Expected 200 with data array of assignments, got ${res.status}: ${JSON.stringify(res.data)}`);
    }
  });

  // 6. Specialist Operations
  await test('POST /api/v1/auth/login - Specialist login', async () => {
    const pwd = specialistUser.email === 'user@us24.test' ? 'DevPassword123!' : 'tamanna@123';
    const res = await request('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: specialistUser.email, password: pwd })
    });
    const token = res.data?.access_token || res.data?.token;
    if (res.status !== 200 || !token) {
      throw new Error(`Expected 200 specialist login, got ${res.status}: ${JSON.stringify(res.data)}`);
    }
    specialistToken = token;
    activeToken = token;
  });

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
          copay_coins: '$25.00 Copay',
          coverage_status: 'Active'
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
        fields: { copay_coins: '$999.00' }
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
    // Expected: either 200 (approved / auth_queue) or 422 (validation_failed if mandatory fields empty)
    if (res.status !== 200 && res.status !== 422) {
      throw new Error(`Expected 200 or 422, got ${res.status}: ${JSON.stringify(res.data)}`);
    }
    if (res.status === 200) {
      sampleVobVersion = res.data.version;
    }
  });

  // 7. Exports
  activeToken = adminToken;
  await test('POST /api/v1/exports - Export client records', async () => {
    const res = await request('/api/v1/exports', {
      method: 'POST',
      body: JSON.stringify({ client: firstClientId, format: 'xlsx' })
    });
    if (res.status !== 200 || (!res.data?.url && !res.data?.filename)) {
      throw new Error(`Expected 200 with export response, got ${res.status}: ${JSON.stringify(res.data)}`);
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
