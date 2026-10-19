import React, { useState, useEffect } from 'react';
import { DataError } from '../../components/DataError';
import { useWorkspace } from '../../context/WorkspaceContext';
import { dashboardApi } from '../../api/dashboard';
import { vobsApi } from '../../api/vobs';
import { StatusBadge } from '../../components/vob/StatusBadge';
import { ClientBadge } from '../../components/vob/ClientBadge';
import { KpiCardGrid } from '../../components/vob/KpiCardGrid';

export function SpecialistDashboardView() {
  const { currentUser, openVerification, openCardPage, openQueueWithVob } = useWorkspace();
  const [summary, setSummary] = useState({ total: 0, pending: 0, authQueue: 0, error: 0, approved: 0 });
  const [myVobs, setMyVobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const isAuditSpecialist = currentUser?.role === 'auth' || currentUser?.role === 'auth_specialist' || currentUser?.role === 'audit' || currentUser?.email === 'jitender.s@us24solutions.com' || currentUser?.email === 'ankit.k@us24solutions.com';

  useEffect(() => {
    setLoading(true);
    setLoadError('');
    Promise.all([
      dashboardApi.getSummary(isAuditSpecialist ? {} : { userEmail: currentUser?.email }),
      vobsApi.getVobs({
        ...(isAuditSpecialist ? {} : { assigneeId: currentUser?.email }),
        status: isAuditSpecialist ? ['Assigned', 'In Progress'] : 'Assigned',
        limit: 100
      })
    ]).then(([sumData, list]) => {
      setSummary(sumData);
      setMyVobs(list);
      setLoading(false);
    }).catch((err) => {
      console.error(err);
      setLoadError(err?.message || 'Could not load this data.');
      setLoading(false);
    });
  }, [currentUser?.email, currentUser?.role, isAuditSpecialist, reloadKey]);

  // VOBs assigned or submitted for audit verification show to ALL audit specialists
  const awaitingAudit = (v) =>
    v.audit_stage === 'pending_audit' ||
    v.auditStage === 'pending_audit' ||
    v.extra?.auditStage === 'pending_audit' ||
    v.reassignmentReason === 'Submitted for Audit Verification' ||
    v.reassignment_reason === 'Submitted for Audit Verification';
  const auditTasks = isAuditSpecialist ? myVobs.filter(awaitingAudit) : [];
  const assignedTasks = isAuditSpecialist ? myVobs.filter(v => !awaitingAudit(v)) : myVobs;

  const handleStartNext = () => {
    if (isAuditSpecialist) {
      const nextAudit = auditTasks.find(v => v.vobStatus === "Assigned" || v.vobStatus === "In Progress") || auditTasks[0];
      if (nextAudit) {
        openQueueWithVob(nextAudit.id);
        return;
      }
      const nextAssigned = assignedTasks.find(v => v.vobStatus === "Assigned" || v.vobStatus === "In Progress") || assignedTasks[0];
      if (nextAssigned) {
        openVerification(nextAssigned.id);
        return;
      }
      openQueueWithVob(null);
      return;
    }
    const nextPending = assignedTasks.find(v => v.vobStatus === "Assigned" || v.vobStatus === "In Progress");
    if (nextPending) {
      openVerification(nextPending.id);
    } else if (assignedTasks.length > 0) {
      openVerification(assignedTasks[0].id);
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
            {isAuditSpecialist
              ? 'Audit Specialist Workspace · Quality Assurance & Compliance'
              : 'Specialist Workspace · Minimum Necessary Access (SEC-3)'}
          </span>
          <h2 className="spec-banner-title">
            Hello, <span className="mark">{currentUser.name}</span>
          </h2>
          <p className="spec-banner-desc">
            {isAuditSpecialist ? (
              <>
                You have <strong>{loading || loadError ? '—' : auditTasks.length}</strong> record{auditTasks.length === 1 ? '' : 's'} awaiting quality audit verification
                {assignedTasks.length > 0 ? (
                  <> and <strong>{assignedTasks.length}</strong> assigned verification task{assignedTasks.length === 1 ? '' : 's'}</>
                ) : null} today. Pre-fill from previous records is automatically active.
              </>
            ) : (
              <>
                You have <strong>{loading || loadError ? '—' : summary.pending}</strong> pending verifications in your queue today. Pre-fill from previous records is automatically active.
              </>
            )}
          </p>
        </div>

        <div className="spec-banner-actions">
          <button
            type="button"
            className="btn btn-lg"
            onClick={handleStartNext}
            disabled={myVobs.length === 0}
          >
            {isAuditSpecialist
              ? (auditTasks.length > 0 ? '⚡ Open Next Audit Record' : '⚡ Open Next Assigned VOB')
              : '⚡ Open Next Assigned VOB'}
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

      {/* Awaiting Audit Verification Queue (Audit Specialist only) */}
      {isAuditSpecialist && (
        <section className="panel-card" style={{ marginBottom: '24px', borderLeft: '4px solid #6366f1' }}>
          <div className="panel-header">
            <div>
              <h3>🔍 Awaiting Audit Verification ({auditTasks.length})</h3>
              <span className="panel-sub">Tasks submitted by specialists requiring Quality Assurance verification</span>
            </div>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Record ID</th>
                  <th>Client</th>
                  <th>Patient Name</th>
                  <th>Submitting Specialist</th>
                  <th>Date of Service</th>
                  <th>Insurance Carrier</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="7" className="table-empty">Loading audit queue…</td></tr>
                ) : auditTasks.length === 0 ? (
                  <tr><td colSpan="7" className="table-empty">No tasks currently awaiting audit verification.</td></tr>
                ) : (
                  auditTasks.map(v => (
                    <tr key={v.id}>
                      <td className="mono">{v.id}</td>
                      <td><ClientBadge clientId={v.client} /></td>
                      <td>
                        <div className="bold">{v.patientName}</div>
                        <div className="patient-sub-cell">DOB: {v.dob}</div>
                      </td>
                      <td>
                        <span className="badge badge-info" style={{ fontWeight: 600 }}>
                          👤 {v.previous_assignee?.name || v.previousAssignee || 'Specialist'}
                        </span>
                      </td>
                      <td>{v.dos}</td>
                      <td>
                        <div>{v.insurance}</div>
                        <div className="patient-sub-cell">{v.planTypeAndName}</div>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-sm"
                          style={{ backgroundColor: '#6366f1', color: '#fff', fontWeight: 600 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            openQueueWithVob(v.id);
                          }}
                        >
                          Verify →
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* My Assigned Tasks Table (Both Specialists and Audit Specialists) */}
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
              ) : assignedTasks.length === 0 ? (
                <tr><td colSpan="7" className="table-empty">{isAuditSpecialist ? 'No direct assigned tasks in your queue. Tasks awaiting verification are in the Awaiting Audit table above.' : 'No assigned tasks in your queue. Work in progress and finished work is under the cards above.'}</td></tr>
              ) : (
                assignedTasks.map(v => (
                  <tr key={v.id}>
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
