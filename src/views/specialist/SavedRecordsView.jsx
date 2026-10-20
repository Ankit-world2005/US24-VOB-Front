import React, { useState, useEffect } from 'react';
import { DataError } from '../../components/DataError';
import { useWorkspace } from '../../context/WorkspaceContext';
import { vobsApi } from '../../api/vobs';
import { ClientBadge } from '../../components/vob/ClientBadge';
import { DocumentGeneratorModal } from '../../components/vob/DocumentGeneratorModal';
import { QueueFilterBar } from '../../components/vob/QueueFilterBar';
import { StatusBadge } from '../../components/vob/StatusBadge';
import { useRecordFilters, QUEUE_LIMIT } from '../../hooks/useRecordFilters';
import { AUDIT_ACTION_LABELS, AUDIT_RESULT_LABELS } from '../../utils/audit';

/**
 * The audit specialist's saved record of each VOB they audited: the mark, the
 * action they took, where it sent the VOB, and the details of the review.
 */
function AuditedRecordsPanel() {
  const [audited, setAudited] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    setLoadError('');
    vobsApi.getVobs({ auditedBy: 'me', limit: QUEUE_LIMIT }).then(list => {
      setAudited(list.filter(v => v.audit));
      setHasMore(Boolean(list.page?.has_more));
      setLoading(false);
    }).catch((err) => {
      console.error(err);
      setLoadError(err?.message || 'Could not load this data.');
      setLoading(false);
    });
  }, [reloadKey]);

  return (
    <div className="panel-card" style={{ marginBottom: '24px', borderLeft: '4px solid #6366f1' }}>
      <DataError message={loadError} onRetry={() => setReloadKey(k => k + 1)} />
      <div className="panel-header">
        <div>
          <h3>🛡️ My Audited Records</h3>
          <span className="panel-sub">Every VOB you audited, with your audit mark, the action you took and where it went</span>
        </div>
        <div className="saved-pill-count">
          {audited.length} Audited Records
        </div>
      </div>

      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>Record ID</th>
              <th>Client</th>
              <th>Patient Name</th>
              <th>Submitted By</th>
              <th>Audit Mark</th>
              <th>Action Taken</th>
              <th>Audit Status</th>
              <th>Audited On</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="9" className="table-empty">Loading Audited Records…</td></tr>
            ) : loadError ? (
              <tr><td colSpan="9" className="table-empty">Could not load this data.</td></tr>
            ) : audited.length === 0 ? (
              <tr><td colSpan="9" className="table-empty">No audited records yet. VOBs you verify or return from the Audit Queue are saved here.</td></tr>
            ) : (
              audited.map(v => {
                const a = v.audit;
                return (
                  <tr key={v.id}>
                    <td className="mono">{v.id}</td>
                    <td><ClientBadge clientId={v.clientName || v.client} /></td>
                    <td className="bold">{v.patientName}</td>
                    <td>{a.submitted_by?.name || a.submitted_by?.id || '—'}</td>
                    <td>
                      {a.mark === 'returned'
                        ? <span className="badge-rejected">✗ Returned</span>
                        : <span className="badge-valid">✓ Audit Verified</span>}
                    </td>
                    <td>{AUDIT_ACTION_LABELS[a.action] || a.action}</td>
                    <td>
                      <div className="bold">{a.mark === 'returned' ? 'Returned for correction' : 'Audit complete'}</div>
                      <div className="patient-sub-cell">Sent to: {AUDIT_RESULT_LABELS[a.result_status] || a.result_status}</div>
                      <div className="patient-sub-cell">Now: <StatusBadge status={v.vobStatus} /></div>
                    </td>
                    <td className="mono">{new Date(a.audited_at).toLocaleString()}</td>
                    <td>{a.remarks || '—'}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {hasMore && (
        <p className="card-detail-footnote">Showing your {QUEUE_LIMIT} most recently changed audited records.</p>
      )}
    </div>
  );
}

export function SavedRecordsView() {
  const { currentUser, openVerification } = useWorkspace();
  const isAuditSpecialist = currentUser?.role === 'auth' || currentUser?.role === 'auth_specialist' || currentUser?.role === 'audit' || currentUser?.email === 'jitender.s@us24solutions.com' || currentUser?.email === 'ankit.k@us24solutions.com';
  const [approvedVobs, setApprovedVobs] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [docVob, setDocVob] = useState(null);
  const { filtered, ...filterBar } = useRecordFilters(approvedVobs);

  useEffect(() => {
    setLoading(true);
    setLoadError('');
    vobsApi.getVobs({
      status: 'Approved',
      userEmail: currentUser.role === 'admin' ? undefined : currentUser.email,
      limit: QUEUE_LIMIT
    }).then(list => {
      setApprovedVobs(list);
      setHasMore(Boolean(list.page?.has_more));
      setLoading(false);
    }).catch((err) => {
      console.error(err);
      setLoadError(err?.message || 'Could not load this data.');
      setLoading(false);
    });
  }, [currentUser.email, reloadKey]);

  return (
    <div className="saved-records-view">
      <DataError message={loadError} onRetry={() => setReloadKey(k => k + 1)} />

      {isAuditSpecialist && <AuditedRecordsPanel />}

      <div className="panel-card">
        <div className="panel-header">
          <div>
            <h3>Saved Records — Approved Verifications (FR-11, FR-15)</h3>
            <span className="panel-sub">Validated benefit determinations ready for billing and pre-service clinical scheduling</span>
          </div>
          <div className="saved-pill-count">
            {approvedVobs.length} Completed Records
          </div>
        </div>

        <QueueFilterBar {...filterBar} shown={filtered.length} total={approvedVobs.length} />

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Record ID</th>
                <th>Client</th>
                <th>Patient Name</th>
                <th>Service Type</th>
                <th>Insurance / Payer</th>
                <th>Cost Share / Copay</th>
                <th>Completion Date</th>
                <th>Documentation Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="8" className="table-empty">Loading Approved Records…</td></tr>
              ) : loadError ? (
                <tr><td colSpan="8" className="table-empty">Could not load this data.</td></tr>
              ) : approvedVobs.length === 0 ? (
                <tr><td colSpan="8" className="table-empty">No approved records completed yet.</td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="8" className="table-empty">
                    No records match your search and filters.{' '}
                    <button type="button" className="btn-action-link" onClick={filterBar.clear}>Clear filters</button>
                  </td>
                </tr>
              ) : (
                filtered.map(v => (
                  <tr key={v.id}>
                    <td className="mono">{v.id}</td>
                    <td><ClientBadge clientId={v.clientName || v.client} /></td>
                    <td>
                      <div className="bold">{v.patientName}</div>
                      <div className="patient-sub-cell">ID: {v.idCard}</div>
                    </td>
                    <td>
                      <div>{v.appointmentType || 'Physical Therapy'}</div>
                      {v.dos && <div className="patient-sub-cell">DOS: {v.dos}</div>}
                    </td>
                    <td>{v.insurance}</td>
                    <td><span className="copay-highlight">{v.copayCoinsurance}</span></td>
                    <td className="mono">{v.vobCompletionDate || '2026-09-21'}</td>
                    <td>
                      <div className="action-buttons-group">
                        <button
                          type="button"
                          className="btn btn-sm btn-doc"
                          onClick={() => setDocVob(v)}
                          title="Generate Pre-Authorization & Benefits Determination document"
                        >
                          📄 Generate VOB Form (.docx)
                        </button>
                        <button
                          type="button"
                          className="btn-action-link"
                          onClick={() => openVerification(v.id)}
                          title="Edit saved record"
                        >
                          Edit / Open</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {hasMore && (
          <p className="card-detail-footnote">Showing the {QUEUE_LIMIT} most recent records; search and filters cover these.</p>
        )}
      </div>

      <DocumentGeneratorModal
        vob={docVob}
        isOpen={Boolean(docVob)}
        onClose={() => setDocVob(null)}
      />
    </div>
  );
}


