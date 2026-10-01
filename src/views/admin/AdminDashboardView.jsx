import React, { useState, useEffect } from 'react';
import { DataError } from '../../components/DataError';
import { useWorkspace } from '../../context/WorkspaceContext';
import { dashboardApi } from '../../api/dashboard';
import { vobsApi } from '../../api/vobs';
import { usersApi } from '../../api/users';
import { StatusBadge } from '../../components/vob/StatusBadge';
import { ClientBadge } from '../../components/vob/ClientBadge';
import { RecordDetailModal } from '../../components/vob/RecordDetailModal';
import { KpiCardGrid } from '../../components/vob/KpiCardGrid';
import { CLIENTS } from '../../data/clients';

export function AdminDashboardView() {
  const { selectedClient, setSelectedClient, setActiveTab, openVerification, openCardPage } = useWorkspace();
  const [summary, setSummary] = useState({ total: 0, pending: 0, authQueue: 0, error: 0, approved: 0 });
  const [recentVobs, setRecentVobs] = useState([]);
  const [specialists, setSpecialists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [inspectVobId, setInspectVobId] = useState(null);

  useEffect(() => {
    setLoading(true);
    setLoadError('');
    Promise.all([
      dashboardApi.getSummary({ clientId: selectedClient }),
      vobsApi.getVobs({ clientId: selectedClient, limit: 50 }),
      usersApi.getUsers().catch(() => [])
    ]).then(([sumData, vobsList, userList]) => {
      setSummary(sumData);
      setRecentVobs(vobsList);
      const specs = (userList || [])
        .filter(u => u.role === 'user' && u.active !== false)
        .map(u => {
          const assignedCount = vobsList.filter(v => v.assignedTo === u.email || v.assignedTo === u.id).length;
          const completedCount = vobsList.filter(v => (v.assignedTo === u.email || v.assignedTo === u.id) && (v.vobStatus === 'Approved' || v.status === 'approved')).length;
          return {
            id: u.id,
            name: u.name,
            email: u.email,
            count: assignedCount,
            complete: completedCount,
            capacity: assignedCount > 10 ? 'High' : assignedCount > 5 ? 'Medium' : 'Optimal'
          };
        });
      setSpecialists(specs);
      setLoading(false);
    }).catch((err) => {
      console.error(err);
      setLoadError(err?.message || 'Could not load this data.');
      setLoading(false);
    });
  }, [selectedClient, reloadKey]);

  return (
    <div className="admin-dashboard-view">
      <DataError message={loadError} onRetry={() => setReloadKey(k => k + 1)} />

      {/* KPI Overview Metrics */}
      <section className="dashboard-section">
        <div className="section-title-row">
          <div>
            <h2 className="dashboard-heading">Operational Metrics</h2>
            <p className="dashboard-sub">Live volume and queue statuses across healthcare client organizations</p>
          </div>
          <div className="quick-actions-row">
            <button type="button" className="btn btn-sm" onClick={() => setActiveTab('upload_assign')}>
              + Upload & Assign Intake
            </button>
            <button type="button" className="btn btn-sm ghost" onClick={() => setActiveTab('master_data')}>
              Master Reference Data
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
            <h3>Volume by Client Sheet (8 Clients)</h3>
            <span className="panel-sub">VOB_format.xlsx canonical distribution</span>
          </div>
          <div className="client-volume-list">
            {CLIENTS.map(c => {
              const count = recentVobs.filter(v => v.client === c.id).length;
              const pct = recentVobs.length ? Math.round((count / recentVobs.length) * 100) : 0;
              return (
                <div key={c.id} className="client-vol-row" onClick={() => setSelectedClient(c.id)}>
                  <div className="vol-client-meta">
                    <span className="vol-color-dot" style={{ background: c.color }} />
                    <span className="vol-client-name">{c.name}</span>
                  </div>
                  <div className="vol-bar-track">
                    <div className="vol-bar-fill" style={{ width: `${pct}%`, background: c.color }} />
                  </div>
                  <div className="vol-count">
                    <strong>{count}</strong> <span className="vol-pct">({pct}%)</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="panel-card">
          <div className="panel-header">
            <h3>Specialist Allocation & Velocity</h3>
            <span className="panel-sub">Active staff workload</span>
          </div>
          <div className="specialist-workload-list">
            {specialists.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                No active specialists found.
              </div>
            ) : (
              specialists.map(sp => (
                <div key={sp.email} className="spec-row">
                  <div className="spec-info">
                    <div className="spec-avatar">{sp.name.split(' ').map(p => p[0]).join('')}</div>
                    <div>
                      <div className="spec-name">{sp.name}</div>
                      <div className="spec-email">{sp.email}</div>
                    </div>
                  </div>
                  <div className="spec-stats">
                    <div><span>Assigned:</span> <strong>{sp.count}</strong></div>
                    <div><span>Completed:</span> <strong className="green">{sp.complete}</strong></div>
                    <span className="capacity-pill">{sp.capacity} load</span>
                  </div>
                </div>
              ))
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
