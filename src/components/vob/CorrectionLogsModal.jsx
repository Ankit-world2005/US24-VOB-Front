import React, { useState, useEffect } from 'react';
import { vobsApi } from '../../api/vobs';
import { ClientBadge } from './ClientBadge';
import { failureLabel } from '../../data/clients';
import { TaskLogTimeline } from './TaskLogTimeline';
import { timeAgo } from '../../utils/timeAgo';
import { useNow } from '../../hooks/useNow';

export function CorrectionLogsModal({ vob, isOpen, onClose, onCorrect }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fullVob, setFullVob] = useState(null);
  const now = useNow(10000);

  useEffect(() => {
    if (!isOpen || !vob?.id) return;

    let isMounted = true;
    setLoading(true);
    setError('');

    // Fetch both fresh single VOB and audit history logs in parallel
    Promise.allSettled([
      vobsApi.getVobById(vob.id),
      vobsApi.getAudit(vob.id)
    ]).then(([vobResult, auditResult]) => {
      if (!isMounted) return;

      if (vobResult.status === 'fulfilled') {
        setFullVob(vobResult.value);
      } else {
        setFullVob(vob);
      }

      if (auditResult.status === 'fulfilled') {
        setLogs(auditResult.value || []);
      } else {
        console.warn('[CorrectionLogsModal] Could not fetch audit history:', auditResult.reason);
        // Fallback: we still show the VOB's recorded remarks and failing rules
        setLogs([]);
      }
      setLoading(false);
    }).catch(err => {
      if (!isMounted) return;
      console.error(err);
      setError(err?.message || 'Could not load correction logs.');
      setLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [isOpen, vob?.id]);

  if (!isOpen || !vob) return null;

  const currentVob = fullVob || vob;

  // Extract auditor remark from all potential sources
  const auditorRemark =
    currentVob.auditRemarks ||
    currentVob.reassignmentReason ||
    currentVob.reassignment_reason ||
    currentVob.extra?.auditRemarks ||
    currentVob.document_check?.remark ||
    (currentVob.failingRules || []).find(r => r.field === 'audit_remark' || r.rule === 'audit_rejection' || r.code === 'reviewer_remark')?.message ||
    (logs || []).find(l => l.reason || l.field === 'reassignment_reason')?.reason ||
    null;

  // Failing validation rules
  const rules = (currentVob.failingRules || []).filter(
    r => r.field !== 'audit_remark' && r.rule !== 'audit_rejection'
  );

  const auditorName =
    currentVob.previousAssignee?.name ||
    currentVob.previous_assignee?.name ||
    currentVob.previous_assignee_id ||
    (logs || []).find(l => l.action === 'reassign' || l.reason)?.user ||
    'Audit Specialist';

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-container correction-logs-modal"
        style={{ maxWidth: '680px', width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <div>
            <div className="modal-eyebrow" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="badge badge-warning" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Correction & Audit Logs
              </span>
              <span className="mono bold red">{currentVob.id}</span>
            </div>
            <h3 className="modal-title" style={{ margin: '4px 0 0 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>{currentVob.patientName}</span>
              <ClientBadge clientId={currentVob.clientName || currentVob.client} />
            </h3>
          </div>
          <button
            type="button"
            className="drawer-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div
          className="modal-body"
          style={{
            padding: '20px 24px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px'
          }}
        >
          {/* Quick Info Strip */}
          <div className="correction-info-strip">
            <div>
              <span className="correction-info-lbl">Date of Service:</span>
              <span className="correction-info-val bold">{currentVob.dos || '—'}</span>
            </div>
            <div>
              <span className="correction-info-lbl">Insurance:</span>
              <span className="correction-info-val">{currentVob.insurance || '—'}</span>
            </div>
            <div>
              <span className="correction-info-lbl">Assigned To:</span>
              <span className="correction-info-val">{currentVob.assignedTo || currentVob.assignee?.name || 'Specialist Queue'}</span>
            </div>
          </div>

          {/* Prominent Audit Specialist Directive / Remark Card */}
          {auditorRemark ? (
            <div className="audit-directive-card">
              <div className="audit-directive-header">
                <div className="audit-directive-title-row">
                  <span className="audit-shield-icon" aria-hidden="true">🛡️</span>
                  <div>
                    <h4 className="audit-directive-title">Audit Specialist Correction Directive</h4>
                    <span className="audit-directive-by">
                      Returned by <strong>{auditorName}</strong>
                      {currentVob.reassignedAt && ` · ${timeAgo(currentVob.reassignedAt, now)}`}
                    </span>
                  </div>
                </div>
                <span className="badge badge-danger" style={{ fontSize: '10.5px' }}>
                  Action Required
                </span>
              </div>
              <div className="audit-directive-quote">
                <p>"{auditorRemark}"</p>
              </div>
              <div className="audit-directive-instructions">
                <span>💡 <strong>Correction Action:</strong> Please correct the flagged fields on the original VOB verification form and resubmit.</span>
              </div>
            </div>
          ) : (
            <div className="audit-directive-card system-notice">
              <div className="audit-directive-header">
                <div className="audit-directive-title-row">
                  <span className="audit-shield-icon" aria-hidden="true">⚠️</span>
                  <div>
                    <h4 className="audit-directive-title">Validation Error Notification</h4>
                    <span className="audit-directive-by">Automated Rule Engine Rejection</span>
                  </div>
                </div>
              </div>
              <div className="audit-directive-quote">
                <p>Required client fields are incomplete or inconsistent with insurance rules. Review failing rules below.</p>
              </div>
            </div>
          )}

          {/* Failing Fields Section */}
          {rules.length > 0 && (
            <div className="failing-fields-panel">
              <div className="panel-subhead">
                <h5>Failing Validation Rules ({rules.length})</h5>
                <span className="panel-sub">Fields rejected by client QA policy</span>
              </div>
              <div className="failing-reasons-grid">
                {rules.map((r, i) => (
                  <div key={i} className="failing-reason-card">
                    <span className="failing-field-name">{failureLabel(r)}</span>
                    <span className="failing-field-desc">{r.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Full Activity / Audit Trail Logs */}
          <div className="task-log-section" style={{ marginTop: '6px' }}>
            <div className="task-log-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h4>Audit Trail & Change Logs</h4>
                <span className="badge badge-neutral" style={{ fontSize: '11px' }}>
                  {loading ? '...' : `${logs.length} Event${logs.length === 1 ? '' : 's'}`}
                </span>
              </div>
              <span className="panel-sub">Immutable compliance log (HIPAA BAA)</span>
            </div>

            {loading ? (
              <div className="task-log-empty" style={{ padding: '24px 0' }}>
                <span className="spinner-sm" style={{ marginRight: '8px' }} />
                Loading audit logs and change history...
              </div>
            ) : error ? (
              <div className="task-log-empty red">{error}</div>
            ) : logs.length === 0 ? (
              <div className="task-log-empty">
                No prior field changes recorded yet. Auditor rejection remark is logged above.
              </div>
            ) : (
              <div className="task-log-scroll-wrap" style={{ maxHeight: '240px', overflowY: 'auto' }}>
                <TaskLogTimeline entries={logs} freshIds={new Set()} now={now} />
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer with Direct "Correct in Form" CTA */}
        <div
          className="modal-footer"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 24px',
            borderTop: '1px solid var(--rule, #e2e8f0)',
            background: 'var(--surface-2, #f8fafc)'
          }}
        >
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
          >
            Close
          </button>

          <button
            type="button"
            className="btn btn-danger-action"
            style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            onClick={() => {
              onClose();
              onCorrect?.(currentVob.id);
            }}
          >
            <span>Correct & Resubmit in Form</span>
            <span aria-hidden="true">&rarr;</span>
          </button>
        </div>
      </div>
    </div>
  );
}
