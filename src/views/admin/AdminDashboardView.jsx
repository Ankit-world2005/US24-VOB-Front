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
            <h3>Specialist Allocation & Velocity</h3>
            <span className="panel-sub">Active specialists · {scopeName}</span>
          </div>
          <div className="specialist-workload-list">
            {showPlaceholder ? (
              <div className="panel-empty">Loading specialist workload…</div>
            ) : specialists.length === 0 ? (
              <div className="panel-empty">No active specialists found.</div>
            ) : (
              specialists.map(sp => {
                const load = loadOf(sp);
                return (
                  <div key={sp.id} className="spec-row">
                    <div className="spec-info">
                      <div className="spec-avatar">{initials(sp.name)}</div>
                      <div>
                        <div className="spec-name">{sp.name}</div>
                        <div className="spec-email">{sp.email}</div>
                      </div>
                    </div>
                    <div className="spec-stats">
                      <div title="Assigned + In Progress"><span>Open:</span> <strong>{sp.open}</strong></div>
                      {sp.error > 0 && (
                        <div title="Validation errors to fix"><span>Errors:</span> <strong className="spec-stat-error">{sp.error}</strong></div>
                      )}
                      <div title="Approved today"><span>Done today:</span> <strong className="spec-stat-done">{sp.approvedToday}</strong></div>
                      <div title="Approved in the last 7 days"><span>This week:</span> <strong className="spec-stat-done">{sp.approved7d}</strong></div>
                      <span className={`capacity-pill load-${load.toLowerCase()}`}>{load} load</span>
                    </div>
                  </div>
                );
              })
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
                  <th>Date of Service</th>
                  <th>Insurance & Plan</th>
                  <th>Status</th>
                  <th>Assigned Specialist</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {recentVobs.map(v => (
                  <tr key={v.id} className="interactive-row" onClick={() => setInspectVobId(v.id)}>
                    <td><ClientBadge clientId={v.client} /></td>
                    <td>
                      <div className="patient-name-cell">{v.patientName}</div>
                      <div className="patient-sub-cell">DOB: {v.dob}</div>
                    </td>
                    <td>
                      <div>{v.dos}</div>
                      <div className="patient-sub-cell">{v.appointmentType}</div>
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
