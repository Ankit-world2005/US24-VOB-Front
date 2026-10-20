import React, { useState, useEffect } from 'react';
import { DataError } from '../../components/DataError';
import { useWorkspace } from '../../context/WorkspaceContext';
import { vobsApi } from '../../api/vobs';
import { ClientBadge } from '../../components/vob/ClientBadge';
import { failureLabel } from '../../data/clients';
import { ReassignModal } from '../../components/vob/ReassignModal';
import { CorrectionLogsModal } from '../../components/vob/CorrectionLogsModal';
import { QueueFilterBar } from '../../components/vob/QueueFilterBar';
import { useRecordFilters, QUEUE_LIMIT } from '../../hooks/useRecordFilters';

export function ErrorQueueView() {
  const { currentUser, openVerification } = useWorkspace();
  const [errorVobs, setErrorVobs] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [reassignVob, setReassignVob] = useState(null);
  const [selectedLogVob, setSelectedLogVob] = useState(null);
  const { filtered, ...filterBar } = useRecordFilters(errorVobs);

  useEffect(() => {
    setLoading(true);
    setLoadError('');
    vobsApi.getVobs({
      status: 'Error',
      userEmail: currentUser.role === 'admin' ? undefined : currentUser.email,
      limit: QUEUE_LIMIT
    }).then(list => {
      setErrorVobs(list);
      setHasMore(Boolean(list.page?.has_more));
      setLoading(false);
    }).catch((err) => {
      console.error(err);
      setLoadError(err?.message || 'Could not load this data.');
      setLoading(false);
    });
  }, [currentUser.email, reloadKey]);

  // Count how many records have audit specialist remarks or returned from audit
  const returnedFromAuditCount = errorVobs.filter(v => 
    v.auditRemarks || 
    v.reassignmentReason || 
    v.reassignment_reason ||
    v.audit_stage === 'returned_to_specialist' ||
    (v.failingRules || []).some(r => r.field === 'audit_remark' || r.rule === 'audit_rejection')
  ).length;

  return (
    <div className="error-queue-view">
      <DataError message={loadError} onRetry={() => setReloadKey(k => k + 1)} />

      {/* Banner when records are returned by audit specialist */}
      {returnedFromAuditCount > 0 && (
        <div className="audit-returned-alert">
          <span className="audit-alert-icon" aria-hidden="true">🛡️</span>
          <div className="audit-alert-text">
            <strong>{returnedFromAuditCount} Record{returnedFromAuditCount === 1 ? '' : 's'} Returned with Audit Remarks:</strong>
            <span> Review the audit specialist's remarks in the logs for required corrections, update the fields, and resubmit.</span>
          </div>
        </div>
      )}

      <div className="panel-card">
        <div className="panel-header">
          <div>
            <h3>Validation Error Queue (U4, U5, FR-9)</h3>
            <span className="panel-sub">VOB records rejected by client-specific validation rules or returned by Audit Specialist. Review logs, correct failing fields, and resubmit.</span>
          </div>
          <div className="error-pill-count">
            {errorVobs.length} Records Need Correction
          </div>
        </div>

        <QueueFilterBar {...filterBar} shown={filtered.length} total={errorVobs.length} />

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Record ID</th>
                <th>Client</th>
                <th>Patient Name</th>
                <th>Service Type</th>
                <th>Insurance / Payer</th>
                <th>Failing Rule(s) / Remarks</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" className="table-empty">Loading Error Queue...</td></tr>
              ) : loadError ? (
                <tr><td colSpan="7" className="table-empty">Could not load this data.</td></tr>
              ) : errorVobs.length === 0 ? (
                <tr><td colSpan="7" className="table-empty">Clean slate! Zero validation errors in your queue.</td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="7" className="table-empty">
                    No records match your search and filters.{' '}
                    <button type="button" className="btn-action-link" onClick={filterBar.clear}>Clear filters</button>
                  </td>
                </tr>
              ) : (
                filtered.map(v => {
                  const auditRemark =
                    v.auditRemarks ||
                    v.reassignmentReason ||
                    v.reassignment_reason ||
                    v.extra?.auditRemarks ||
                    (v.failingRules || []).find(r => r.field === 'audit_remark' || r.rule === 'audit_rejection' || r.code === 'reviewer_remark')?.message;

                  const otherRules = (v.failingRules || []).filter(
                    r => r.field !== 'audit_remark' && r.rule !== 'audit_rejection'
                  );

                  return (
                    <tr key={v.id} className="row-has-error">
                      <td className="mono bold red">{v.id}</td>
                      <td><ClientBadge clientId={v.clientName || v.client} /></td>
                      <td>
                        <div className="bold">{v.patientName}</div>
                        <div className="patient-sub-cell">DOB: {v.dob}</div>
                      </td>
                      <td>
                        <div>{v.appointmentType || 'Physical Therapy'}</div>
                        {v.dos && <div className="patient-sub-cell">DOS: {v.dos}</div>}
                      </td>
                      <td>{v.insurance}</td>
                      <td>
                        <div className="failing-reasons-cell">
                          {/* Prominent Audit Specialist Remark Callout */}
                          {auditRemark && (
                            <div
                              className="audit-remark-cell-box"
                              onClick={() => setSelectedLogVob(v)}
                              title="Click to view full correction logs and audit trail"
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => { if (e.key === 'Enter') setSelectedLogVob(v); }}
                            >
                              <div className="audit-remark-cell-header">
                                <span className="audit-remark-badge">🛡️ Audit Specialist Remark</span>
                                <span className="audit-remark-link">Logs ↗</span>
                              </div>
                              <div className="audit-remark-cell-text">"{auditRemark}"</div>
                            </div>
                          )}

                          {/* Standard validation failing rules */}
                          {otherRules.length > 0 ? (
                            otherRules.map((r, i) => (
                              <div key={i} className="failing-reason-tag">
                                <strong>{failureLabel(r)}:</strong> {r.message}
                              </div>
                            ))
                          ) : !auditRemark ? (
                            <div className="failing-reason-tag">Required client fields incomplete</div>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="btn btn-sm btn-danger-action"
                            onClick={() => openVerification(v.id)}
                            title="Open verification form to correct fields"
                          >
                            Correct & Resubmit &rarr;
                          </button>

                          <button
                            type="button"
                            className="btn btn-sm btn-logs-action"
                            onClick={() => setSelectedLogVob(v)}
                            title="View audit specialist remarks and full change logs"
                          >
                            📋 Logs
                          </button>

                          <button
                            type="button"
                            className="btn btn-sm"
                            style={{ background: 'transparent', border: '1px solid var(--rule, #cbd5e1)', color: 'var(--text, #1e293b)' }}
                            onClick={() => setReassignVob(v)}
                            title="Reassign to another specialist"
                          >
                            Reassign
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {hasMore && (
          <p className="card-detail-footnote">Showing the {QUEUE_LIMIT} most recent records; search and filters cover these.</p>
        )}
      </div>

      {/* Logs Modal for Viewing Audit Remarks & History */}
      <CorrectionLogsModal
        vob={selectedLogVob}
        isOpen={Boolean(selectedLogVob)}
        onClose={() => setSelectedLogVob(null)}
        onCorrect={(id) => openVerification(id)}
      />

      {/* Reassign Modal */}
      <ReassignModal
        vob={reassignVob}
        isOpen={Boolean(reassignVob)}
        onClose={() => setReassignVob(null)}
        onSuccess={() => setReloadKey(k => k + 1)}
      />
    </div>
  );
}
