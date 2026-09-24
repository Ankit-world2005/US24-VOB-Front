import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '8000', 10);
const HOST = process.env.HOST || '0.0.0.0';

// In-memory database initialized from DB/vobs.json if present
let vobsDb = [];
let usersDb = [
  { id: 'usr_01', email: 'rohit.k@us24solutions.com', name: 'Rohit Kumar', role: 'specialist' },
  { id: 'usr_02', email: 'anita.s@us24solutions.com', name: 'Anita Sharma', role: 'specialist' },
  { id: 'usr_03', email: 'auth@us24solutions.com', name: 'Auth Specialist', role: 'auth' },
  { id: 'usr_04', email: 'saurabh@us24solutions.com', name: 'Saurabh Admin', role: 'admin' },
  { id: 'usr_05', email: 'admin@us24solutions.com', name: 'System Admin', role: 'admin' }
];

function loadSeedData() {
  try {
    const vobsPath = path.join(__dirname, 'DB', 'vobs.json');
    if (fs.existsSync(vobsPath)) {
      const raw = JSON.parse(fs.readFileSync(vobsPath, 'utf8'));
      const statusGroups = raw.recordsByStatus || {};
      let allRecords = [];
      for (const [statusKey, items] of Object.entries(statusGroups)) {
        if (Array.isArray(items)) {
          items.forEach((item, idx) => {
            allRecords.push(transformToBackendVob(item, statusKey, idx));
          });
        }
      }
      if (allRecords.length > 0) {
        vobsDb = allRecords;
        console.log(`[Backend Test API] Loaded ${vobsDb.length} VOB records from DB/vobs.json`);
        return;
      }
    }
  } catch (err) {
    console.warn('[Backend Test API] Warning reading DB/vobs.json, using default seed:', err.message);
  }

  // Fallback seed
  vobsDb = [
    {
      id: 'vob_parker_001',
      client_id: 'parker',
      client: { id: 'parker', name: 'Parker Rehabilitation' },
      status: 'assigned',
      version: 1,
      assignee_id: 'rohit.k@us24solutions.com',
      assignee: { id: 'usr_01', name: 'Rohit Kumar', email: 'rohit.k@us24solutions.com' },
      format_version: 1,
      patient: { id: 'pt_001', name: 'Eleanor Vance', dob: '1984-03-15' },
      fields: {
        service_type: 'Physical Therapy',
        dos: '2026-09-28',
        insurance: 'Aetna Commercial PPO',
        id_card: 'AET-883921',
        group_no: 'GRP-4412',
        network_status: 'In-Network',
        authorization_required: false,
        copay_coins: '$20.00 Copay',
        copay_amount: '$20.00',
        deductible_applicable: 'Yes',
        deductible_individual: '$1,000.00',
        deductible_met: '$1,000.00',
        deductible_remaining: '$0.00',
        out_of_pocket: '$3,000.00',
        oop_met: '$1,000.00',
        oop_remaining: '$2,000.00',
        payer_id: '60054'
      },
      extra: {},
      sources: {},
      failures: [],
      format: {},
      updated_at: new Date().toISOString()
    },
    {
      id: 'vob_parker_002',
      client_id: 'parker',
      client: { id: 'parker', name: 'Parker Rehabilitation' },
      status: 'in_progress',
      version: 1,
      assignee_id: 'rohit.k@us24solutions.com',
      assignee: { id: 'usr_01', name: 'Rohit Kumar', email: 'rohit.k@us24solutions.com' },
      format_version: 1,
      patient: { id: 'pt_002', name: 'Arthur Dent', dob: '1988-06-21' },
      fields: {
        service_type: 'Physical Therapy',
        dos: '2026-09-29',
        insurance: 'Blue Cross Blue Shield',
        id_card: 'BCBS-91823719',
        group_no: 'GRP-77291',
        network_status: 'In-Network',
        authorization_required: true,
        copay_coins: '$25.00 Copay',
        copay_amount: '$25.00',
        deductible_applicable: 'Yes',
        deductible_individual: '$1,500.00',
        deductible_met: '$500.00',
        deductible_remaining: '$1,000.00',
        out_of_pocket: '$4,000.00',
        oop_met: '$500.00',
        oop_remaining: '$3,500.00',
        payer_id: '00620'
      },
      extra: {},
      sources: {},
      failures: [],
      format: {},
      updated_at: new Date().toISOString()
    },
    {
      id: 'vob_arra_003',
      client_id: 'arra',
      client: { id: 'arra', name: 'ARRA Health' },
      status: 'auth_queue',
      version: 2,
      assignee_id: 'anita.s@us24solutions.com',
      assignee: { id: 'usr_02', name: 'Anita Sharma', email: 'anita.s@us24solutions.com' },
      format_version: 1,
      patient: { id: 'pt_003', name: 'Carlos Morales', dob: '1976-11-04' },
      fields: {
        service_type: 'Occupational Therapy',
        dos: '2026-10-02',
        insurance: 'United Healthcare',
        id_card: 'UHC-551928',
        group_no: 'GRP-UHC-01',
        network_status: 'In-Network',
        authorization_required: true,
        copay_coins: '20%',
        payer_id: '87726'
      },
      extra: {},
      sources: {},
      failures: [],
      format: {},
      updated_at: new Date().toISOString()
    }
  ];
  console.log(`[Backend Test API] Initialized fallback seed with ${vobsDb.length} VOB records`);
}

function transformToBackendVob(item, statusKey, idx) {
  const backendStatusMap = {
    assigned: 'assigned',
    in_progress: 'in_progress',
    error: 'error',
    auth_queue: 'auth_queue',
    approved: 'approved'
  };
  const status = backendStatusMap[statusKey] || 'assigned';
  const clientId = item.client || 'parker';
  const clientName = clientId.charAt(0).toUpperCase() + clientId.slice(1) + ' Healthcare';
  const patientName = item.patientName || `Patient ${idx + 1}`;
  const dob = item.dob || '1990-01-01';
  const dos = item.dos || '2026-10-01';

  const fields = {
    patient_name: patientName,
    dob,
    dos,
    service_type: item.serviceType || item.appointmentType || 'Physical Therapy',
    insurance: item.insurance || 'Blue Cross Blue Shield',
    insurance_phone: item.insurancePhone || '1-800-555-0199',
    id_card: item.idCard || `ID-${1000 + idx}`,
    group_no: item.groupNo || 'GRP-100',
    network_status: item.networkStatus || 'In-Network',
    coverage_status: item.coverageStatus || 'Active',
    effective_date: item.effectiveDate || '2026-01-01',
    terminationDate: item.terminationDate || 'NO',
    copay: item.copay || 'YES',
    copay_amount: item.copayAmount || '$25.00',
    copay_coins: item.copayCoinsurance || item.copayAmount || '$25.00',
    deductible_applicable: item.deductibleApplicable || 'Yes',
    deductible_individual: item.deductibleIndividual || '$1,000.00',
    deductible_met: item.deductibleMet || '$1,000.00',
    deductible_remaining: item.deductibleRemaining || '$0.00',
    out_of_pocket: item.outOfPocket || '$3,000.00',
    oop_met: item.oopMet || '$1,000.00',
    oop_remaining: item.oopRemaining || '$2,000.00',
    visits_limitation: item.visitsLimitation || '30 visits / year',
    visits_used: item.visitsUsed || '0',
    authorization_required: item.authorization === 'Yes' || item.authorizationRequired === true || status === 'auth_queue',
    auth_request_tat: item.authRequestTat || '3-5 business days',
    auth_number: item.authDetails?.authNumber || item.authNumber || (status === 'approved' ? `AUTH-${9000 + idx}` : ''),
    auth_valid_from: item.authDetails?.authStartDate || item.authStartDate || (status === 'approved' ? dos : ''),
    auth_valid_to: item.authDetails?.authEndDate || item.authEndDate || (status === 'approved' ? '2026-12-31' : ''),
    payer_id: item.payerId || '99201',
    insurance_rep: item.insuranceRep || 'Agent Smith',
    call_reference: item.callReference || `REF-${8000 + idx}`,
    secondary_yes_no: item.secondaryYesNo || 'No'
  };

  const failures = Array.isArray(item.failingRules) 
    ? item.failingRules.map(r => r.field || r) 
    : (status === 'error' ? ['copay_coins', 'network_status'] : []);

  const assigneeEmail = item.assignedTo || 'rohit.k@us24solutions.com';

  return {
    id: item.id || `vob_${clientId}_${String(idx + 1).padStart(3, '0')}`,
    client_id: clientId,
    client: { id: clientId, name: clientName },
    status,
    version: item.version || 1,
    assignee_id: assigneeEmail,
    assignee: {
      id: assigneeEmail.split('@')[0],
      name: assigneeEmail.split('@')[0].replace('.', ' '),
      email: assigneeEmail
    },
    format_version: 1,
    patient: {
      id: `pt_${idx + 1}`,
      name: patientName,
      dob
    },
    fields,
    extra: item.extra || {},
    sources: item.sources || {},
    failures,
    format: item.format || {},
    updated_at: item.updated_at || new Date().toISOString(),
    completed_at: status === 'approved' ? (item.vobCompletionDate || new Date().toISOString()) : undefined
  };
}

loadSeedData();

// Helper to parse JSON body
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 5 * 1024 * 1024) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body.trim()) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON in request body'));
      }
    });
    req.on('error', reject);
  });
}

// Helper to write JSON response with CORS
function sendJson(res, statusCode, data, headers = {}) {
  const json = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, X-Requested-With',
    'Access-Control-Allow-Credentials': 'true',
    ...headers
  });
  res.end(json);
}

// Server Request Handler
const server = http.createServer(async (req, res) => {
  const startTime = Date.now();
  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = reqUrl.pathname;
  const method = req.method.toUpperCase();

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, X-Requested-With',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400'
    });
    res.end();
    return;
  }

  const logDone = (code) => {
    const ms = Date.now() - startTime;
    console.log(`[${code}] ${method} ${pathname} - ${ms}ms`);
  };

  try {
    // -------------------------------------------------------------
    // 1. Root / Landing Page (HTML API Explorer)
    // -------------------------------------------------------------
    if (pathname === '/' && method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(renderApiExplorerHtml());
      logDone(200);
      return;
    }

    // -------------------------------------------------------------
    // 2. Health Checks
    // -------------------------------------------------------------
    if (pathname === '/healthz' && method === 'GET') {
      sendJson(res, 200, { status: 'ok', timestamp: new Date().toISOString() });
      logDone(200);
      return;
    }

    if (pathname === '/readyz' && method === 'GET') {
      sendJson(res, 200, { status: 'ok', db: 'connected', total_records: vobsDb.length });
      logDone(200);
      return;
    }

    // -------------------------------------------------------------
    // 3. Auth Endpoints
    // -------------------------------------------------------------
    if (pathname === '/api/v1/auth/login' && method === 'POST') {
      const body = await parseJsonBody(req);
      const email = body.email || 'rohit.k@us24solutions.com';
      const role = email.includes('admin') ? 'admin' : (email.includes('auth') ? 'auth' : 'specialist');
      const matched = usersDb.find(u => u.email.toLowerCase() === email.toLowerCase()) || {
        id: `usr_${Date.now()}`,
        email,
        name: email.split('@')[0].replace('.', ' '),
        role
      };

      sendJson(res, 200, {
        token: `mock_jwt_token_${Date.now()}`,
        user: matched
      });
      logDone(200);
      return;
    }

    if (pathname === '/api/v1/auth/refresh' && method === 'POST') {
      sendJson(res, 200, {
        token: `mock_jwt_token_refreshed_${Date.now()}`
      });
      logDone(200);
      return;
    }

    if (pathname === '/api/v1/auth/logout' && method === 'POST') {
      sendJson(res, 200, { success: true });
      logDone(200);
      return;
    }

    if (pathname === '/api/v1/auth/me' && method === 'GET') {
      // Resolve from Authorization header or default
      const authHeader = req.headers.authorization || '';
      sendJson(res, 200, {
        user: usersDb[0]
      });
      logDone(200);
      return;
    }

    // -------------------------------------------------------------
    // 4. Assignments Endpoint (Admin)
    // -------------------------------------------------------------
    if (pathname === '/api/v1/assignments' && method === 'POST') {
      const body = await parseJsonBody(req);
      const vobIds = body.vob_ids || body.vobIds || [];
      const assigneeIds = body.assignee_ids || body.assignees || ['rohit.k@us24solutions.com'];
      const assignmentMap = body.assignment_map || body.assignmentMap || {};
      const results = [];

      vobIds.forEach((vobId, idx) => {
        const vob = vobsDb.find(v => v.id === vobId);
        if (vob) {
          const assignee = assignmentMap[vobId] || assigneeIds[idx % assigneeIds.length];
          const changed = vob.assignee_id !== assignee;
          vob.assignee_id = assignee;
          if (vob.assignee) vob.assignee.email = assignee;
          if (vob.status === 'assigned') vob.version = (vob.version || 1) + 1;
          results.push({ vob_id: vobId, assignee_id: assignee, changed });
        }
      });

      sendJson(res, 200, { data: results });
      logDone(200);
      return;
    }

    // -------------------------------------------------------------
    // 5. VOBs Collection: GET /api/v1/vobs
    // -------------------------------------------------------------
    if (pathname === '/api/v1/vobs' && method === 'GET') {
      let filtered = [...vobsDb];

      // Handle repeatable status param: ?status=assigned&status=in_progress
      const statuses = reqUrl.searchParams.getAll('status');
      if (statuses.length > 0 && !statuses.includes('all') && !statuses.includes('ALL')) {
        const lowerStatuses = statuses.map(s => s.toLowerCase());
        filtered = filtered.filter(v => lowerStatuses.includes((v.status || '').toLowerCase()));
      }

      // Filter by client_id
      const clientId = reqUrl.searchParams.get('client_id');
      if (clientId && clientId !== 'all') {
        filtered = filtered.filter(v => v.client_id === clientId || v.client?.id === clientId);
      }

      // Filter by assignee_id
      const assigneeId = reqUrl.searchParams.get('assignee_id');
      if (assigneeId) {
        if (assigneeId === 'none') {
          filtered = filtered.filter(v => !v.assignee_id || v.assignee_id === 'none');
        } else {
          filtered = filtered.filter(v => (v.assignee_id || '').toLowerCase() === assigneeId.toLowerCase());
        }
      }

      // Filter by search query (q)
      const q = (reqUrl.searchParams.get('q') || '').toLowerCase();
      if (q) {
        filtered = filtered.filter(v => 
          (v.patient?.name || '').toLowerCase().includes(q) ||
          (v.fields?.insurance || '').toLowerCase().includes(q) ||
          (v.fields?.id_card || '').toLowerCase().includes(q) ||
          (v.id || '').toLowerCase().includes(q)
        );
      }

      // Prepare list items matching GET /api/v1/vobs contract
      const listData = filtered.map(v => ({
        id: v.id,
        client: v.client,
        patient_name: v.patient?.name || v.fields?.patient_name || 'Unknown Patient',
        dos: v.fields?.dos || '',
        status: v.status,
        assignee: v.assignee,
        failure_count: v.failures?.length || 0,
        updated_at: v.updated_at
      }));

      sendJson(res, 200, {
        data: listData,
        page: {
          limit: listData.length,
          next_cursor: null,
          has_more: false
        }
      });
      logDone(200);
      return;
    }

    // -------------------------------------------------------------
    // 6. Single VOB Routes: /api/v1/vobs/:id
    // -------------------------------------------------------------
    const vobPathMatch = pathname.match(/^\/api\/v1\/vobs\/([^/]+)(\/(submit|auth|transcript))?$/);
    if (vobPathMatch) {
      const vobId = vobPathMatch[1];
      const subAction = vobPathMatch[3]; // 'submit', 'auth', or undefined

      const vobIndex = vobsDb.findIndex(v => v.id === vobId);
      if (vobIndex === -1) {
        sendJson(res, 404, {
          error: { code: 'not_found', message: `VOB with ID ${vobId} not found` }
        });
        logDone(404);
        return;
      }
      const vob = vobsDb[vobIndex];

      // POST /api/v1/vobs/:id/submit
      if (subAction === 'submit' && method === 'POST') {
        const body = await parseJsonBody(req);
        const expectedVersion = body.version;

        if (expectedVersion !== undefined && vob.version !== expectedVersion) {
          sendJson(res, 409, {
            error: {
              code: 'conflict',
              message: `Version mismatch: current is ${vob.version}, but request was ${expectedVersion}`
            }
          });
          logDone(409);
          return;
        }

        // Validate mandatory fields
        const failures = [];
        const f = vob.fields || {};
        if (!vob.patient?.name && !f.patient_name) failures.push('patient_name');
        if (!vob.patient?.dob && !f.dob) failures.push('dob');
        if (!f.dos) failures.push('dos');
        if (!f.insurance) failures.push('insurance');
        if (!f.id_card) failures.push('id_card');
        if (!f.copay_coins && !f.copay_amount) failures.push('copay_coins');

        if (failures.length > 0) {
          vob.status = 'error';
          vob.failures = failures;
          vob.version = (vob.version || 1) + 1;
          vob.updated_at = new Date().toISOString();

          sendJson(res, 422, {
            error: {
              code: 'validation_failed',
              message: 'Validation failed for required fields',
              details: {
                status: 'error',
                version: vob.version,
                failures
              }
            }
          });
          logDone(422);
          return;
        }

        // Check if authorization is required
        if (f.authorization_required === true && !f.auth_number) {
          vob.status = 'auth_queue';
          vob.version = (vob.version || 1) + 1;
          vob.updated_at = new Date().toISOString();

          sendJson(res, 200, {
            status: 'auth_queue',
            version: vob.version
          });
          logDone(200);
          return;
        }

        // Approved
        vob.status = 'approved';
        vob.version = (vob.version || 1) + 1;
        vob.completed_at = new Date().toISOString();
        vob.updated_at = vob.completed_at;

        sendJson(res, 200, {
          status: 'approved',
          version: vob.version,
          completed_at: vob.completed_at
        });
        logDone(200);
        return;
      }

      // POST /api/v1/vobs/:id/auth
      if (subAction === 'auth' && method === 'POST') {
        const body = await parseJsonBody(req);
        const expectedVersion = body.version;

        if (expectedVersion !== undefined && vob.version !== expectedVersion) {
          sendJson(res, 409, {
            error: { code: 'conflict', message: 'Version mismatch. Reload latest.' }
          });
          logDone(409);
          return;
        }

        vob.fields = vob.fields || {};
        vob.fields.auth_number = body.auth_number || '';
        vob.fields.auth_valid_from = body.auth_valid_from || '';
        vob.fields.auth_valid_to = body.auth_valid_to || '';
        vob.status = 'approved';
        vob.version = (vob.version || 1) + 1;
        vob.completed_at = new Date().toISOString();
        vob.updated_at = vob.completed_at;

        sendJson(res, 200, {
          status: 'approved',
          version: vob.version,
          completed_at: vob.completed_at
        });
        logDone(200);
        return;
      }

      // GET /api/v1/vobs/:id
      if (!subAction && method === 'GET') {
        sendJson(res, 200, vob);
        logDone(200);
        return;
      }

      // PATCH /api/v1/vobs/:id
      if (!subAction && method === 'PATCH') {
        const body = await parseJsonBody(req);
        const expectedVersion = body.version;

        if (expectedVersion !== undefined && vob.version !== expectedVersion) {
          sendJson(res, 409, {
            error: {
              code: 'conflict',
              message: `Version conflict: current DB version is ${vob.version}, payload specified ${expectedVersion}`
            }
          });
          logDone(409);
          return;
        }

        // Apply fields update
        if (body.fields && typeof body.fields === 'object') {
          vob.fields = { ...vob.fields, ...body.fields };
        }
        if (body.extra && typeof body.extra === 'object') {
          vob.extra = { ...vob.extra, ...body.extra };
        }

        vob.version = (vob.version || 1) + 1;
        vob.updated_at = new Date().toISOString();
        if (vob.status === 'assigned') {
          vob.status = 'in_progress';
        }

        sendJson(res, 200, {
          id: vob.id,
          version: vob.version,
          updated_at: vob.updated_at
        });
        logDone(200);
        return;
      }
    }

    // -------------------------------------------------------------
    // 7. Users collection: GET /api/v1/users
    // -------------------------------------------------------------
    if (pathname === '/api/v1/users' && method === 'GET') {
      sendJson(res, 200, { data: usersDb });
      logDone(200);
      return;
    }

    // 404 for unhandled paths
    sendJson(res, 404, {
      error: { code: 'route_not_found', message: `Route ${method} ${pathname} not found` }
    });
    logDone(404);

  } catch (err) {
    console.error(`[500] ${method} ${pathname} Error:`, err);
    sendJson(res, 500, {
      error: { code: 'server_error', message: err.message || 'Internal Server Error' }
    });
    logDone(500);
  }
});

// HTML API Explorer interface served at root http://localhost:8000/
function renderApiExplorerHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>US24 VOB Backend Test API</title>
  <style>
    :root {
      --bg: #0f172a;
      --card: #1e293b;
      --text: #f8fafc;
      --sub: #94a3b8;
      --accent: #38bdf8;
      --green: #22c55e;
      --amber: #f59e0b;
      --red: #ef4444;
      --border: #334155;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background: var(--bg); color: var(--text); padding: 32px 24px; min-height: 100vh; }
    .container { max-width: 1000px; margin: 0 auto; }
    header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 28px; border-bottom: 1px solid var(--border); padding-bottom: 20px; }
    h1 { font-size: 24px; font-weight: 700; color: #fff; }
    .status-badge { display: inline-flex; align-items: center; gap: 8px; background: rgba(34, 197, 94, 0.15); color: var(--green); padding: 6px 14px; border-radius: 9999px; font-size: 13px; font-weight: 600; border: 1px solid rgba(34, 197, 94, 0.3); }
    .dot { width: 8px; height: 8px; background: var(--green); border-radius: 50%; animation: pulse 2s infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
    .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 28px; }
    .stat-card { background: var(--card); border: 1px solid var(--border); padding: 18px; border-radius: 10px; }
    .stat-title { font-size: 12px; text-transform: uppercase; color: var(--sub); letter-spacing: 0.05em; margin-bottom: 6px; }
    .stat-val { font-size: 24px; font-weight: 700; color: var(--accent); }
    .section-title { font-size: 18px; font-weight: 600; margin: 24px 0 14px; }
    .endpoint-card { background: var(--card); border: 1px solid var(--border); border-radius: 8px; margin-bottom: 12px; overflow: hidden; }
    .endpoint-header { display: flex; justify-content: space-between; align-items: center; padding: 14px 18px; cursor: pointer; user-select: none; }
    .endpoint-left { display: flex; align-items: center; gap: 12px; }
    .method { padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 700; font-family: monospace; }
    .method.GET { background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); }
    .method.POST { background: rgba(34, 197, 94, 0.15); color: #22c55e; border: 1px solid rgba(34, 197, 94, 0.3); }
    .method.PATCH { background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3); }
    .path { font-family: monospace; font-size: 14px; color: #f1f5f9; }
    .desc { font-size: 13px; color: var(--sub); }
    .btn-test { background: var(--accent); color: #0f172a; border: none; padding: 6px 14px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; transition: 0.15s; }
    .btn-test:hover { filter: brightness(1.1); }
    .console-panel { background: #000; border: 1px solid var(--border); border-radius: 8px; padding: 16px; margin-top: 24px; font-family: monospace; font-size: 13px; }
    .console-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; color: var(--sub); }
    pre { color: #a5f3fc; overflow-x: auto; max-height: 350px; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div>
        <h1>US24 VOB Backend Test API</h1>
        <p style="color: var(--sub); font-size: 13px; margin-top: 4px;">Standalone test backend implementing api-endpoints.md specifications</p>
      </div>
      <div class="status-badge"><span class="dot"></span> Online on Port ${PORT}</div>
    </header>

    <div class="summary-grid">
      <div class="stat-card">
        <div class="stat-title">Loaded VOB Records</div>
        <div class="stat-val" id="stat-vobs">${vobsDb.length}</div>
      </div>
      <div class="stat-card">
        <div class="stat-title">Mock Specialists</div>
        <div class="stat-val">${usersDb.length}</div>
      </div>
      <div class="stat-card">
        <div class="stat-title">CORS Headers</div>
        <div class="stat-val" style="color: var(--green);">Enabled (*)</div>
      </div>
      <div class="stat-card">
        <div class="stat-title">Spec Conformance</div>
        <div class="stat-val" style="color: var(--accent);">api-endpoints.md</div>
      </div>
    </div>

    <div class="section-title">Backend API Endpoints (Click "Test" to Execute live)</div>

    <div class="endpoint-card">
      <div class="endpoint-header">
        <div class="endpoint-left">
          <span class="method GET">GET</span>
          <span class="path">/healthz</span>
          <span class="desc">Liveness probe</span>
        </div>
        <button class="btn-test" onclick="runTest('GET', '/healthz')">Test</button>
      </div>
    </div>

    <div class="endpoint-card">
      <div class="endpoint-header">
        <div class="endpoint-left">
          <span class="method GET">GET</span>
          <span class="path">/readyz</span>
          <span class="desc">Readiness check</span>
        </div>
        <button class="btn-test" onclick="runTest('GET', '/readyz')">Test</button>
      </div>
    </div>

    <div class="endpoint-card">
      <div class="endpoint-header">
        <div class="endpoint-left">
          <span class="method POST">POST</span>
          <span class="path">/api/v1/auth/login</span>
          <span class="desc">Login test specialist</span>
        </div>
        <button class="btn-test" onclick="runTest('POST', '/api/v1/auth/login', { email: 'rohit.k@us24solutions.com', password: 'test' })">Test</button>
      </div>
    </div>

    <div class="endpoint-card">
      <div class="endpoint-header">
        <div class="endpoint-left">
          <span class="method GET">GET</span>
          <span class="path">/api/v1/vobs</span>
          <span class="desc">Fetch VOB work queue</span>
        </div>
        <button class="btn-test" onclick="runTest('GET', '/api/v1/vobs')">Test</button>
      </div>
    </div>

    <div class="endpoint-card">
      <div class="endpoint-header">
        <div class="endpoint-left">
          <span class="method GET">GET</span>
          <span class="path">/api/v1/vobs/:id</span>
          <span class="desc">Fetch full single VOB</span>
        </div>
        <button class="btn-test" onclick="runTest('GET', '/api/v1/vobs/${vobsDb[0]?.id || 'vob_parker_001'}')">Test</button>
      </div>
    </div>

    <div class="endpoint-card">
      <div class="endpoint-header">
        <div class="endpoint-left">
          <span class="method PATCH">PATCH</span>
          <span class="path">/api/v1/vobs/:id</span>
          <span class="desc">Save field edits</span>
        </div>
        <button class="btn-test" onclick="runTest('PATCH', '/api/v1/vobs/${vobsDb[0]?.id || 'vob_parker_001'}', { version: ${vobsDb[0]?.version || 1}, fields: { copay_amount: '$30.00' } })">Test</button>
      </div>
    </div>

    <div class="endpoint-card">
      <div class="endpoint-header">
        <div class="endpoint-left">
          <span class="method POST">POST</span>
          <span class="path">/api/v1/assignments</span>
          <span class="desc">Bulk assign VOBs</span>
        </div>
        <button class="btn-test" onclick="runTest('POST', '/api/v1/assignments', { vob_ids: ['${vobsDb[0]?.id || 'vob_parker_001'}'], assignee_ids: ['rohit.k@us24solutions.com'], strategy: 'even' })">Test</button>
      </div>
    </div>

    <div class="console-panel">
      <div class="console-header">
        <span>Test Response Console</span>
        <span id="res-status" style="font-weight: bold;">Ready</span>
      </div>
      <pre id="output">// Click any "Test" button above to view live HTTP response payload...</pre>
    </div>
  </div>

  <script>
    async function runTest(method, url, body) {
      const output = document.getElementById('output');
      const statusEl = document.getElementById('res-status');
      output.innerText = '// Sending ' + method + ' ' + url + ' ...';
      statusEl.innerText = 'Pending...';
      statusEl.style.color = '#38bdf8';

      const start = performance.now();
      try {
        const opts = { method, headers: { 'Content-Type': 'application/json' } };
        if (body) opts.body = JSON.stringify(body);
        const res = await fetch(url, opts);
        const ms = (performance.now() - start).toFixed(1);
        const data = await res.json();
        statusEl.innerText = res.status + ' ' + res.statusText + ' (' + ms + 'ms)';
        statusEl.style.color = res.ok ? '#22c55e' : '#ef4444';
        output.innerText = JSON.stringify(data, null, 2);
      } catch (err) {
        statusEl.innerText = 'Error';
        statusEl.style.color = '#ef4444';
        output.innerText = 'Fetch error: ' + err.message;
      }
    }
  </script>
</body>
</html>`;
}

server.listen(PORT, HOST, () => {
  console.log('=================================================================');
  console.log(`🚀 US24 VOB Backend Test API Server is listening!`);
  console.log(`   Address:      http://localhost:${PORT}`);
  console.log(`   Healthcheck:  http://localhost:${PORT}/healthz`);
  console.log(`   Ready check:  http://localhost:${PORT}/readyz`);
  console.log(`   VOBs API:     http://localhost:${PORT}/api/v1/vobs`);
  console.log(`   API Explorer: Open http://localhost:${PORT}/ in your browser`);
  console.log('=================================================================');
});
