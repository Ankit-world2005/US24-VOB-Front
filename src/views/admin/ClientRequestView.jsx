import React, { useState, useEffect } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { CLIENTS } from '../../data/clients';
import { usersApi } from '../../api/users';
import {
  STORAGE_KEY,
  CLIENT_REQUESTS_SYNC_EVENT,
  DEFAULT_SPECIALISTS,
  INITIAL_REQUESTS,
  isAssignedToUser,
  ensureLogs,
  persistAndSyncClientRequests
} from '../../data/clientRequests';

// Card definitions for the switcher and detail page
const CARD_DEFINITIONS = [
  {
    id: 'all',
    label: '📋 All Records',
    tone: 'tone-neutral',
    meta: 'All incoming client requests across channels',
    getCount: (list) => list.reduce((acc, r) => acc + (Number(r.total) || 1), 0),
    filter: () => true
  },
  {
    id: 'pending',
    label: '⏳ Pending / In Progress',
    tone: 'tone-pending',
    meta: 'Requests awaiting specialist verification and completion',
    getCount: (list) => list.filter(r => r.status !== 'Completed').reduce((acc, r) => acc + (Number(r.notCompleted) || 1), 0),
    filter: (r) => r.status !== 'Completed'
  },
  {
    id: 'completed',
    label: '✅ Completed',
    tone: 'tone-approved',
    meta: 'Finished and verified client intake requests',
    getCount: (list) => list.filter(r => r.status === 'Completed').reduce((acc, r) => acc + (Number(r.completed) || 0), 0),
    filter: (r) => r.status === 'Completed'
  }
];

export function ClientRequestView() {
  const { showToast, setActiveTab, currentUser } = useWorkspace();
  
  // User level & permission detection
  const isAdmin = currentUser?.role === 'admin';
  const isAuditSpecialist =
    currentUser?.role === 'auth' ||
    currentUser?.role === 'auth_specialist' ||
    currentUser?.role === 'audit' ||
    currentUser?.email === 'jitender.s@us24solutions.com' ||
    currentUser?.email === 'ankit.k@us24solutions.com';

  const canAssign = isAdmin || isAuditSpecialist;
  const isSpecialistOnly = !canAssign;
  const userEmail = (currentUser?.email || '').toLowerCase();

  // Admin & Audit Specialist can toggle department vs personal scope.
  // Specialists are strictly locked to their assigned requests.
  const [assigneeScope, setAssigneeScope] = useState(canAssign ? 'all' : 'mine');

  // NEW: Card Detail Page View state
  // null = main dashboard overview; 'all' | 'completed' | 'pending' | 'teams' | 'sheet' | 'email' = dedicated records & logs page
  const [selectedCardView, setSelectedCardView] = useState(null);
  const [selectedRecordId, setSelectedRecordId] = useState(null);
  const [cardSearchQuery, setCardSearchQuery] = useState('');
  const [cardClientFilter, setCardClientFilter] = useState('all');
  const [cardModeFilter, setCardModeFilter] = useState('all');

  // Inline Log / Remark state in Card Detail View
  const [newLogNote, setNewLogNote] = useState('');
  const [newLogStatus, setNewLogStatus] = useState('');

  const [requests, setRequests] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map(r => ({
            ...r,
            assignedBy: r.assignedBy || 'Admin / Audit Specialist',
            logs: ensureLogs(r)
          }));
        }
      }
    } catch (e) {
      console.warn('Failed to parse saved client requests', e);
    }
    return INITIAL_REQUESTS;
  });

  const [specialists, setSpecialists] = useState(DEFAULT_SPECIALISTS);

  // New Request Form State (Admin & Audit Specialist only)
  const [showForm, setShowForm] = useState(false);
  const [mode, setMode] = useState('Teams');
  const [selectedClient, setSelectedClient] = useState('arra');
  const [patientName, setPatientName] = useState('');
  const [insName, setInsName] = useState('');
  const [insPhone, setInsPhone] = useState('');
  const [planType, setPlanType] = useState('');
  const [remark, setRemark] = useState('');
  const [assignTo, setAssignTo] = useState('rohit.k@us24solutions.com');

  // Specialist Remark & Update Modal State
  const [editingRequest, setEditingRequest] = useState(null);
  const [editStatus, setEditStatus] = useState('Not completed');
  const [editRemark, setEditRemark] = useState('');
  const [editAssignTo, setEditAssignTo] = useState('');

  // Main Table Tab & Filters
  const [activeMainTab, setActiveMainTab] = useState('all'); // 'all' | 'pending' | 'in_progress' | 'completed' | 'teams' | 'sheet' | 'email'
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterClient, setFilterClient] = useState('all');

  // Load active specialists from users API & merge with default team roster
  useEffect(() => {
    usersApi.getUsers().then(apiUsers => {
      if (Array.isArray(apiUsers) && apiUsers.length > 0) {
        setSpecialists(prev => {
          const map = new Map();
          DEFAULT_SPECIALISTS.forEach(u => {
            if (u.email) map.set(u.email.toLowerCase(), u);
          });
          apiUsers.filter(u => u.active !== false && u.status !== 'revoked').forEach(u => {
            if (u.email) {
              const lower = u.email.toLowerCase();
              map.set(lower, { ...map.get(lower), ...u });
            }
          });
          return Array.from(map.values());
        });
      }
    }).catch(console.warn);
  }, []);

  // Multi-tab, cross-window, and live role synchronization
  useEffect(() => {
    const handleSync = (e) => {
      try {
        const raw = e?.detail || localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
          if (Array.isArray(parsed)) {
            setRequests(parsed.map(r => ({
              ...r,
              assignedBy: r.assignedBy || 'Admin / Audit Specialist',
              logs: ensureLogs(r)
            })));
          }
        }
      } catch (err) {
        console.warn('Sync error on client requests', err);
      }
    };

    const handleStorageEvent = (e) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        handleSync({ detail: JSON.parse(e.newValue) });
      }
    };

    window.addEventListener('storage', handleStorageEvent);
    window.addEventListener(CLIENT_REQUESTS_SYNC_EVENT, handleSync);

    // Periodic check every 3 seconds to pick up any changes
    const interval = setInterval(() => {
      try {
        const currentSaved = localStorage.getItem(STORAGE_KEY);
        if (currentSaved) {
          const parsed = JSON.parse(currentSaved);
          if (Array.isArray(parsed)) {
            setRequests(prev => {
              if (JSON.stringify(prev) !== currentSaved) {
                return parsed.map(r => ({
                  ...r,
                  assignedBy: r.assignedBy || 'Admin / Audit Specialist',
                  logs: ensureLogs(r)
                }));
              }
              return prev;
            });
          }
        }
      } catch (err) {
        // ignore
      }
    }, 3000);

    return () => {
      window.removeEventListener('storage', handleStorageEvent);
      window.removeEventListener(CLIENT_REQUESTS_SYNC_EVENT, handleSync);
      clearInterval(interval);
    };
  }, []);

  // Scoped requests: Specialists strictly see only their assigned requests
  const scopedRequests = isSpecialistOnly
    ? requests.filter(r => isAssignedToUser(r, currentUser))
    : (assigneeScope === 'mine'
      ? requests.filter(r => isAssignedToUser(r, currentUser))
      : requests);

  const myAssignedCount = requests.filter(r => isAssignedToUser(r, currentUser)).length;

  // Add new request (Admin & Audit Specialist)
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!insName.trim()) {
      showToast('Please enter an Insurance Name (INS NAME).', 'warning');
      return;
    }
    if (!patientName.trim()) {
      showToast('Please enter Patient Name.', 'warning');
      return;
    }

    const nextId = `CR-${1000 + requests.length + 1}`;
    const creatorLabel = currentUser?.name
      ? `${currentUser.name} (${isAdmin ? 'Admin' : 'Audit Specialist'})`
      : (isAdmin ? 'Admin (Saurabh Sharma)' : 'Audit Specialist');

    const createdTime = new Date().toISOString();
    const newEntry = {
      id: nextId,
      mode,
      client: selectedClient,
      patientName: patientName.trim(),
      insName: insName.trim(),
      insPhone: insPhone.trim(),
      planType: planType.trim(),
      remark: remark.trim(),
      assignTo,
      assignedBy: creatorLabel,
      total: 1,
      completed: 0,
      notCompleted: 1,
      status: 'Not completed',
      createdAt: createdTime,
      logs: [
        {
          id: `log-${nextId}-init`,
          type: 'created',
          timestamp: createdTime,
          author: creatorLabel,
          action: 'Request Created & Assigned',
          from: null,
          to: `Assigned to ${assignTo}`,
          note: remark.trim() || `Intake received via ${mode} for patient ${patientName.trim()} (${selectedClient.toUpperCase()}). Insurance: ${insName.trim()}.`
        }
      ]
    };

    const updated = [newEntry, ...requests];
    setRequests(updated);
    persistAndSyncClientRequests(updated);
    showToast(`Client Request ${nextId} created for ${patientName.trim()} and assigned to ${assignTo}!`, 'success');

    // Reset Form
    setPatientName('');
    setInsName('');
    setInsPhone('');
    setPlanType('');
    setRemark('');
    setShowForm(false);
  };

  // Open Remark & Update Modal
  const handleOpenEditModal = (req) => {
    setEditingRequest(req);
    setEditStatus(req.status || 'Not completed');
    setEditRemark(req.remark || '');
    setEditAssignTo(req.assignTo || '');
  };

  // Save Remark & Status Updates (Specialist workflow)
  const handleSaveEditModal = (e) => {
    e.preventDefault();
    if (!editingRequest) return;

    const numTotal = Math.max(1, Number(editingRequest.total) || 1);
    let numCompleted = Number(editingRequest.completed) || 0;
    if (editStatus === 'Completed') {
      numCompleted = numTotal;
    } else if (editStatus === 'Not completed') {
      numCompleted = 0;
    }
    const numNotCompleted = Math.max(0, numTotal - numCompleted);

    const nowIso = new Date().toISOString();
    const authorName = currentUser?.name || currentUser?.email || 'Specialist';
    const isReassigned = canAssign && editAssignTo && editAssignTo !== editingRequest.assignTo;

    const updated = requests.map(req => {
      if (req.id !== editingRequest.id) return req;

      const logs = [...(req.logs || [])];

      if (isReassigned) {
        logs.unshift({
          id: `log-${Date.now()}-reassign`,
          type: 'assignment_change',
          timestamp: nowIso,
          author: authorName,
          action: 'Request Reassigned',
          from: req.assignTo,
          to: editAssignTo,
          note: `Reassigned from ${req.assignTo} to ${editAssignTo} by ${authorName}.`
        });
      }

      const newLog = {
        id: `log-${Date.now()}`,
        type: editStatus !== req.status ? 'status_change' : 'remark',
        timestamp: nowIso,
        author: authorName,
        action: editStatus !== req.status ? `Status Changed: ${req.status} → ${editStatus}` : 'Verification Remark Updated',
        from: req.status !== editStatus ? req.status : undefined,
        to: req.status !== editStatus ? editStatus : undefined,
        note: editRemark.trim() || `Status updated to ${editStatus}.`
      };
      logs.unshift(newLog);

      return {
        ...req,
        status: editStatus,
        total: numTotal,
        completed: numCompleted,
        notCompleted: numNotCompleted,
        remark: editRemark.trim(),
        ...(canAssign && editAssignTo ? { assignTo: editAssignTo } : {}),
        updatedAt: nowIso,
        lastUpdatedBy: authorName,
        logs
      };
    });

    setRequests(updated);
    persistAndSyncClientRequests(updated);

    if (isReassigned) {
      showToast(`Client Request ${editingRequest.id} updated & reassigned to ${editAssignTo}!`, 'success');
    } else {
      showToast(`Client Request ${editingRequest.id} remark & status updated!`, 'success');
    }
    setEditingRequest(null);
  };

  // Append a new log entry directly from the Card Detail page
  const handleAddDirectLog = (record) => {
    if (!newLogNote.trim() && !newLogStatus) {
      showToast('Please enter a note or choose a status to append to the log.', 'warning');
      return;
    }

    const nowIso = new Date().toISOString();
    const authorName = currentUser?.name || currentUser?.email || 'Specialist';
    const targetStatus = newLogStatus || record.status;

    let numCompleted = Number(record.completed) || 0;
    const numTotal = Number(record.total) || 1;
    if (targetStatus === 'Completed') numCompleted = numTotal;
    else if (targetStatus === 'Not completed') numCompleted = 0;
    const numNotCompleted = Math.max(0, numTotal - numCompleted);

    const newLog = {
      id: `log-${Date.now()}`,
      type: newLogStatus && newLogStatus !== record.status ? 'status_change' : 'remark',
      timestamp: nowIso,
      author: authorName,
      action: newLogStatus && newLogStatus !== record.status ? `Status Changed: ${record.status} → ${targetStatus}` : 'Audit Log Note Added',
      from: newLogStatus && newLogStatus !== record.status ? record.status : undefined,
      to: newLogStatus && newLogStatus !== record.status ? targetStatus : undefined,
      note: newLogNote.trim() || `Status updated to ${targetStatus}`
    };

    const updated = requests.map(req => {
      if (req.id !== record.id) return req;
      return {
        ...req,
        status: targetStatus,
        completed: numCompleted,
        notCompleted: numNotCompleted,
        remark: newLogNote.trim() || req.remark,
        updatedAt: nowIso,
        lastUpdatedBy: authorName,
        logs: [newLog, ...(req.logs || [])]
      };
    });

    setRequests(updated);
    persistAndSyncClientRequests(updated);
    showToast(`Audit log added for ${record.id}!`, 'success');
    setNewLogNote('');
    setNewLogStatus('');
  };

  // Quick timestamp stamping for specialist remarks
  const handleInsertTimestamp = () => {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const nameStr = currentUser?.name || 'Specialist';
    const stamp = `[${timeStr} - ${nameStr}]: `;
    setEditRemark(prev => (prev ? `${prev}\n${stamp}` : stamp));
  };

  // Delete request (Admin & Audit Specialist only)
  const deleteRequest = (id) => {
    if (!window.confirm(`Delete client request ${id}?`)) return;
    const updated = requests.filter(r => r.id !== id);
    setRequests(updated);
    persistAndSyncClientRequests(updated);
    if (selectedRecordId === id) setSelectedRecordId(null);
    showToast(`Request ${id} deleted.`, 'info');
  };

  // Quick seed helper for specialist demo testing
  const handleLoadSampleAssigned = () => {
    const targetAssignee = userEmail || currentUser?.name || 'rohit.k@us24solutions.com';
    const demoReqs = [
      {
        id: `CR-${1000 + requests.length + 1}`,
        mode: 'Teams',
        client: 'arra',
        patientName: 'Jane Smith',
        insName: 'UnitedHealthcare (UHC)',
        insPhone: '1-800-842-8178',
        planType: 'Choice Plus PPO',
        remark: 'Assigned by Audit Specialist: Please verify in-network physical therapy benefits and pre-auth requirement.',
        assignTo: targetAssignee,
        assignedBy: 'Audit Specialist (Jitender S)',
        total: 2,
        completed: 0,
        notCompleted: 2,
        status: 'Not completed',
        createdAt: new Date().toISOString(),
        logs: [
          {
            id: `log-demo-1`,
            type: 'created',
            timestamp: new Date().toISOString(),
            author: 'Audit Specialist (Jitender S)',
            action: 'Request Created & Assigned',
            note: 'Assigned by Audit Specialist: Please verify in-network physical therapy benefits and pre-auth requirement.'
          }
        ]
      },
      {
        id: `CR-${1000 + requests.length + 2}`,
        mode: 'Email',
        client: 'sugarland',
        patientName: 'David Miller',
        insName: 'Aetna Healthcare',
        insPhone: '1-800-872-3862',
        planType: 'Managed Choice POS',
        remark: 'Assigned by Admin: Client escalation regarding deductible and copay confirmation.',
        assignTo: targetAssignee,
        assignedBy: 'Admin (Saurabh Sharma)',
        total: 1,
        completed: 0,
        notCompleted: 1,
        status: 'In Progress',
        createdAt: new Date().toISOString(),
        logs: [
          {
            id: `log-demo-2`,
            type: 'created',
            timestamp: new Date().toISOString(),
            author: 'Admin (Saurabh Sharma)',
            action: 'Request Created & Assigned',
            note: 'Assigned by Admin: Client escalation regarding deductible and copay confirmation.'
          }
        ]
      }
    ];
    const updated = [...demoReqs, ...requests];
    setRequests(updated);
    persistAndSyncClientRequests(updated);
    showToast(`2 sample client requests assigned to ${targetAssignee} loaded!`, 'success');
  };

  // Export to CSV
  const handleExportCsv = (customList = scopedRequests) => {
    if (customList.length === 0) {
      showToast('No requests to export.', 'info');
      return;
    }
    const headers = ['Request ID', 'Date', 'Mode', 'Client', 'Patient Name', 'Insurance Name', 'Insurance Phone', 'Plan Type', 'Assigned By', 'Assign To', 'Total', 'Completed', 'Not completed', 'Status', 'Remark', 'Log Count'];
    const rows = customList.map(r => [
      r.id,
      new Date(r.createdAt).toLocaleDateString(),
      r.mode,
      CLIENTS.find(c => c.id === r.client)?.name || r.client,
      `"${(r.patientName || '').replace(/"/g, '""')}"`,
      `"${(r.insName || '').replace(/"/g, '""')}"`,
      r.insPhone || '',
      `"${(r.planType || '').replace(/"/g, '""')}"`,
      `"${(r.assignedBy || 'Admin / Audit Specialist').replace(/"/g, '""')}"`,
      r.assignTo,
      r.total,
      r.completed,
      r.notCompleted,
      r.status,
      `"${(r.remark || '').replace(/"/g, '""')}"`,
      (r.logs || []).length
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Client_Requests_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Client Requests exported to CSV.', 'success');
  };

  // Aggregate Metrics based on scopedRequests
  const totalVolume = scopedRequests.reduce((acc, r) => acc + (Number(r.total) || 1), 0);
  const totalCompleted = scopedRequests.reduce((acc, r) => acc + (Number(r.completed) || 0), 0);
  const totalNotCompleted = scopedRequests.reduce((acc, r) => acc + (Number(r.notCompleted) || 0), 0);
  const completionPct = totalVolume > 0 ? Math.round((totalCompleted / totalVolume) * 100) : 0;
  const inProgressCount = scopedRequests.filter(r => r.status === 'In Progress').length;

  // Breakdown by channel / mode
  const teamsCount = scopedRequests.filter(r => r.mode === 'Teams').reduce((acc, r) => acc + (Number(r.total) || 1), 0);
  const sheetCount = scopedRequests.filter(r => r.mode === 'Sheet').reduce((acc, r) => acc + (Number(r.total) || 1), 0);
  const emailCount = scopedRequests.filter(r => r.mode === 'Email').reduce((acc, r) => acc + (Number(r.total) || 1), 0);

  // Filtered requests for the main table (combining category tab with client filter & search)
  const filteredRequests = scopedRequests.filter(r => {
    // 1. Tab filter
    if (activeMainTab === 'pending' && r.status === 'Completed') return false;
    if (activeMainTab === 'in_progress' && r.status !== 'In Progress') return false;
    if (activeMainTab === 'completed' && r.status !== 'Completed') return false;
    if (activeMainTab === 'teams' && r.mode !== 'Teams') return false;
    if (activeMainTab === 'sheet' && r.mode !== 'Sheet') return false;
    if (activeMainTab === 'email' && r.mode !== 'Email') return false;

    // 2. Dropdown filters (if applied)
    if (filterMode !== 'all' && r.mode !== filterMode) return false;
    if (filterStatus === 'completed' && r.status !== 'Completed') return false;
    if (filterStatus === 'not_completed' && r.status === 'Completed') return false;
    if (filterStatus === 'in_progress' && r.status !== 'In Progress') return false;
    if (filterClient !== 'all' && r.client !== filterClient) return false;

    // 3. Search query
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.id.toLowerCase().includes(q) ||
      (r.patientName || '').toLowerCase().includes(q) ||
      (r.insName || '').toLowerCase().includes(q) ||
      (r.planType || '').toLowerCase().includes(q) ||
      (r.remark || '').toLowerCase().includes(q) ||
      (r.assignedBy || '').toLowerCase().includes(q) ||
      (r.assignTo || '').toLowerCase().includes(q)
    );
  });

  // =========================================================================
  // VIEW MODE B: DEDICATED "CARD DETAIL & AUDIT LOGS" PAGE
  // =========================================================================
  if (selectedCardView) {
    const activeCardDef = CARD_DEFINITIONS.find(c => c.id === selectedCardView) || CARD_DEFINITIONS[0];

    // Filter scoped requests by the active card's criteria
    const cardBaseRecords = scopedRequests.filter(activeCardDef.filter);

    // Apply card-level search and client filters
    const cardFilteredRecords = cardBaseRecords.filter(r => {
      if (cardClientFilter !== 'all' && r.client !== cardClientFilter) return false;
      if (cardModeFilter !== 'all' && r.mode !== cardModeFilter) return false;
      if (!cardSearchQuery) return true;
      const q = cardSearchQuery.toLowerCase();
      return (
        r.id.toLowerCase().includes(q) ||
        (r.patientName || '').toLowerCase().includes(q) ||
        (r.insName || '').toLowerCase().includes(q) ||
        (r.planType || '').toLowerCase().includes(q) ||
        (r.remark || '').toLowerCase().includes(q) ||
        (r.assignedBy || '').toLowerCase().includes(q) ||
        (r.assignTo || '').toLowerCase().includes(q)
      );
    });

    // Auto-select first record if none selected or selection not in current list
    const currentSelected = cardFilteredRecords.find(r => r.id === selectedRecordId) || cardFilteredRecords[0] || null;

    return (
      <div className="card-detail-view" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Navigation Bar */}
        <nav className="card-detail-nav" aria-label="Client Request Cards">
          <button
            type="button"
            className="btn-action-link"
            onClick={() => {
              setSelectedCardView(null);
              setSelectedRecordId(null);
              setCardModeFilter('all');
            }}
          >
            ← Back to Client Requests Dashboard
          </button>

          {/* Switcher Chips */}
          <div className="card-switcher">
            {CARD_DEFINITIONS.map(c => {
              const count = c.getCount(scopedRequests);
              const isActive = selectedCardView === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  className={`card-chip ${c.tone} ${isActive ? 'active' : ''}`}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => {
                    setSelectedCardView(c.id);
                    setSelectedRecordId(null);
                  }}
                >
                  <span className="card-chip-label">{c.label}</span>
                  <span className="card-chip-count">{count}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Card Header & Filter Banner */}
        <section className="panel-card" style={{ marginBottom: 0 }}>
          <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                <span className="badge badge-info" style={{ fontWeight: 600, fontSize: '11px' }}>
                  Card Records &amp; Activity Logs
                </span>
                <span style={{ fontSize: '12px', color: 'var(--ink-soft)' }}>
                  {isSpecialistOnly ? 'Isolated to your assigned requests' : 'Department-wide view'}
                </span>
              </div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
                {activeCardDef.label} ({cardFilteredRecords.length} records)
              </h3>
              <span className="panel-sub">{activeCardDef.meta}</span>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="text"
                className="input"
                placeholder="Search within this card..."
                value={cardSearchQuery}
                onChange={(e) => setCardSearchQuery(e.target.value)}
                style={{ padding: '7px 12px', fontSize: '13px', borderRadius: '6px', width: '200px' }}
              />

              <select
                className="select-input"
                value={cardModeFilter}
                onChange={(e) => setCardModeFilter(e.target.value)}
                style={{ padding: '7px 10px', fontSize: '13px', borderRadius: '6px' }}
              >
                <option value="all">All Modes</option>
                <option value="Teams">💬 Teams</option>
                <option value="Sheet">📊 Sheet</option>
                <option value="Email">✉️ Email</option>
              </select>

              <select
                className="select-input"
                value={cardClientFilter}
                onChange={(e) => setCardClientFilter(e.target.value)}
                style={{ padding: '7px 10px', fontSize: '13px', borderRadius: '6px' }}
              >
                <option value="all">All Clients</option>
                {CLIENTS.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

              <button
                type="button"
                className="btn btn-sm"
                onClick={() => handleExportCsv(cardFilteredRecords)}
              >
                📥 Export CSV
              </button>
            </div>
          </div>
        </section>

        {/* Master-Detail Two-Column Grid: Left = Records List, Right = Logs & Inspector */}
        <div className="card-detail-grid">
          {/* Left Column: Records Table */}
          <section className="panel-card card-detail-list">
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Req ID</th>
                    <th>Mode</th>
                    <th>Client</th>
                    <th>Patient</th>
                    <th>Insurance &amp; Plan</th>
                    {canAssign ? <th>Assignee</th> : <th>Assigned By</th>}
                    <th>Status</th>
                    <th>Logs</th>
                  </tr>
                </thead>
                <tbody>
                  {cardFilteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="table-empty" style={{ textAlign: 'center', padding: '36px' }}>
                        No client requests found in this card view.
                      </td>
                    </tr>
                  ) : (
                    cardFilteredRecords.map(r => {
                      const isSelected = currentSelected?.id === r.id;
                      const isDone = r.status === 'Completed';
                      const isInProgress = r.status === 'In Progress';
                      const logCount = (r.logs || []).length;

                      return (
                        <tr
                          key={r.id}
                          className={`interactive-row ${isSelected ? 'row-selected' : ''}`}
                          onClick={() => setSelectedRecordId(r.id)}
                          style={{
                            cursor: 'pointer',
                            background: isSelected ? 'rgba(2, 132, 199, 0.08)' : undefined
                          }}
                        >
                          <td className="mono bold">{r.id}</td>
                          <td>
                            <span style={{
                              display: 'inline-flex',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 600,
                              background: r.mode === 'Teams' ? '#e0f2fe' : r.mode === 'Email' ? '#fef3c7' : '#ecfdf5',
                              color: r.mode === 'Teams' ? '#0369a1' : r.mode === 'Email' ? '#b45309' : '#047857'
                            }}>
                              {r.mode === 'Teams' ? '💬 Teams' : r.mode === 'Email' ? '✉️ Email' : '📊 Sheet'}
                            </span>
                          </td>
                          <td style={{ fontWeight: 600, fontSize: '12px' }}>
                            {CLIENTS.find(c => c.id === r.client)?.name || r.client}
                          </td>
                          <td style={{ fontWeight: 600, fontSize: '12px', color: 'var(--ink)' }}>
                            {r.patientName || '—'}
                          </td>
                          <td>
                            <div style={{ fontWeight: 600, fontSize: '12px' }}>{r.insName}</div>
                            {r.planType && <div style={{ fontSize: '11px', color: 'var(--ink-soft)' }}>{r.planType}</div>}
                          </td>
                          <td style={{ fontSize: '12px' }}>
                            {canAssign ? (
                              <span className="assignee-tag">{r.assignTo?.split('@')[0]}</span>
                            ) : (
                              <span style={{ color: '#6366f1', fontWeight: 600 }}>{r.assignedBy || 'Admin'}</span>
                            )}
                          </td>
                          <td>
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 600,
                              background: isDone ? '#dcfce7' : isInProgress ? '#e0f2fe' : '#fee2e2',
                              color: isDone ? '#15803d' : isInProgress ? '#0369a1' : '#b91c1c'
                            }}>
                              {isDone ? '✅ Done' : isInProgress ? '🔄 Active' : '⏳ Pending'}
                            </span>
                          </td>
                          <td>
                            <span style={{
                              fontSize: '11px',
                              fontWeight: 600,
                              color: logCount > 0 ? '#0284c7' : 'var(--ink-soft)',
                              background: 'var(--surface-2)',
                              padding: '2px 6px',
                              borderRadius: '4px'
                            }}>
                              📜 {logCount}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Right Column: Selected Record Inspector & Activity Logs Timeline */}
          <aside className="panel-card card-detail-task" style={{ padding: '18px 20px' }}>
            {currentSelected ? (
              <div className="task-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Header */}
                <div className="task-panel-head" style={{ borderBottom: '1px solid var(--rule-soft)', paddingBottom: '12px' }}>
                  <div>
                    <div className="task-panel-eyebrow" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--ink-soft)' }}>
                      <span>Client Request #{currentSelected.id}</span>
                      <span>·</span>
                      <span>Received via <strong>{currentSelected.mode}</strong></span>
                    </div>
                    <h3 style={{ margin: '4px 0', fontSize: '18px', fontWeight: 700, color: 'var(--ink)' }}>
                      {currentSelected.insName}
                    </h3>
                    <div style={{ fontSize: '13px', color: 'var(--ink-soft)', display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '2px' }}>
                      <span>Client: <strong>{CLIENTS.find(c => c.id === currentSelected.client)?.name || currentSelected.client}</strong></span>
                      {currentSelected.patientName && (
                        <span>· Patient: <strong style={{ color: 'var(--ink)' }}>{currentSelected.patientName}</strong></span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 700,
                      background: currentSelected.status === 'Completed' ? '#dcfce7' : currentSelected.status === 'In Progress' ? '#e0f2fe' : '#fee2e2',
                      color: currentSelected.status === 'Completed' ? '#15803d' : currentSelected.status === 'In Progress' ? '#0369a1' : '#b91c1c'
                    }}>
                      {currentSelected.status}
                    </span>
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={() => handleOpenEditModal(currentSelected)}
                      style={{ fontSize: '12px', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      ✏️ Remark &amp; Update
                    </button>
                  </div>
                </div>

                {/* Facts Grid */}
                <dl className="task-facts" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px', margin: 0 }}>
                  <div>
                    <dt style={{ fontSize: '10.5px', textTransform: 'uppercase', color: 'var(--ink-soft)', fontWeight: 600 }}>Patient Name</dt>
                    <dd style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>👤 {currentSelected.patientName || '—'}</dd>
                  </div>

                  <div>
                    <dt style={{ fontSize: '10.5px', textTransform: 'uppercase', color: 'var(--ink-soft)', fontWeight: 600 }}>Carrier Phone</dt>
                    <dd style={{ fontSize: '13px', fontWeight: 600, fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {currentSelected.insPhone || '—'}
                      {currentSelected.insPhone && (
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(currentSelected.insPhone);
                            showToast('Phone copied!', 'info');
                          }}
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '11px' }}
                          title="Copy phone"
                        >
                          📋
                        </button>
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt style={{ fontSize: '10.5px', textTransform: 'uppercase', color: 'var(--ink-soft)', fontWeight: 600 }}>Plan Type</dt>
                    <dd style={{ fontSize: '13px', fontWeight: 600 }}>{currentSelected.planType || 'Standard Plan'}</dd>
                  </div>

                  <div>
                    <dt style={{ fontSize: '10.5px', textTransform: 'uppercase', color: 'var(--ink-soft)', fontWeight: 600 }}>Assigned To</dt>
                    <dd style={{ fontSize: '13px', fontWeight: 600 }}>👤 {currentSelected.assignTo?.split('@')[0] || 'Specialist'}</dd>
                  </div>

                  <div>
                    <dt style={{ fontSize: '10.5px', textTransform: 'uppercase', color: 'var(--ink-soft)', fontWeight: 600 }}>Assigned By</dt>
                    <dd style={{ fontSize: '13px', fontWeight: 600, color: '#6366f1' }}>{currentSelected.assignedBy || 'Admin'}</dd>
                  </div>

                  <div>
                    <dt style={{ fontSize: '10.5px', textTransform: 'uppercase', color: 'var(--ink-soft)', fontWeight: 600 }}>Date Received</dt>
                    <dd style={{ fontSize: '12px' }}>{new Date(currentSelected.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</dd>
                  </div>
                </dl>

                {/* Current Remark Callout */}
                {currentSelected.remark && (
                  <div style={{
                    padding: '10px 12px',
                    borderRadius: '6px',
                    background: 'var(--surface-2)',
                    borderLeft: '3px solid #0284c7',
                    fontSize: '12.5px',
                    color: 'var(--ink)'
                  }}>
                    <strong style={{ display: 'block', fontSize: '11px', color: '#0284c7', marginBottom: '2px', textTransform: 'uppercase' }}>
                      Latest Specialist Remark
                    </strong>
                    {currentSelected.remark}
                  </div>
                )}

                {/* Activity & Audit Logs Timeline Section */}
                <div className="task-log-section" style={{ borderTop: '1px solid var(--rule-soft)', paddingTop: '14px' }}>
                  <div className="task-log-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>📜</span> Activity &amp; Audit Logs ({(currentSelected.logs || []).length})
                    </h4>
                    <span style={{ fontSize: '11px', color: 'var(--ink-soft)' }}>
                      Chronological history
                    </span>
                  </div>

                  {/* Logs Timeline */}
                  <ol className="task-log" style={{ listStyle: 'none', padding: 0, margin: 0, position: 'relative' }}>
                    {(currentSelected.logs || []).length === 0 ? (
                      <li className="task-log-empty" style={{ fontSize: '12px', color: 'var(--ink-soft)', padding: '10px 0' }}>
                        No audit logs recorded for this request yet.
                      </li>
                    ) : (
                      currentSelected.logs.map((log) => {
                        const isCreated = log.type === 'created';
                        const isStatus = log.type === 'status_change';
                        const isRemark = log.type === 'remark';

                        const dotColor = isCreated ? '#0284c7' : isStatus ? '#10b981' : isRemark ? '#6366f1' : '#f59e0b';

                        return (
                          <li
                            key={log.id}
                            style={{
                              position: 'relative',
                              paddingLeft: '22px',
                              paddingBottom: '16px',
                              borderLeft: '2px solid var(--rule-soft)',
                              marginLeft: '6px'
                            }}
                          >
                            {/* Dot */}
                            <span
                              style={{
                                position: 'absolute',
                                left: '-6px',
                                top: '2px',
                                width: '10px',
                                height: '10px',
                                borderRadius: '50%',
                                backgroundColor: dotColor,
                                boxShadow: `0 0 0 2px var(--surface)`
                              }}
                              aria-hidden="true"
                            />

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
                                <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--ink)' }}>
                                  {log.action}
                                </span>
                                <time
                                  style={{ fontSize: '11px', color: 'var(--ink-soft)', whiteSpace: 'nowrap' }}
                                  title={new Date(log.timestamp).toLocaleString()}
                                >
                                  {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </time>
                              </div>

                              {/* From -> To indicator */}
                              {(log.from || log.to) && (
                                <div style={{ fontSize: '11.5px', color: 'var(--ink-soft)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  {log.from && <span style={{ textDecoration: 'line-through', opacity: 0.7 }}>{log.from}</span>}
                                  {log.from && <span>→</span>}
                                  {log.to && <span style={{ fontWeight: 600, color: '#059669' }}>{log.to}</span>}
                                </div>
                              )}

                              {/* Note / Details */}
                              {log.note && (
                                <div style={{
                                  fontSize: '12px',
                                  color: 'var(--ink)',
                                  background: 'var(--surface-2)',
                                  padding: '6px 10px',
                                  borderRadius: '5px',
                                  marginTop: '2px',
                                  lineHeight: 1.4
                                }}>
                                  {log.note}
                                </div>
                              )}

                              {/* Author and Date */}
                              <div style={{ fontSize: '11px', color: 'var(--ink-soft)', marginTop: '2px' }}>
                                by <strong>{log.author}</strong> · {new Date(log.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                              </div>
                            </div>
                          </li>
                        );
                      })
                    )}
                  </ol>

                  {/* Inline Form to Append Log Entry Directly */}
                  <div style={{
                    marginTop: '14px',
                    padding: '12px',
                    borderRadius: '8px',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--rule)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink)' }}>
                      ➕ Add Log / Verification Update
                    </span>

                    <textarea
                      className="input"
                      rows={2}
                      placeholder="Add a remark, call update, or reference number to append to this request's log..."
                      value={newLogNote}
                      onChange={(e) => setNewLogNote(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', fontSize: '12px', resize: 'vertical' }}
                    />

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <select
                        className="select-input"
                        value={newLogStatus}
                        onChange={(e) => setNewLogStatus(e.target.value)}
                        style={{ padding: '6px 8px', fontSize: '12px', borderRadius: '5px' }}
                      >
                        <option value="">Keep status ({currentSelected.status})</option>
                        <option value="Not completed">Change to ⏳ Not completed</option>
                        <option value="In Progress">Change to 🔄 In Progress</option>
                        <option value="Completed">Change to ✅ Completed</option>
                      </select>

                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={() => handleAddDirectLog(currentSelected)}
                        style={{ fontSize: '12px', padding: '6px 14px', fontWeight: 600 }}
                      >
                        Append Log
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="task-log-empty" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--ink-soft)' }}>
                Select a client request on the left to inspect its details and view full audit logs.
              </div>
            )}
          </aside>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW MODE A: MAIN CLIENT REQUESTS DASHBOARD
  // =========================================================================
  return (
    <div className="client-request-dashboard-view" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Dashboard Top Heading Banner */}
      <section className="dashboard-section" style={{ marginBottom: 0 }}>
        <div className="section-title-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span className="badge badge-info" style={{ fontWeight: 600, fontSize: '11px', textTransform: 'uppercase' }}>
                Operational Intake
              </span>
              <span style={{ fontSize: '12px', color: 'var(--ink-soft)' }}>
                {canAssign ? 'Audit & Admin Workflow · Client Coordination' : 'Specialist Assigned Queue · Minimum Necessary Access'}
              </span>
            </div>
            
            <h2 className="dashboard-heading" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span>📨</span> {isSpecialistOnly || assigneeScope === 'mine' ? 'My Assigned Client Requests' : 'Client Requests Dashboard'}
            </h2>
            
            <p className="dashboard-sub" style={{ margin: '4px 0 0' }}>
              {isSpecialistOnly
                ? `Direct intake verification requests assigned to you by Audit Specialist and Admin. Click on any card below to open all records with logs.`
                : (assigneeScope === 'mine'
                  ? `Direct intake verification requests assigned to you (${userEmail}). Click on any card to view records & logs.`
                  : 'Real-time intake tracking and queue performance across Teams channels, Spreadsheets, and Direct Client Emails. Click any card to inspect records & logs.')}
            </p>

            {/* Scope Filter Switcher - Only Admin & Audit Specialists can switch scopes */}
            {canAssign ? (
              <div style={{ marginTop: '12px' }}>
                <div className="segmented-scope-control" role="tablist" aria-label="Request Scope">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={assigneeScope === 'all'}
                    className={`segmented-tab-btn ${assigneeScope === 'all' ? 'active' : ''}`}
                    onClick={() => setAssigneeScope('all')}
                  >
                    <span>🌐 All Department Requests</span>
                    <span className="tab-badge">{requests.length}</span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={assigneeScope === 'mine'}
                    className={`segmented-tab-btn ${assigneeScope === 'mine' ? 'active' : ''}`}
                    onClick={() => setAssigneeScope('mine')}
                  >
                    <span>👤 Assigned to Me</span>
                    <span className="tab-badge">{myAssignedCount}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="badge badge-info" style={{ fontWeight: 600, fontSize: '11px', padding: '3px 8px' }}>
                  👤 Strictly Isolated to Your Assigned Requests ({myAssignedCount})
                </span>
                <span style={{ fontSize: '12px', color: 'var(--ink-soft)' }}>
                  Assigned by Audit Specialist &amp; Admin
                </span>
              </div>
            )}
          </div>

          <div className="quick-actions-row" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-sm ghost"
              onClick={() => setActiveTab(isAdmin ? 'dashboard' : 'my_dashboard')}
              style={{ fontWeight: 500 }}
            >
              ← {isAdmin ? 'Operational Metrics' : 'My Dashboard'}
            </button>
            
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => handleExportCsv()}
              title="Download client requests as CSV"
            >
              📥 Export CSV
            </button>

            {/* New Request Button - ONLY visible to Admin & Audit Specialist */}
            {canAssign && (
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => setShowForm(!showForm)}
                style={{
                  background: showForm ? 'var(--rule)' : 'linear-gradient(135deg, #0284c7, #0369a1)',
                  color: showForm ? 'var(--ink)' : '#fff',
                  borderColor: showForm ? 'var(--rule)' : '#0284c7',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {showForm ? '✕ Close Form' : '+ New Client Request'}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* KPI Stats Grid - EACH CARD OPENS THE NEW RECORDS & LOGS PAGE */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '14px'
      }}>
        {/* Card 1: Total Volume -> Opens 'all' records with logs */}
        <div
          className="kpi-card"
          onClick={() => setSelectedCardView('all')}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--rule)',
            borderRadius: '10px',
            padding: '16px',
            cursor: 'pointer',
            transition: 'all .2s ease',
            position: 'relative'
          }}
          title="Click to view all records in a new page with logs"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--ink-soft)', fontWeight: 600, letterSpacing: '0.04em' }}>
              {isSpecialistOnly ? 'My Total Requests' : 'Total Volume / Units'}
            </span>
            <span style={{ fontSize: '20px' }}>📋</span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--ink)', margin: '6px 0 2px' }}>
            {totalVolume}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--ink-soft)' }}>
            Across <strong>{scopedRequests.length}</strong> assigned requests
          </div>
          <div style={{ marginTop: '8px', fontSize: '11px', fontWeight: 600, color: '#0284c7', display: 'flex', alignItems: 'center', gap: '4px' }}>
            View records &amp; logs →
          </div>
        </div>

        {/* Card 2: Completed -> Opens 'completed' records with logs */}
        <div
          className="kpi-card"
          onClick={() => setSelectedCardView('completed')}
          style={{
            background: 'var(--surface)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '10px',
            padding: '16px',
            cursor: 'pointer',
            transition: 'all .2s ease'
          }}
          title="Click to view all completed records in a new page with logs"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#059669', fontWeight: 600, letterSpacing: '0.04em' }}>
              Completed Units
            </span>
            <span style={{ fontSize: '20px' }}>✅</span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#059669', margin: '6px 0 2px' }}>
            {totalCompleted}
          </div>
          <div style={{ fontSize: '12px', color: '#059669', fontWeight: 500 }}>
            {completionPct}% completion rate
          </div>
          <div style={{ marginTop: '8px', fontSize: '11px', fontWeight: 600, color: '#059669', display: 'flex', alignItems: 'center', gap: '4px' }}>
            View completed records &amp; logs →
          </div>
        </div>

        {/* Card 3: Pending -> Opens 'pending' records with logs */}
        <div
          className="kpi-card"
          onClick={() => setSelectedCardView('pending')}
          style={{
            background: 'var(--surface)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '10px',
            padding: '16px',
            cursor: 'pointer',
            transition: 'all .2s ease'
          }}
          title="Click to view all pending requests in a new page with logs"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#dc2626', fontWeight: 600, letterSpacing: '0.04em' }}>
              Pending / In Progress
            </span>
            <span style={{ fontSize: '20px' }}>⏳</span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#dc2626', margin: '6px 0 2px' }}>
            {totalNotCompleted}
          </div>
          <div style={{ fontSize: '12px', color: '#dc2626' }}>
            {isSpecialistOnly ? 'Awaiting your verification & remark' : 'Awaiting specialist verification'}
          </div>
          <div style={{ marginTop: '8px', fontSize: '11px', fontWeight: 600, color: '#dc2626', display: 'flex', alignItems: 'center', gap: '4px' }}>
            View pending records &amp; logs →
          </div>
        </div>
      </div>

      {/* Collapsible New Request Form Panel (Admin & Audit Specialist Only) */}
      {canAssign && showForm && (
        <section className="panel-card" style={{ border: '2px solid var(--primary, #0284c7)', animation: 'rise .3s ease' }}>
          <div className="panel-header" style={{ borderBottom: '1px solid var(--rule-soft)' }}>
            <div>
              <h3 style={{ margin: 0 }}>Add &amp; Assign New Client Request</h3>
              <span className="panel-sub">Enter client request details received via Teams, Sheet, or Email and assign to a specialist</span>
            </div>
            <button type="button" className="drawer-close-btn" onClick={() => setShowForm(false)} aria-label="Close form">
              &times;
            </button>
          </div>

          <form onSubmit={handleSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="client-request-form-grid">
              {/* Row 1, Col 1: Mode Dropdown */}
              <div className="field">
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--ink)' }}>
                  Mode (Channel) *
                </label>
                <select
                  className="select-input"
                  value={mode}
                  onChange={(e) => setMode(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--rule)', background: 'var(--surface)', color: 'var(--ink)' }}
                >
                  <option value="Teams">💬 Teams (Microsoft Teams Channel/Chat)</option>
                  <option value="Sheet">📊 Sheet (Spreadsheet / Tracker)</option>
                  <option value="Email">✉️ Email (Client Direct Message)</option>
                </select>
              </div>

              {/* Row 1, Col 2: Client Organization */}
              <div className="field">
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--ink)' }}>
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

              {/* Row 1, Col 3: Patient Name */}
              <div className="field">
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--ink)' }}>
                  Patient Name *
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. John Doe or Sarah Connor"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--rule)', background: 'var(--surface)', color: 'var(--ink)' }}
                  required
                />
              </div>

              {/* Row 1, Col 4: Assign To */}
              <div className="field">
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--ink)' }}>
                  Assign To (Specialist) *
                </label>
                <select
                  className="select-input"
                  value={assignTo}
                  onChange={(e) => setAssignTo(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--rule)', background: 'var(--surface)', color: 'var(--ink)' }}
                >
                  {specialists.map(s => (
                    <option key={s.email} value={s.email}>
                      👤 {s.name} ({s.email}) {s.role === 'admin' ? '[Admin]' : s.role === 'auth' ? '[Audit Specialist]' : '[Specialist]'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Row 2, Col 1-2: INS NAME (Spans 2 columns) */}
              <div className="field col-span-2">
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--ink)' }}>
                  INS NAME (Insurance Carrier / Payer) *
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

              {/* Row 2, Col 3: INS PHONE NO */}
              <div className="field">
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--ink)' }}>
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

              {/* Row 2, Col 4: PLAN TYPE */}
              <div className="field">
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--ink)' }}>
                  PLAN TYPE
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Choice Plus PPO, HMO, Commercial, Medicare Advantage..."
                  value={planType}
                  onChange={(e) => setPlanType(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--rule)', background: 'var(--surface)', color: 'var(--ink)' }}
                />
              </div>

              {/* Row 3, Col 1-4: Remarks (Spans all 4 columns) */}
              <div className="field col-span-4">
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--ink)' }}>
                  Remarks (Special Notes, Client Instructions, Escalation Info)
                </label>
                <textarea
                  className="input"
                  rows={3}
                  placeholder="Enter client remarks, instructions from Teams message, expected turnaround time..."
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--rule)', background: 'var(--surface)', color: 'var(--ink)', resize: 'vertical' }}
                />
              </div>
            </div>

            {/* Form Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ background: '#0284c7', borderColor: '#0284c7', color: '#fff', fontWeight: 600, padding: '10px 22px' }}
              >
                💾 Save &amp; Assign Request
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Two-Column Middle Analytics Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
        {/* Channel Distribution */}
        <div className="panel-card">
          <div className="panel-header">
            <h3>{isSpecialistOnly || assigneeScope === 'mine' ? 'My Volume by Intake Mode' : 'Volume by Intake Mode'}</h3>
            <span className="panel-sub">{totalVolume} total units across all 3 modes</span>
          </div>
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Teams */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                <span style={{ fontWeight: 600, color: '#0369a1' }}>💬 Teams Channel</span>
                <span style={{ fontWeight: 600 }}>{teamsCount} units ({totalVolume > 0 ? Math.round((teamsCount / totalVolume) * 100) : 0}%)</span>
              </div>
              <div style={{ height: '8px', background: 'var(--surface-2)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${totalVolume > 0 ? (teamsCount / totalVolume) * 100 : 0}%`, background: '#0ea5e9' }} />
              </div>
            </div>

            {/* Sheets */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                <span style={{ fontWeight: 600, color: '#047857' }}>📊 Spreadsheets / Trackers</span>
                <span style={{ fontWeight: 600 }}>{sheetCount} units ({totalVolume > 0 ? Math.round((sheetCount / totalVolume) * 100) : 0}%)</span>
              </div>
              <div style={{ height: '8px', background: 'var(--surface-2)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${totalVolume > 0 ? (sheetCount / totalVolume) * 100 : 0}%`, background: '#10b981' }} />
              </div>
            </div>

            {/* Email */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                <span style={{ fontWeight: 600, color: '#b45309' }}>✉️ Client Direct Email</span>
                <span style={{ fontWeight: 600 }}>{emailCount} units ({totalVolume > 0 ? Math.round((emailCount / totalVolume) * 100) : 0}%)</span>
              </div>
              <div style={{ height: '8px', background: 'var(--surface-2)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${totalVolume > 0 ? (emailCount / totalVolume) * 100 : 0}%`, background: '#f59e0b' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Right Card: Specialist Personal Overview OR Team Request Allocation (Admin/Audit) */}
        {isSpecialistOnly || assigneeScope === 'mine' ? (
          <div className="panel-card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="panel-header">
              <div>
                <h3>My Resolution Velocity &amp; Overview</h3>
                <span className="panel-sub">Performance metrics for {currentUser?.name || userEmail}</span>
              </div>
            </div>
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px', height: '100%', justifyContent: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: 'var(--ink-soft)' }}>Assigned Specialist:</span>
                <span style={{ fontWeight: 600, fontSize: '13px' }}>👤 {currentUser?.name || 'Specialist'} ({userEmail})</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: 'var(--ink-soft)' }}>Overall Completion Rate:</span>
                <span style={{ fontWeight: 700, fontSize: '14px', color: '#059669' }}>{completionPct}% ({totalCompleted} / {totalVolume} units)</span>
              </div>
              <div style={{ height: '8px', background: 'var(--surface-2)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${completionPct}%`, background: '#10b981' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--ink-soft)' }}>
                <span>Completed: <strong style={{ color: '#059669' }}>{totalCompleted}</strong></span>
                <span>Pending Verification: <strong style={{ color: '#dc2626' }}>{totalNotCompleted}</strong></span>
              </div>
            </div>
          </div>
        ) : (
          <div className="panel-card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="panel-header">
              <div>
                <h3>Specialist Request Allocation</h3>
                <span className="panel-sub">Volume and resolution distribution across team</span>
              </div>
            </div>
            <div style={{ padding: '0 16px 8px', maxHeight: '210px', overflowY: 'auto' }}>
              <table className="data-table" style={{ fontSize: '13px', width: '100%' }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1, boxShadow: '0 1px 0 var(--rule)' }}>
                  <tr>
                    <th>Specialist</th>
                    <th>Assigned</th>
                    <th>Completed</th>
                    <th>Pending</th>
                  </tr>
                </thead>
                <tbody>
                  {specialists.map(s => {
                    const specReqs = requests.filter(r => isAssignedToUser(r, s));
                    const assigned = specReqs.reduce((acc, r) => acc + (Number(r.total) || 1), 0);
                    const done = specReqs.reduce((acc, r) => acc + (Number(r.completed) || 0), 0);
                    const pending = specReqs.reduce((acc, r) => acc + (Number(r.notCompleted) || 0), 0);

                    return (
                      <tr key={s.email}>
                        <td>
                          <span style={{ fontWeight: 600 }}>{s.name}</span>
                          <div style={{ fontSize: '11px', color: 'var(--ink-soft)' }}>{s.email.split('@')[0]}</div>
                        </td>
                        <td className="mono bold">{assigned}</td>
                        <td className="mono bold" style={{ color: '#059669' }}>{done}</td>
                        <td className="mono bold" style={{ color: pending > 0 ? '#dc2626' : 'var(--ink-soft)' }}>{pending}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Main Client Requests Table */}
      <section className="panel-card">
        <div className="panel-header">
          <div>
            <h3>{isSpecialistOnly ? 'My Assigned Client Requests' : 'Client Requests Queue & Tracking'}</h3>
            <span className="panel-sub">
              {isSpecialistOnly
                ? 'Review client intake details, add your verification remarks, and update status'
                : 'Active incoming verification requests · Click Remark & Update to view details or modify status'}
            </span>
          </div>
        </div>

        {/* Client Request Category Tabs */}
        <div className="client-request-tabs-wrapper">
          <div className="client-request-tabs" role="tablist" aria-label="Client Request Category Filters">
            {[
              { id: 'all', label: '📋 All Requests', count: totalVolume },
              { id: 'pending', label: '⏳ Pending', count: totalNotCompleted },
              { id: 'in_progress', label: '🔄 In Progress', count: inProgressCount },
              { id: 'completed', label: '✅ Completed', count: totalCompleted }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeMainTab === tab.id}
                className={`client-request-tab ${activeMainTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveMainTab(tab.id)}
              >
                <span>{tab.label}</span>
                <span className="tab-count">{tab.count}</span>
              </button>
            ))}
          </div>

          {activeMainTab !== 'all' && (
            <button
              type="button"
              className="btn btn-sm ghost"
              onClick={() => setActiveMainTab('all')}
              style={{ fontSize: '12px', padding: '4px 8px', whiteSpace: 'nowrap' }}
            >
              Reset Tab Filter
            </button>
          )}
        </div>

        {/* Filter and Search Bar */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '12px 20px',
          background: 'var(--surface-2)',
          borderBottom: '1px solid var(--rule)',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ flex: '1 1 260px' }}>
            <input
              type="text"
              className="input"
              placeholder="Search by ID, Insurance, Plan, Remarks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--rule)' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <select
              className="select-input"
              value={filterClient}
              onChange={(e) => setFilterClient(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--rule)', fontSize: '13px' }}
            >
              <option value="all">All Clients ({CLIENTS.length})</option>
              {CLIENTS.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            {(searchQuery || filterClient !== 'all' || activeMainTab !== 'all') && (
              <button
                type="button"
                className="btn btn-sm ghost"
                onClick={() => {
                  setSearchQuery('');
                  setFilterClient('all');
                  setActiveMainTab('all');
                }}
                style={{ fontSize: '12px' }}
              >
                ✕ Clear All
              </button>
            )}
          </div>
        </div>

        {/* Requests Table */}
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Req ID</th>
                <th>Mode</th>
                <th>Client</th>
                <th>Patient Name</th>
                <th>Insurance Carrier &amp; Plan</th>
                <th>INS Phone</th>
                {canAssign ? <th>Assign To</th> : <th>Assigned By</th>}
                <th>Status</th>
                <th>Remarks</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan="10" className="table-empty" style={{ textAlign: 'center', padding: '48px 20px' }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>📭</div>
                    <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--ink)' }}>
                      {isSpecialistOnly
                        ? 'No Client Requests Currently Assigned to You'
                        : 'No client requests match your search and filters'}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--ink-soft)', maxWidth: '480px', margin: '6px auto 14px' }}>
                      {isSpecialistOnly
                        ? 'Direct intake received via Teams, Spreadsheets, or Emails and assigned to you by Audit Specialist or Admin will appear here. After seeing the request you will remark the details and update it.'
                        : 'New client requests submitted from Teams channels, client spreadsheets, or emails will be displayed here.'}
                    </div>
                    {isSpecialistOnly && (
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={handleLoadSampleAssigned}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      >
                        ✨ Load Sample Assigned Requests for My Account
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredRequests.map(r => {
                  const isDone = r.status === 'Completed';
                  const isInProgress = r.status === 'In Progress';
                  const clientObj = CLIENTS.find(c => c.id === r.client);
                  const clientName = clientObj?.name || r.client;

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
                        <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{r.patientName || '—'}</div>
                      </td>
                      <td>
                        <div className="bold">{r.insName}</div>
                        {r.planType && <div className="patient-sub-cell">{r.planType}</div>}
                      </td>
                      <td><span className="mono">{r.insPhone || '—'}</span></td>
                      <td>
                        {canAssign ? (
                          <span className="assignee-tag">{r.assignTo?.split('@')[0]}</span>
                        ) : (
                          <span style={{ fontSize: '11px', fontWeight: 600, color: '#6366f1' }}>
                            👤 {r.assignedBy || 'Audit Specialist / Admin'}
                          </span>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(r)}
                          title="Click to view details and update status"
                          style={{
                            border: 'none',
                            cursor: 'pointer',
                            padding: '4px 10px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 600,
                            background: isDone ? '#dcfce7' : isInProgress ? '#e0f2fe' : '#fee2e2',
                            color: isDone ? '#15803d' : isInProgress ? '#0369a1' : '#b91c1c',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          {isDone ? '✅ Completed' : isInProgress ? '🔄 In Progress' : '⏳ Not completed'}
                        </button>
                      </td>
                      <td style={{ maxWidth: '220px', fontSize: '12px' }} title={r.remark}>
                        {r.remark ? (
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {r.remark}
                          </div>
                        ) : <span style={{ color: 'var(--ink-soft)' }}>—</span>}
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            onClick={() => handleOpenEditModal(r)}
                            title="See request details, remark the findings, and update status"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '12px',
                              padding: '5px 10px',
                              fontWeight: 600,
                              background: '#0284c7',
                              borderColor: '#0284c7',
                              color: '#fff',
                              borderRadius: '5px'
                            }}
                          >
                            ✏️ Remark &amp; Update
                          </button>

                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => {
                              setSelectedCardView('all');
                              setSelectedRecordId(r.id);
                            }}
                            title="View all records and chronological activity logs in card detail page"
                            style={{
                              fontSize: '11px',
                              padding: '5px 8px',
                              fontWeight: 600,
                              background: 'var(--surface-2)',
                              border: '1px solid var(--rule)',
                              borderRadius: '5px'
                            }}
                          >
                            📜 Logs
                          </button>

                          {canAssign && (
                            <button
                              type="button"
                              onClick={() => deleteRequest(r.id)}
                              className="table-action-btn"
                              style={{ color: '#ef4444', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '14px', padding: '4px' }}
                              title="Delete request"
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Specialist "Remark & Update Client Request" Modal */}
      {editingRequest && (
        <div className="modal-overlay" onClick={() => setEditingRequest(null)} style={{ zIndex: 1200 }}>
          <div
            className="modal-container"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '720px', width: '92%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
          >
            {/* Modal Header */}
            <div className="modal-header" style={{ padding: '16px 22px', borderBottom: '1px solid var(--rule)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 700,
                  background: editingRequest.mode === 'Teams' ? '#e0f2fe' : editingRequest.mode === 'Email' ? '#fef3c7' : '#ecfdf5',
                  color: editingRequest.mode === 'Teams' ? '#0369a1' : editingRequest.mode === 'Email' ? '#b45309' : '#047857'
                }}>
                  {editingRequest.mode === 'Teams' ? '💬 Teams' : editingRequest.mode === 'Email' ? '✉️ Email' : '📊 Sheet'}
                </span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>
                    Remark &amp; Update Client Request ({editingRequest.id})
                  </h3>
                  <span style={{ fontSize: '12px', color: 'var(--ink-soft)' }}>
                    Assigned by: <strong>{editingRequest.assignedBy || 'Audit Specialist / Admin'}</strong> · Date: {new Date(editingRequest.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="drawer-close-btn"
                onClick={() => setEditingRequest(null)}
                aria-label="Close dialog"
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveEditModal} style={{ overflowY: 'auto', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Carrier & Client Details Summary Card (Read-only reference) */}
              <div style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--rule)',
                borderRadius: '8px',
                padding: '14px 16px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '12px'
              }}>
                <div>
                  <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--ink-soft)', fontWeight: 600 }}>Client Organization</span>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink)', marginTop: '2px' }}>
                    {CLIENTS.find(c => c.id === editingRequest.client)?.name || editingRequest.client}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--ink-soft)', fontWeight: 600 }}>Patient Name</span>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink)', marginTop: '2px' }}>
                    👤 {editingRequest.patientName || '—'}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--ink-soft)', fontWeight: 600 }}>Insurance Carrier (INS NAME)</span>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#0284c7', marginTop: '2px' }}>
                    {editingRequest.insName}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--ink-soft)', fontWeight: 600 }}>Carrier Phone (INS PHONE NO)</span>
                  <div style={{ fontSize: '13px', fontFamily: 'monospace', fontWeight: 600, color: 'var(--ink)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>{editingRequest.insPhone || '—'}</span>
                    {editingRequest.insPhone && (
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(editingRequest.insPhone);
                          showToast('Carrier phone copied to clipboard!', 'info');
                        }}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '12px' }}
                        title="Copy phone"
                      >
                        📋
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--ink-soft)', fontWeight: 600 }}>Plan Type</span>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginTop: '2px' }}>
                    {editingRequest.planType || 'Standard Plan'}
                  </div>
                </div>
              </div>

              {/* Status Selection Pills */}
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 700 }}>
                  Verification Status *
                </label>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setEditStatus('Not completed');
                    }}
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: editStatus === 'Not completed' ? '2px solid #ef4444' : '1px solid var(--rule)',
                      background: editStatus === 'Not completed' ? '#fee2e2' : 'var(--surface)',
                      color: editStatus === 'Not completed' ? '#b91c1c' : 'var(--ink)'
                    }}
                  >
                    ⏳ Not completed
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEditStatus('In Progress');
                    }}
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: editStatus === 'In Progress' ? '2px solid #0284c7' : '1px solid var(--rule)',
                      background: editStatus === 'In Progress' ? '#e0f2fe' : 'var(--surface)',
                      color: editStatus === 'In Progress' ? '#0369a1' : 'var(--ink)'
                    }}
                  >
                    🔄 In Progress
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEditStatus('Completed');
                    }}
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: editStatus === 'Completed' ? '2px solid #10b981' : '1px solid var(--rule)',
                      background: editStatus === 'Completed' ? '#dcfce7' : 'var(--surface)',
                      color: editStatus === 'Completed' ? '#15803d' : 'var(--ink)'
                    }}
                  >
                    ✅ Completed
                  </button>
                </div>
              </div>


              {/* Specialist Remarks Field */}
              <div className="field">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 700 }}>
                    Remarks (Verification Details &amp; Notes) *
                  </label>
                  <button
                    type="button"
                    onClick={handleInsertTimestamp}
                    className="link"
                    style={{ fontSize: '11px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    ➕ Stamp My Name &amp; Time
                  </button>
                </div>
                <textarea
                  className="input"
                  rows={5}
                  placeholder="Record your verification findings: Rep Name, Call Reference Number, Deductible met, Copay/Coinsurance, Pre-auth requirements, Effective dates, Escalation notes..."
                  value={editRemark}
                  onChange={(e) => setEditRemark(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--rule)', background: 'var(--surface)', color: 'var(--ink)', resize: 'vertical', lineHeight: 1.5 }}
                />
                <span style={{ fontSize: '11px', color: 'var(--ink-soft)', marginTop: '4px', display: 'block' }}>
                  After reviewing this request, enter verification notes and update the status above.
                </span>
              </div>

              {/* If Admin/Audit Specialist: option to reassign */}
              {canAssign && (
                <div className="field">
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>
                    Reassign To (Specialist)
                  </label>
                  <select
                    className="select-input"
                    value={editAssignTo}
                    onChange={(e) => setEditAssignTo(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--rule)' }}
                  >
                    {specialists.map(s => (
                      <option key={s.email} value={s.email}>
                        👤 {s.name} ({s.email}) {s.role === 'admin' ? '[Admin]' : s.role === 'auth' ? '[Audit Specialist]' : '[Specialist]'}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Modal Footer Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditingRequest(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ background: '#0284c7', borderColor: '#0284c7', color: '#fff', fontWeight: 600, padding: '10px 24px' }}
                >
                  💾 Save &amp; Update Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
