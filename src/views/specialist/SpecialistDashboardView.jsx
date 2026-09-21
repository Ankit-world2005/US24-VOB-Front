import React, { useState, useEffect } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { dashboardApi } from '../../api/dashboard';
import { vobsApi } from '../../api/vobs';
import { StatusBadge } from '../../components/vob/StatusBadge';
import { ClientBadge } from '../../components/vob/ClientBadge';

export function SpecialistDashboardView() {
  const { currentUser, openVerification, setActiveTab } = useWorkspace();
  const [summary, setSummary] = useState({ total: 0, pending: 0, authQueue: 0, error: 0, approved: 0 });
  const [myVobs, setMyVobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      dashboardApi.getSummary({ userEmail: currentUser.email }),
      vobsApi.getVobs({ userEmail: currentUser.email })
    ]).then(([sumData, list]) => {
      setSummary(sumData);
      setMyVobs(list);
      setLoading(false);
    }).catch(console.error);
  }, [currentUser.email]);

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
            You have <strong>{summary.pending}</strong> pending verifications in your queue today. Pre-fill from previous records is automatically active.
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

      {/* KPI Cards (Scoped only to current user FR-13) */}
      <section className="kpi-cards-grid">
        <div className="kpi-card" onClick={() => setActiveTab('verification')}>
          <div className="kpi-label">Assigned to Me</div>
          <div className="kpi-number">{loading ? '…' : summary.total}</div>
          <div className="kpi-meta">Across your assigned clients</div>
        </div>

        <div className="kpi-card kpi-pending" onClick={() => setActiveTab('verification')}>
          <div className="kpi-label">Pending Verifications</div>
          <div className="kpi-number">{loading ? '…' : summary.pending}</div>
          <div className="kpi-meta">Assigned or In Progress</div>
        </div>

        <div className="kpi-card kpi-auth" onClick={() => setActiveTab('auth_queue')}>
          <div className="kpi-label">My Auth Queue</div>
          <div className="kpi-number">{loading ? '…' : summary.authQueue}</div>
          <div className="kpi-meta">Awaiting prior auth numbers</div>
        </div>

        <div className="kpi-card kpi-error" onClick={() => setActiveTab('error_queue')}>
          <div className="kpi-label">Validation Errors</div>
          <div className="kpi-number">{loading ? '…' : summary.error}</div>
          <div className="kpi-meta">Failing rules to correct</div>
        </div>

        <div className="kpi-card kpi-approved" onClick={() => setActiveTab('saved_records')}>
          <div className="kpi-label">Saved (Approved)</div>
          <div className="kpi-number">{loading ? '…' : summary.approved}</div>
          <div className="kpi-meta">Completed today</div>
        </div>
      </section>

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
