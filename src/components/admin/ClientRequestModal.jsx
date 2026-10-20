import React, { useState, useEffect } from 'react';
import { CLIENTS } from '../../data/clients';
import { usersApi } from '../../api/users';
import { useWorkspace } from '../../context/WorkspaceContext';

const STORAGE_KEY = 'us24_client_requests';

const INITIAL_REQUESTS = [
  {
    id: 'CR-1001',
    mode: 'Teams',
    client: 'arra',
    insName: 'UnitedHealthcare (UHC)',
    insPhone: '1-800-842-8178',
    planType: 'Choice Plus PPO',
    remark: 'Urgent authorization verification requested via clinical Teams channel',
    assignTo: 'rohit.k@us24solutions.com',
    total: 5,
    completed: 4,
    notCompleted: 1,
    status: 'In Progress',
    createdAt: new Date(Date.now() - 3600000 * 4).toISOString()
  },
  {
    id: 'CR-1002',
    mode: 'Email',
    client: 'west_az',
    insName: 'Blue Cross Blue Shield (BCBS)',
    insPhone: '1-800-241-0803',
    planType: 'BlueCare HMO',
    remark: 'Client escalation email regarding secondary coverage breakdown',
    assignTo: 'specialist@us24solutions.com',
    total: 3,
    completed: 3,
    notCompleted: 0,
    status: 'Completed',
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString()
  },
  {
    id: 'CR-1003',
    mode: 'Sheet',
    client: 'sugarland',
    insName: 'Aetna Healthcare',
    insPhone: '1-800-872-3862',
    planType: 'Managed Choice POS',
    remark: 'Batched sheet request with 8 patient policies to verify today',
    assignTo: 'rohit.k@us24solutions.com',
    total: 8,
    completed: 2,
    notCompleted: 6,
    status: 'Not completed',
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString()
  }
];

export function ClientRequestModal({ isOpen, onClose, onUpdated }) {
  const { showToast } = useWorkspace();

  const [requests, setRequests] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to parse saved client requests', e);
    }
    return INITIAL_REQUESTS;
  });

  const [specialists, setSpecialists] = useState([
    { name: 'Rohit K', email: 'rohit.k@us24solutions.com' },
    { name: 'Specialist User', email: 'specialist@us24solutions.com' },
    { name: 'Audit Specialist', email: 'audit@us24solutions.com' }
  ]);

  // Form Fields State
  const [mode, setMode] = useState('Teams');
  const [selectedClient, setSelectedClient] = useState('arra');
  const [insName, setInsName] = useState('');
  const [insPhone, setInsPhone] = useState('');
  const [planType, setPlanType] = useState('');
  const [remark, setRemark] = useState('');
  const [assignTo, setAssignTo] = useState('rohit.k@us24solutions.com');

  // Search & Filter state for the request log
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [activeTab, setActiveTab] = useState('new'); // 'new' or 'log'

  // Load specialists from backend
  useEffect(() => {
    if (!isOpen) return;
    usersApi.getUsers().then(users => {
      if (Array.isArray(users) && users.length > 0) {
        setSpecialists(users.filter(u => u.active !== false));
      }
    }).catch(console.warn);
  }, [isOpen]);

  // Save requests to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
      if (onUpdated) onUpdated(requests);
    } catch (e) {
      console.warn('Failed to save client requests', e);
    }
  }, [requests, onUpdated]);

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!insName.trim()) {
      showToast('Please enter an Insurance Name (INS NAME).', 'warning');
      return;
    }

    const nextId = `CR-${1000 + requests.length + 1}`;
    const newEntry = {
      id: nextId,
      mode,
      client: selectedClient,
      insName: insName.trim(),
      insPhone: insPhone.trim(),
      planType: planType.trim(),
      remark: remark.trim(),
      assignTo,
      total: 1,
      completed: 0,
      notCompleted: 1,
      status: 'Not completed',
      createdAt: new Date().toISOString()
    };

    setRequests(prev => [newEntry, ...prev]);
    showToast(`Client request ${nextId} saved successfully!`, 'success');

    // Reset form for next entry
    setInsName('');
    setInsPhone('');
    setPlanType('');
    setRemark('');
    setActiveTab('log');
  };

  const toggleStatus = (id) => {
    setRequests(prev => prev.map(req => {
      if (req.id !== id) return req;
      const isNowCompleted = req.status !== 'Completed';
      return {
        ...req,
        status: isNowCompleted ? 'Completed' : 'Not completed',
        completed: isNowCompleted ? req.total : 0,
        notCompleted: isNowCompleted ? 0 : req.total
      };
    }));
    showToast('Request status updated.', 'info');
  };

  const deleteRequest = (id) => {
    if (!window.confirm(`Delete client request ${id}?`)) return;
    setRequests(prev => prev.filter(r => r.id !== id));
    showToast(`Request ${id} deleted.`, 'info');
  };

  if (!isOpen) return null;

  // Aggregate Metrics
  const totalVolume = requests.reduce((acc, r) => acc + (Number(r.total) || 1), 0);
  const totalCompleted = requests.reduce((acc, r) => acc + (Number(r.completed) || 0), 0);
  const totalNotCompleted = requests.reduce((acc, r) => acc + (Number(r.notCompleted) || 0), 0);

  // Filtered requests for the Log tab
  const filteredRequests = requests.filter(r => {
    if (filterMode !== 'all' && r.mode !== filterMode) return false;
    if (filterStatus === 'completed' && r.status !== 'Completed') return false;
    if (filterStatus === 'not_completed' && r.status === 'Completed') return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.id.toLowerCase().includes(q) ||
      (r.insName || '').toLowerCase().includes(q) ||
      (r.planType || '').toLowerCase().includes(q) ||
      (r.remark || '').toLowerCase().includes(q) ||
      (r.assignTo || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div
        className="modal-container"
        style={{ maxWidth: '960px', width: '95%', maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="client-request-title"
      >
        {/* Header */}
        <div className="modal-header" style={{ borderBottom: '1px solid var(--rule-soft)', padding: '16px 24px' }}>
          <div>
            <div className="modal-eyebrow">Intake & Coordination · Client Operations</div>
            <h3 id="client-request-title" className="modal-title" style={{ margin: '2px 0 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>📥</span> Client Request Intake &amp; Tracking
            </h3>
          </div>
          <button type="button" className="drawer-close-btn" onClick={onClose} aria-label="Close modal">
            &times;
          </button>
        </div>

        {/* Aggregate KPI Summary Pills */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px',
          padding: '16px 24px',
          background: 'var(--surface-2)',
          borderBottom: '1px solid var(--rule)'
        }}>
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--rule)',
            borderRadius: '8px',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--ink-soft)', fontWeight: 600, letterSpacing: '0.04em' }}>
                Total Requests / Units
              </span>
              <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--ink)' }}>{totalVolume}</div>
            </div>
            <div style={{ fontSize: '24px' }}>📋</div>
          </div>

          <div style={{
            background: 'var(--surface)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            borderRadius: '8px',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#059669', fontWeight: 600, letterSpacing: '0.04em' }}>
                Completed
              </span>
              <div style={{ fontSize: '22px', fontWeight: 700, color: '#059669' }}>{totalCompleted}</div>
            </div>
            <div style={{ fontSize: '24px' }}>✅</div>
          </div>

          <div style={{
            background: 'var(--surface)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: '8px',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#dc2626', fontWeight: 600, letterSpacing: '0.04em' }}>
                Not Completed (Pending)
              </span>
              <div style={{ fontSize: '22px', fontWeight: 700, color: '#dc2626' }}>{totalNotCompleted}</div>
            </div>
            <div style={{ fontSize: '24px' }}>⏳</div>
          </div>
        </div>

        {/* Tab Controls */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--rule)',
          background: 'var(--surface)',
          padding: '0 24px'
        }}>
          <button
            type="button"
            onClick={() => setActiveTab('new')}
            style={{
              padding: '12px 18px',
              border: 'none',
              background: 'transparent',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              color: activeTab === 'new' ? 'var(--primary, #0284c7)' : 'var(--ink-soft)',
              borderBottom: activeTab === 'new' ? '2px solid var(--primary, #0284c7)' : '2px solid transparent'
            }}
          >
            + New Client Request
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('log')}
            style={{
              padding: '12px 18px',
              border: 'none',
              background: 'transparent',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              color: activeTab === 'log' ? 'var(--primary, #0284c7)' : 'var(--ink-soft)',
              borderBottom: activeTab === 'log' ? '2px solid var(--primary, #0284c7)' : '2px solid transparent'
            }}
          >
            📋 Requests Log &amp; Progress ({requests.length})
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {activeTab === 'new' ? (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: '16px'
              }}>
                {/* 1. Mode Dropdown */}
                <div className="field">
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>
                    Mode (Intake Channel) *
                  </label>
                  <select
                    className="select-input"
                    value={mode}
                    onChange={(e) => setMode(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--rule)', background: 'var(--surface)', color: 'var(--ink)' }}
                  >
                    <option value="Teams">💬 Teams (Microsoft Teams Channel/Chat)</option>
                    <option value="Sheet">📊 Sheet (Spreadsheet/Tracker)</option>
                    <option value="Email">✉️ Email (Client Direct Message)</option>
                  </select>
                </div>

                {/* Client Organization */}
                <div className="field">
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>
                    Client Organization *
                  </label>
                  <select
                    className="select-input"
                    value={selectedClient}
                    onChange={(e) => setSelectedClient(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--rule)', background: 'var(--surface)', color: 'var(--ink)' }}
                  >
                    {CLIENTS.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {/* 2. INS NAME */}
                <div className="field">
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>
                    INS NAME (Insurance / Payer) *
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. UHC, BCBS, Aetna, Humana, Medicare..."
                    value={insName}
                    onChange={(e) => setInsName(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--rule)', background: 'var(--surface)', color: 'var(--ink)' }}
                    required
                  />
                </div>

                {/* 3. INS PHONE NO */}
                <div className="field">
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>
                    INS PHONE NO
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. 1-800-842-8178 or 800-344-4567"
                    value={insPhone}
                    onChange={(e) => setInsPhone(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--rule)', background: 'var(--surface)', color: 'var(--ink)' }}
                  />
                </div>

                {/* 4. PLAN TYPE */}
                <div className="field">
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>
                    PLAN TYPE
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. PPO, HMO, Medicare Advantage, POS, Commercial..."
                    value={planType}
                    onChange={(e) => setPlanType(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--rule)', background: 'var(--surface)', color: 'var(--ink)' }}
                  />
                </div>

                {/* 5. Assign Too */}
                <div className="field">
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>
                    Assign Too (Specialist)
                  </label>
                  <select
                    className="select-input"
                    value={assignTo}
                    onChange={(e) => setAssignTo(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--rule)', background: 'var(--surface)', color: 'var(--ink)' }}
                  >
                    {specialists.map(s => (
                      <option key={s.email} value={s.email}>
                        👤 {s.name} ({s.email})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 9. Remarkn */}
              <div className="field">
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>
                  Remarkn (Notes, Calling Instructions, or Special Requests)
                </label>
                <textarea
                  className="input"
                  rows={3}
                  placeholder="Enter remarks, specific questions from client, turnaround time expectation..."
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--rule)', background: 'var(--surface)', color: 'var(--ink)', resize: 'vertical' }}
                />
              </div>

              {/* Form Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={onClose}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ background: '#0284c7', borderColor: '#0284c7', color: '#fff', fontWeight: 600, padding: '10px 20px' }}
                >
                  💾 Save Client Request
                </button>
              </div>
            </form>
          ) : (
            <div>
              {/* Filter & Search Bar */}
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '12px',
                marginBottom: '16px',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ flex: '1 1 260px' }}>
                  <input
                    type="text"
                    className="input"
                    placeholder="Search by ID, Insurance, Plan, Assignee, or Remark..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--rule)' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <select
                    className="select-input"
                    value={filterMode}
                    onChange={(e) => setFilterMode(e.target.value)}
                    style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--rule)', fontSize: '13px' }}
                  >
                    <option value="all">All Modes</option>
                    <option value="Teams">Teams</option>
                    <option value="Sheet">Sheet</option>
                    <option value="Email">Email</option>
                  </select>
                  <select
                    className="select-input"
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--rule)', fontSize: '13px' }}
                  >
                    <option value="all">All Statuses</option>
                    <option value="completed">Completed Only</option>
                    <option value="not_completed">Not Completed Only</option>
                  </select>
                </div>
              </div>

              {/* Requests Table */}
              <div className="table-responsive" style={{ maxHeight: '420px', overflowY: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Req ID</th>
                      <th>Mode</th>
                      <th>Client</th>
                      <th>INS Name &amp; Plan</th>
                      <th>INS Phone</th>
                      <th>Assign Too</th>
                      <th>Total</th>
                      <th>Completed</th>
                      <th>Not completed</th>
                      <th>Status</th>
                      <th>Remarkn</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRequests.length === 0 ? (
                      <tr>
                        <td colSpan="12" className="table-empty" style={{ textAlign: 'center', padding: '30px' }}>
                          No client requests match your filter.
                        </td>
                      </tr>
                    ) : (
                      filteredRequests.map(r => {
                        const isDone = r.status === 'Completed';
                        const clientName = CLIENTS.find(c => c.id === r.client)?.name || r.client;

                        return (
                          <tr key={r.id}>
                            <td className="mono bold">{r.id}</td>
                            <td>
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '3px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 600,
                                background: r.mode === 'Teams' ? '#e0f2fe' : r.mode === 'Email' ? '#fef3c7' : '#ecfdf5',
                                color: r.mode === 'Teams' ? '#0369a1' : r.mode === 'Email' ? '#b45309' : '#047857'
                              }}>
                                {r.mode === 'Teams' ? '💬 Teams' : r.mode === 'Email' ? '✉️ Email' : '📊 Sheet'}
                              </span>
                            </td>
                            <td><span style={{ fontWeight: 600 }}>{clientName}</span></td>
                            <td>
                              <div className="bold">{r.insName}</div>
                              {r.planType && <div className="patient-sub-cell">{r.planType}</div>}
                            </td>
                            <td><span className="mono">{r.insPhone || '—'}</span></td>
                            <td>
                              <span className="assignee-tag">{r.assignTo?.split('@')[0]}</span>
                            </td>
                            <td className="mono bold">{r.total}</td>
                            <td className="mono bold" style={{ color: '#059669' }}>{r.completed}</td>
                            <td className="mono bold" style={{ color: '#dc2626' }}>{r.notCompleted}</td>
                            <td>
                              <button
                                type="button"
                                onClick={() => toggleStatus(r.id)}
                                title="Click to toggle Completed / Not completed"
                                style={{
                                  border: 'none',
                                  cursor: 'pointer',
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  background: isDone ? '#dcfce7' : '#fee2e2',
                                  color: isDone ? '#15803d' : '#b91c1c'
                                }}
                              >
                                {isDone ? '✅ Completed' : '⏳ Not completed'}
                              </button>
                            </td>
                            <td style={{ maxWidth: '200px', fontSize: '12px' }} title={r.remark}>
                              {r.remark ? (
                                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {r.remark}
                                </div>
                              ) : <span style={{ color: 'var(--ink-soft)' }}>—</span>}
                            </td>
                            <td>
                              <button
                                type="button"
                                onClick={() => deleteRequest(r.id)}
                                className="table-action-btn"
                                style={{ color: '#ef4444', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '14px' }}
                                title="Delete request"
                              >
                                🗑️
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '12px 24px',
          borderTop: '1px solid var(--rule-soft)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--surface-2)',
          fontSize: '12px',
          color: 'var(--ink-soft)'
        }}>
          <div>
            Tracking <strong>{requests.length}</strong> client requests · <strong>{totalNotCompleted}</strong> pending completion
          </div>
          <button type="button" className="btn btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
