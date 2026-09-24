import React, { useState, useEffect } from 'react';
import { healthApi } from '../../api/health';
import { vobsApi } from '../../api/vobs';
import { authApi } from '../../api/auth';

export function BackendApiTestModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('tests'); // 'tests' | 'endpoints' | 'env'
  const [testResults, setTestResults] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedResponse, setSelectedResponse] = useState(null);
  const [liveHealth, setLiveHealth] = useState({ status: 'checking', latency: 0 });

  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
  const isFallbackMock = import.meta.env.VITE_FALLBACK_MOCK === 'true';

  const checkLiveness = async () => {
    setLiveHealth({ status: 'checking', latency: 0 });
    const start = performance.now();
    try {
      const res = await healthApi.getHealthz();
      const latency = Math.round(performance.now() - start);
      setLiveHealth({ status: res?.status === 'ok' ? 'online' : 'degraded', latency });
    } catch (err) {
      const latency = Math.round(performance.now() - start);
      setLiveHealth({ status: 'offline', latency, error: err.message });
    }
  };

  useEffect(() => {
    if (isOpen) {
      checkLiveness();
    }
  }, [isOpen]);

  const runAllApiTests = async () => {
    setIsRunning(true);
    setTestResults([]);
    setSelectedResponse(null);

    const tests = [
      {
        name: 'GET /healthz (Liveness)',
        fn: async () => healthApi.getHealthz()
      },
      {
        name: 'GET /readyz (Readiness)',
        fn: async () => healthApi.getReadyz()
      },
      {
        name: 'POST /api/v1/auth/login (Auth Token)',
        fn: async () => authApi.login({ email: 'rohit.k@us24solutions.com', password: 'password' })
      },
      {
        name: 'GET /api/v1/auth/me (User Profile)',
        fn: async () => authApi.getMe()
      },
      {
        name: 'GET /api/v1/vobs (Work Queue Collection)',
        fn: async () => vobsApi.getVobs({ limit: 10 })
      },
      {
        name: 'GET /api/v1/vobs?status=assigned&status=in_progress (Filter)',
        fn: async () => vobsApi.getVobs({ status: ['assigned', 'in_progress'] })
      }
    ];

    const results = [];
    for (const t of tests) {
      const start = performance.now();
      try {
        const data = await t.fn();
        const duration = Math.round(performance.now() - start);
        const item = { name: t.name, status: 'PASS', duration, data };
        results.push(item);
        setTestResults([...results]);
      } catch (err) {
        const duration = Math.round(performance.now() - start);
        const item = { name: t.name, status: 'FAIL', duration, error: err.message, data: err };
        results.push(item);
        setTestResults([...results]);
      }
    }
    setIsRunning(false);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-container" 
        onClick={e => e.stopPropagation()} 
        style={{ maxWidth: '820px', width: '92%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Modal Header */}
        <div className="modal-header" style={{ borderBottom: '1px solid var(--border-color)', padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{
              display: 'inline-block',
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: liveHealth.status === 'online' ? '#22c55e' : (liveHealth.status === 'checking' ? '#f59e0b' : '#ef4444')
            }} />
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Backend API Diagnostics & Test Suite</h3>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Target URL: <code style={{ color: 'var(--primary-color)' }}>{backendUrl}</code> · Conforms to <code>api-endpoints.md</code>
              </span>
            </div>
          </div>
          <button type="button" className="drawer-close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Status Strip */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '12px',
          padding: '14px 20px',
          background: 'rgba(0,0,0,0.1)',
          borderBottom: '1px solid var(--border-color)'
        }}>
          <div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Server Health</div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: liveHealth.status === 'online' ? '#22c55e' : '#ef4444', textTransform: 'capitalize' }}>
              {liveHealth.status} ({liveHealth.latency}ms)
            </div>
          </div>
          <div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Local Test Server</div>
            <div style={{ fontSize: '14px', fontWeight: 600 }}>
              <code>npm run api:start</code>
            </div>
          </div>
          <div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Fallback Mock Mode</div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: isFallbackMock ? '#38bdf8' : '#94a3b8' }}>
              {isFallbackMock ? 'Active (Auto-Fallback)' : 'Disabled'}
            </div>
          </div>
        </div>

        {/* Subnav Tabs */}
        <div className="modal-subnav" style={{ padding: '0 20px', borderBottom: '1px solid var(--border-color)' }}>
          <button
            type="button"
            className={`subnav-tab ${activeTab === 'tests' ? 'active' : ''}`}
            onClick={() => setActiveTab('tests')}
          >
            ⚡ Run Test Suite
          </button>
          <button
            type="button"
            className={`subnav-tab ${activeTab === 'endpoints' ? 'active' : ''}`}
            onClick={() => setActiveTab('endpoints')}
          >
            📋 API Specification (12 Endpoints)
          </button>
          <button
            type="button"
            className={`subnav-tab ${activeTab === 'env' ? 'active' : ''}`}
            onClick={() => setActiveTab('env')}
          >
            ⚙️ Environment & CLI
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {activeTab === 'tests' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
                  Execute automated live probe requests against backend endpoints:
                </p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={checkLiveness}
                    style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'inherit' }}
                  >
                    Ping Health
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={runAllApiTests}
                    disabled={isRunning}
                  >
                    {isRunning ? 'Running Probes…' : '▶ Run All Tests'}
                  </button>
                </div>
              </div>

              {testResults.length === 0 && !isRunning && (
                <div style={{
                  padding: '36px',
                  textAlign: 'center',
                  background: 'rgba(255,255,255,0.02)',
                  borderRadius: '8px',
                  border: '1px dashed var(--border-color)'
                }}>
                  <p style={{ margin: '0 0 12px', color: 'var(--text-muted)' }}>No test suite execution recorded yet.</p>
                  <button type="button" className="btn btn-sm" onClick={runAllApiTests}>
                    Click to Run Live API Probes
                  </button>
                </div>
              )}

              {testResults.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {testResults.map((r, i) => (
                    <div
                      key={i}
                      onClick={() => setSelectedResponse(r)}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px 14px',
                        background: selectedResponse === r ? 'rgba(56, 189, 248, 0.1)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${selectedResponse === r ? '#38bdf8' : 'var(--border-color)'}`,
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '13px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 700,
                          backgroundColor: r.status === 'PASS' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                          color: r.status === 'PASS' ? '#22c55e' : '#ef4444'
                        }}>
                          {r.status}
                        </span>
                        <span style={{ fontFamily: 'monospace' }}>{r.name}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-muted)', fontSize: '12px' }}>
                        <span>{r.duration}ms</span>
                        <span style={{ fontSize: '11px', color: '#38bdf8' }}>View JSON →</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selectedResponse && (
                <div style={{ marginTop: '20px', background: '#0a0f1d', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                    <span>Payload Inspector: <strong>{selectedResponse.name}</strong></span>
                    <button
                      type="button"
                      style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer', fontSize: '12px' }}
                      onClick={() => setSelectedResponse(null)}
                    >
                      Close Inspector
                    </button>
                  </div>
                  <pre style={{
                    margin: 0,
                    maxHeight: '220px',
                    overflowY: 'auto',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    color: '#38bdf8',
                    background: 'transparent'
                  }}>
                    {JSON.stringify(selectedResponse.data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {activeTab === 'endpoints' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
              <table className="data-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Method</th>
                    <th>Endpoint</th>
                    <th>Role</th>
                    <th>Purpose / Contract</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><span className="mono bold" style={{ color: '#38bdf8' }}>GET</span></td>
                    <td className="mono">/healthz</td>
                    <td>Public</td>
                    <td>Liveness probe</td>
                  </tr>
                  <tr>
                    <td><span className="mono bold" style={{ color: '#38bdf8' }}>GET</span></td>
                    <td className="mono">/readyz</td>
                    <td>Public</td>
                    <td>Readiness probe</td>
                  </tr>
                  <tr>
                    <td><span className="mono bold" style={{ color: '#22c55e' }}>POST</span></td>
                    <td className="mono">/api/v1/auth/login</td>
                    <td>Public</td>
                    <td>Authenticates user & returns bearer token</td>
                  </tr>
                  <tr>
                    <td><span className="mono bold" style={{ color: '#38bdf8' }}>GET</span></td>
                    <td className="mono">/api/v1/auth/me</td>
                    <td>User</td>
                    <td>Resolves current user from bearer token</td>
                  </tr>
                  <tr>
                    <td><span className="mono bold" style={{ color: '#22c55e' }}>POST</span></td>
                    <td className="mono">/api/v1/assignments</td>
                    <td>Admin</td>
                    <td>Bulk assign VOB records to specialists</td>
                  </tr>
                  <tr>
                    <td><span className="mono bold" style={{ color: '#38bdf8' }}>GET</span></td>
                    <td className="mono">/api/v1/vobs</td>
                    <td>User/Admin</td>
                    <td>Query queue (status, client_id, assignee_id, q)</td>
                  </tr>
                  <tr>
                    <td><span className="mono bold" style={{ color: '#38bdf8' }}>GET</span></td>
                    <td className="mono">/api/v1/vobs/:id</td>
                    <td>User</td>
                    <td>Returns single full record with patient & fields</td>
                  </tr>
                  <tr>
                    <td><span className="mono bold" style={{ color: '#f59e0b' }}>PATCH</span></td>
                    <td className="mono">/api/v1/vobs/:id</td>
                    <td>Assignee</td>
                    <td>Saves field edits (optimistic locking 409)</td>
                  </tr>
                  <tr>
                    <td><span className="mono bold" style={{ color: '#22c55e' }}>POST</span></td>
                    <td className="mono">/api/v1/vobs/:id/submit</td>
                    <td>Assignee</td>
                    <td>Validates & routes (200 approved/auth_queue, 422 error)</td>
                  </tr>
                  <tr>
                    <td><span className="mono bold" style={{ color: '#22c55e' }}>POST</span></td>
                    <td className="mono">/api/v1/vobs/:id/auth</td>
                    <td>Auth Role</td>
                    <td>Records prior authorization number & approves</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'env' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <h4 style={{ margin: '0 0 6px', fontSize: '14px' }}>Starting the Standalone Test Backend Server:</h4>
                <p style={{ margin: '0 0 8px', color: 'var(--text-muted)' }}>
                  A zero-dependency Node.js HTTP server implementing all endpoints from <code>api-endpoints.md</code> is included in the project:
                </p>
                <pre style={{ background: '#000', padding: '10px', borderRadius: '6px', color: '#a5f3fc', fontFamily: 'monospace' }}>
npm run api:start
# or: node backend-test-api.mjs
                </pre>
                <p style={{ margin: '8px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                  Listening on <strong>http://localhost:8000</strong>. Includes full CORS support for browser access.
                </p>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <h4 style={{ margin: '0 0 6px', fontSize: '14px' }}>Running Automated CLI Tests:</h4>
                <p style={{ margin: '0 0 8px', color: 'var(--text-muted)' }}>
                  Run the automated test runner in terminal against any target URL:
                </p>
                <pre style={{ background: '#000', padding: '10px', borderRadius: '6px', color: '#a5f3fc', fontFamily: 'monospace' }}>
npm run api:test
# or against a remote IP:
node scripts/test-backend.mjs http://10.59.197.68:8000
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-sm" onClick={onClose}>
            Close Diagnostics
          </button>
        </div>
      </div>
    </div>
  );
}
