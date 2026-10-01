import React, { useState, useEffect } from 'react';
import { DataError } from '../../components/DataError';
import { useWorkspace } from '../../context/WorkspaceContext';
import { dashboardApi } from '../../api/dashboard';
import { vobsApi } from '../../api/vobs';
import { StatusBadge } from '../../components/vob/StatusBadge';
import { ClientBadge } from '../../components/vob/ClientBadge';
import { KpiCardGrid } from '../../components/vob/KpiCardGrid';

export function SpecialistDashboardView() {
  const { currentUser, openVerification, openCardPage } = useWorkspace();
  const [summary, setSummary] = useState({ total: 0, pending: 0, authQueue: 0, error: 0, approved: 0 });
  const [myVobs, setMyVobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    setLoadError('');
    Promise.all([
      dashboardApi.getSummary({ userEmail: currentUser.email }),
      vobsApi.getVobs({ assigneeId: currentUser.email, limit: 50 })
    ]).then(([sumData, list]) => {
      setSummary(sumData);
      setMyVobs(list);
      setLoading(false);
    }).catch((err) => {
      console.error(err);
      setLoadError(err?.message || 'Could not load this data.');
      setLoading(false);
    });
  }, [currentUser.email, reloadKey]);

  const handleStartNext = () => {
    const nextPending = myVobs.find(v => v.vobStatus === "Assigned" || v.vobStatus === "In Progress");
    if (nextPending) {
      openVerification(nextPending.id);
    } else if (myVobs.length > 0) {
      openVerification(myVobs[0].id);
    }
  };

  return (
    <div className="specialist-dashboard-view">
      <DataError message={loadError} onRetry={() => setReloadKey(k => k + 1)} />

      {/* Header Banner */}
      <section className="spec-banner">
        <div className="spec-banner-info">
          <span className="eyebrow">
            <span className="dot" aria-hidden="true" />
            Specialist Workspace · Minimum Necessary Access (SEC-3)
          </span>
          <h2 className="spec-banner-title">
            Hello, <span className="mark">{currentUser.name}</span>
          </h2>
          <p className="spec-banner-desc">
            You have <strong>{loading || loadError ? '—' : summary.pending}</strong> pending verifications in your queue today. Pre-fill from previous records is automatically active.
          </p>
        </div>

        <div className="spec-banner-actions">
          <button
            type="button"
            className="btn btn-lg"
            onClick={handleStartNext}
            disabled={myVobs.length === 0}
          >
            ⚡ Open Next Assigned VOB
          </button>
        </div>
      </section>

      {/* KPI Cards (Scoped only to current user FR-13); each opens its own page */}
      <KpiCardGrid
        role={currentUser.role}
        summary={summary}
        loading={loading}
        loadError={loadError}
        onOpen={openCardPage}
      />

      {/* My Active Tasks Table */}
      <section className="panel-card">
        <div className="panel-header">
          <div>
            <h3>My Assigned Tasks Queue</h3>
            <span className="panel-sub">Strictly isolated to your assigned patient accounts (FR-13)</span>
          </div>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Record ID</th>
                <th>Client</th>
                <th>Patient Name</th>
                <th>Date of Service</th>
                <th>Insurance Carrier</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" className="table-empty">Loading your tasks…</td></tr>
              ) : loadError ? (
                <tr><td colSpan="7" className="table-empty">Could not load your queue.</td></tr>
              ) : myVobs.length === 0 ? (
                <tr><td colSpan="7" className="table-empty">No tasks currently assigned to your queue.</td></tr>
              ) : (
                myVobs.map(v => (
                  <tr key={v.id} className="interactive-row" onClick={() => openVerification(v.id)}>
                    <td className="mono">{v.id}</td>
                    <td><ClientBadge clientId={v.client} /></td>
                    <td>
                      <div className="bold">{v.patientName}</div>
                      <div className="patient-sub-cell">DOB: {v.dob}</div>
                    </td>
                    <td>{v.dos}</td>
                    <td>
                      <div>{v.insurance}</div>
                      <div className="patient-sub-cell">{v.planTypeAndName}</div>
                    </td>
                    <td><StatusBadge status={v.vobStatus} /></td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          openVerification(v.id);
                        }}
                      >
                        Verify & Complete →
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
