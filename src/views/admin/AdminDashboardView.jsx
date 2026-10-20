import React, { useState } from 'react';
import { DataError } from '../../components/DataError';
import { LiveIndicator } from '../../components/LiveIndicator';
import { useWorkspace } from '../../context/WorkspaceContext';
import { dashboardApi } from '../../api/dashboard';
import { uiClientFor } from '../../api/clientIds';
import { vobsApi } from '../../api/vobs';
import { usePolling } from '../../hooks/usePolling';
import { useNow } from '../../hooks/useNow';
import { StatusBadge } from '../../components/vob/StatusBadge';
import { ClientBadge } from '../../components/vob/ClientBadge';
import { RecordDetailModal } from '../../components/vob/RecordDetailModal';
import { KpiCardGrid } from '../../components/vob/KpiCardGrid';
import { CLIENTS } from '../../data/clients';

const POLL_MS = 30000;
const EMPTY_BREAKDOWN = { totalVobs: 0, clients: [], specialists: [], needsAssignment: 0 };

/** A specialist's load from the work still on their plate: open plus errors to fix. */
function loadOf(sp) {
  const work = sp.open + sp.error;
  return work > 10 ? 'High' : work > 5 ? 'Medium' : 'Optimal';
}

function initials(name) {
  return name.split(/\s+/).filter(Boolean).map(p => p[0]).join('').slice(0, 2).toUpperCase();
}

/** A count in the specialist table: muted at zero, in `tone` otherwise. */
function SpecNum({ value, tone = '' }) {
  return <td className={`spec-num${value === 0 ? ' zero' : tone ? ` ${tone}` : ''}`}>{value}</td>;
}

export function AdminDashboardView() {
  const { selectedClient, setSelectedClient, setActiveTab, openCardPage } = useWorkspace();
  const [summary, setSummary] = useState({ total: 0, pending: 0, authQueue: 0, error: 0, approved: 0 });
  const [recentVobs, setRecentVobs] = useState([]);
  const [breakdown, setBreakdown] = useState(EMPTY_BREAKDOWN);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [inspectVobId, setInspectVobId] = useState(null);
  const now = useNow(5000);

  // Every count on the page, re-read every 30s and when the tab comes back into
  // view. Only the first load shows placeholders; refreshes swap numbers in place.
  const { lastUpdated, refreshing, refresh } = usePolling(async (isCurrent) => {
    try {
      const [sumData, vobsList, breakdownData] = await Promise.all([
        dashboardApi.getSummary({ clientId: selectedClient }),
        vobsApi.getVobs({ clientId: selectedClient, limit: 50 }),
        dashboardApi.getBreakdown({ clientId: selectedClient })
      ]);
      if (!isCurrent()) return;
      setSummary(sumData);
      setRecentVobs(vobsList);
      setBreakdown(breakdownData);
      setLoadError('');
    } catch (err) {
      if (isCurrent()) setLoadError(err?.message || 'Could not load this data.');
      throw err;
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, POLL_MS, [selectedClient]);

  // Each server client with the UI's slug (the workspace filter's value) and colour.
  const clientRows = breakdown.clients.map(c => {
    const ui = uiClientFor(c.name);
    return { ...c, key: ui?.id ?? c.id, color: ui?.color ?? 'var(--ink-soft)' };
  });
  const scopeName = selectedClient && selectedClient !== 'all'
    ? (clientRows.find(c => c.key === selectedClient)?.name
      ?? CLIENTS.find(c => c.id === selectedClient)?.name
      ?? selectedClient)
    : 'All clients';
  const specialists = [...breakdown.specialists].sort(
    (a, b) => (b.open + b.error) - (a.open + a.error) || a.name.localeCompare(b.name)
  );
  const showPlaceholder = loading && !lastUpdated;

  return (
    <div className="admin-dashboard-view">
      <DataError message={loadError} onRetry={refresh} />

      {/* KPI Overview Metrics */}
      <section className="dashboard-section">
        <div className="section-title-row">
          <div>
            <h2 className="dashboard-heading">Operational Metrics</h2>
            <p className="dashboard-sub">Live volume and queue statuses across healthcare client organizations</p>
          </div>
          <div className="quick-actions-row">
            <LiveIndicator lastUpdated={lastUpdated} refreshing={refreshing} onRefresh={refresh} now={now} />
            <button type="button" className="btn btn-sm" onClick={() => setActiveTab('upload_assign')}>
              + Upload & Assign Intake
            </button>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setActiveTab('client_requests')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: '#0284c7',
                color: '#fff',
                borderColor: '#0284c7',
                fontWeight: 600
              }}
              title="Open Client Requests Dashboard (Teams, Sheet, Email)"
            >
              📥 Client Request
            </button>
          </div>
        </div>

        <KpiCardGrid
          role="admin"
          summary={summary}
          loading={loading}
          loadError={loadError}
          onOpen={openCardPage}
        />
      </section>

      {/* Two-column middle layout: Client Breakdown & Specialist Workload */}
      <section className="dashboard-grid-2">
        <div className="panel-card">
          <div className="panel-header">
            <h3>Volume by Client{showPlaceholder ? '' : ` (${clientRows.length} clients)`}</h3>
            <span className="panel-sub">All VOBs · {breakdown.totalVobs} total · click a client to filter</span>
          </div>
          <div className="client-volume-list">
            {showPlaceholder ? (
              <div className="panel-empty">Loading client volumes…</div>
            ) : clientRows.length === 0 ? (
              <div className="panel-empty">No clients found.</div>
            ) : (
              clientRows.map(c => {
                const pct = breakdown.totalVobs ? Math.round((c.total / breakdown.totalVobs) * 100) : 0;
                const isSelected = selectedClient === c.key;
                const toggle = () => setSelectedClient(isSelected ? 'all' : c.key);
                return (
                  <div
                    key={c.id}
                    className={`client-vol-row${isSelected ? ' selected' : ''}`}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isSelected}
                    title={isSelected ? 'Show all clients' : `Show only ${c.name}`}
                    onClick={toggle}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggle();
                      }
                    }}
                  >
                    <div className="vol-client-meta">
                      <span className="vol-color-dot" style={{ background: c.color }} />
                      <span className="vol-client-name">{c.name}</span>
                    </div>
                    <div className="vol-bar-track">
                      <div className="vol-bar-fill" style={{ width: `${pct}%`, background: c.color }} />
                    </div>
                    <div className="vol-count">
                      <strong>{c.total}</strong> <span className="vol-pct">({pct}%)</span>
                    </div>
                    <div className="vol-status-line">
                      {c.open} open · {c.authQueue} auth · {c.error} errors · {c.approved} approved
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="panel-card">
          <div className="panel-header">
            <h3>User & Specialist Allocation & Velocity</h3>
            <span className="panel-sub">Active portal users · {scopeName}</span>
          </div>
          {showPlaceholder ? (
            <div className="panel-empty">Loading team workload…</div>
          ) : specialists.length === 0 ? (
            <div className="panel-empty">No active portal users found.</div>
          ) : (
            <div className="table-responsive" style={{ maxHeight: '460px', overflowY: 'auto' }}>
              <table className="spec-table">
                <colgroup>
                  <col />
                  <col className="spec-col-num" />
                  <col className="spec-col-num" />
                  <col className="spec-col-num" />
                  <col className="spec-col-num" />
                  <col className="spec-col-load" />
                </colgroup>
                <thead>
                  <tr>
                    <th rowSpan={2}>User / Specialist</th>
                    <th rowSpan={2} className="spec-num" title="Assigned + In Progress">Open</th>
                    <th rowSpan={2} className="spec-num" title="Validation errors to fix">Errors</th>
                    <th colSpan={2} className="spec-group">Approved</th>
                    <th rowSpan={2} className="spec-load">Load</th>
                  </tr>
                  <tr>
                    <th className="spec-num" title="Approved today">Today</th>
                    <th className="spec-num" title="Approved in the last 7 days, including today">7 days</th>
                  </tr>
                </thead>
                <tbody>
                  {specialists.map(sp => {
                    const load = loadOf(sp);
                    return (
                      <tr key={sp.id}>
                        <td>
                          <div className="spec-info">
                            <div className="spec-avatar" aria-hidden="true">{initials(sp.name)}</div>
                            <div className="spec-ident">
                              <div className="spec-name" title={sp.name}>
                                <span>{sp.name}</span>
                                {sp.role === 'admin' ? (
                                  <span
                                    className="spec-role-pill admin-pill"
                                    style={{
                                      marginLeft: '6px',
                                      fontSize: '10px',
                                      fontWeight: 600,
                                      padding: '1px 5px',
                                      borderRadius: '4px',
                                      background: 'rgba(79, 70, 229, 0.12)',
                                      color: '#4338ca',
                                      border: '1px solid rgba(79, 70, 229, 0.25)',
                                      display: 'inline-block',
                                      verticalAlign: 'middle',
                                      lineHeight: '1.3',
                                    }}
                                  >
                                    Admin
                                  </span>
                                ) : sp.role === 'auth' ? (
                                  <span
                                    className="spec-role-pill auth-pill"
                                    style={{
                                      marginLeft: '6px',
                                      fontSize: '10px',
                                      fontWeight: 600,
                                      padding: '1px 5px',
                                      borderRadius: '4px',
                                      background: '#fef3c7',
                                      color: '#b45309',
                                      border: '1px solid rgba(217, 119, 6, 0.25)',
                                      display: 'inline-block',
                                      verticalAlign: 'middle',
                                      lineHeight: '1.3',
                                    }}
                                  >
                                    Auth
                                  </span>
                                ) : (
                                  <span
                                    className="spec-role-pill user-pill"
                                    style={{
                                      marginLeft: '6px',
                                      fontSize: '10px',
                                      fontWeight: 500,
                                      padding: '1px 5px',
                                      borderRadius: '4px',
                                      background: 'var(--surface-2, #f1f5f9)',
                                      color: 'var(--ink-soft, #64748b)',
                                      border: '1px solid var(--rule-soft, #e2e8f0)',
                                      display: 'inline-block',
                                      verticalAlign: 'middle',
                                      lineHeight: '1.3',
                                    }}
                                  >
                                    Specialist
                                  </span>
                                )}
                              </div>
                              <div className="spec-email" title={sp.email}>{sp.email}</div>
                            </div>
                          </div>
                        </td>
                        <SpecNum value={sp.open} />
                        <SpecNum value={sp.error} tone="spec-stat-error" />
                        <SpecNum value={sp.approvedToday} tone="spec-stat-done" />
                        <SpecNum value={sp.approved7d} tone="spec-stat-done" />
                        <td className="spec-load">
                          <span className={`capacity-pill load-${load.toLowerCase()}`}>{load}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {!showPlaceholder && breakdown.needsAssignment > 0 && (
            <div className="spec-footer">
              <span>
                <strong>{breakdown.needsAssignment}</strong> VOB{breakdown.needsAssignment === 1 ? '' : 's'} need assignment
              </span>
              <button type="button" className="btn btn-sm ghost" onClick={() => setActiveTab('upload_assign')}>
                Assign →
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Live Recent Verification Feed (One-tap drilldown) */}
      <section className="dashboard-section">
        <div className="panel-card">
          <div className="panel-header">
            <h3>Active VOB Records Feed</h3>
            <span className="panel-sub">Tap any record to open full 28 canonical columns and audit log</span>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Patient Name & DOB</th>
                  <th>Service Type</th>
                  <th>Insurance / Payer</th>
                  <th>Status</th>
                  <th>Assigned Specialist</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {recentVobs.map(v => (
                  <tr key={v.id}>
                    <td><ClientBadge clientId={v.client} /></td>
                    <td>
                      <div className="patient-name-cell">{v.patientName}</div>
                      <div className="patient-sub-cell">DOB: {v.dob}</div>
                    </td>
                    <td>
                      <div>{v.appointmentType || 'Physical Therapy'}</div>
                      {v.dos && <div className="patient-sub-cell">DOS: {v.dos}</div>}
                    </td>
                    <td>
                      <div>{v.insurance}</div>
                      <div className="patient-sub-cell">{v.planTypeAndName}</div>
                    </td>
                    <td><StatusBadge status={v.vobStatus} /></td>
                    <td>
                      <span className="assignee-tag">{v.assignedTo?.split('@')[0]}</span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="table-action-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setInspectVobId(v.id);
                        }}
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Modal Inspector for One-Tap Drilldown */}
      <RecordDetailModal
        vobId={inspectVobId}
        isOpen={Boolean(inspectVobId)}
        onClose={() => setInspectVobId(null)}
      />
    </div>
  );
}
