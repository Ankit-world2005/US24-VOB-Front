/**
 * A submitted VOB's audit, as the API reports it.
 *
 * Submit puts a specialist's VOB in `pending_audit`, where every audit
 * specialist sees it. The first audit action takes it out (`audited` or
 * `returned_to_specialist`), and the API refuses any later one with
 * `already_audited`.
 */

const SUBMITTED_FOR_AUDIT = 'Submitted for Audit Verification';

/** True while the VOB waits on an audit specialist. */
export function isAwaitingAudit(v) {
  if (!v) return false;
  const stage = v.auditStage || v.audit_stage || v.extra?.auditStage;
  if (stage) return stage === 'pending_audit';
  // A row without a stage: the reason submit wrote when it routed it to audit.
  return v.reassignmentReason === SUBMITTED_FOR_AUDIT || v.reassignment_reason === SUBMITTED_FOR_AUDIT;
}

/** Each audit action as the audit specialist picked it in the Audit Queue. */
export const AUDIT_ACTION_LABELS = {
  verified_auth_queue: '✓ Verified → Specialist Auth Queue',
  verified_approved: '✓ Verified → Approved Records',
  returned_to_specialist: '↩ Returned to Specialist (Error Tab)'
};

/** Where the action sent the VOB. */
export const AUDIT_RESULT_LABELS = {
  auth_queue: "Specialist's Auth Queue",
  approved: "Specialist's Approved Records",
  error: "Specialist's Error Queue"
};

/**
 * The toast for an audit action refused because the VOB no longer waits on
 * audit: another audit specialist acted first. Null for any other error.
 */
export function auditTakenMessage(err, vobId) {
  if (err?.status === 409 && err?.data?.error?.code === 'already_audited') {
    return `${vobId}: ${err.message} It has left the pending audit list.`;
  }
  // Returned by another auditor, the VOB can leave this auditor's sight altogether.
  if (err?.status === 404) return `${vobId} is no longer waiting on audit.`;
  return null;
}
