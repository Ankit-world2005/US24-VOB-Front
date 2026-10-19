import React, { useState } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useVobForm } from '../../hooks/useVobForm';
import { VobFormBanner } from '../../components/vob/VobFormBanner';
import { VobFormSections } from '../../components/vob/VobFormSections';
import { AiTranscriptDrawer } from '../../components/vob/AiTranscriptDrawer';
import { ParkerLivePreview } from '../../components/vob/ParkerLivePreview';
import { CallVerificationPanel } from '../../components/vob/CallVerificationPanel';
import { CorrectionLogsModal } from '../../components/vob/CorrectionLogsModal';
import { AuditReassignModal } from '../../components/vob/AuditReassignModal';

export function VerificationFormView() {
  const { activeVobId, setActiveVobId, setActiveTab } = useWorkspace();
  const {
    vob,
    formData,
    provenance,
    hasTranscript,
    loading,
    isSubmitting,
    failingRules,
    myVobsList,
    layoutMode,
    setLayoutMode,
    handleFieldChange,
    handleSelectField,
    handleApplyAiFields,
    handleSaveDraft,
    handleSubmit,
    handleAuditApprove,
    handleAuditReassign,
    isAuditSpecialist
  } = useVobForm();
  const [isAiDrawerOpen, setIsAiDrawerOpen] = useState(false);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);

  if (loading) {
    return <div className="panel-card"><div className="loading-spinner-wrap">Loading VOB Verification Form…</div></div>;
  }

  if (!vob) {
    return (
      <div className="panel-card empty-state">
        <h3>{isAuditSpecialist ? "No VOBs Awaiting Audit Verification" : "No VOB Record Selected"}</h3>
        <p>
          {isAuditSpecialist
            ? "There are currently no verification tasks awaiting audit review. You can check the Audit Queue or your Dashboard."
            : "Please select an assigned VOB from your dashboard queue to begin verification."}
        </p>
        <button type="button" className="btn" onClick={() => setActiveTab('my_dashboard')}>Go to My Dashboard</button>
      </div>
    );
  }

  const inAuthQueue = vob.status === 'auth_queue';
  const submittingSpecialist =
    vob?.previous_assignee?.name ||
    vob?.previous_assignee?.email ||
    vob?.previousAssignee?.name ||
    vob?.previousAssignee ||
    (vob?.previous_assignee_id ? `Specialist (${vob.previous_assignee_id})` : '') ||
    vob?.assignee?.name ||
    vob?.assignee?.email ||
    vob?.assignee_id ||
    '';

  return (
    <div className="verification-form-view">
      {/* Top Header Card */}
      <VobFormBanner
        vob={vob}
        formData={formData}
        layoutMode={layoutMode}
        onLayoutChange={setLayoutMode}
        myVobsList={myVobsList}
        activeVobId={activeVobId}
        onSwitchVob={setActiveVobId}
      >
        {(vob.status === 'error' || vob.auditRemarks || vob.reassignmentReason || vob.reassignment_reason || vob.audit_remarks || (failingRules || []).some(r => r.field === 'audit_remark')) && (
          <button
            type="button"
            className="btn btn-sm btn-logs-action"
            style={{ marginRight: '8px' }}
            onClick={() => setIsLogsOpen(true)}
            title="View audit specialist remarks and full correction logs"
          >
            📋 View Logs
          </button>
        )}
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => setIsAiDrawerOpen(true)}
          disabled={inAuthQueue}
          title={inAuthQueue
            ? "Locked while the VOB is in the Auth Queue"
            : isAuditSpecialist
              ? "Inspect and re-extract associated transcript"
              : "Paste call transcript or payer portal text to auto-fill"}
        >
          {isAuditSpecialist ? "🔍 View / Re-Extract Transcript" : "Paste Transcript"}
        </button>
      </VobFormBanner>

      {/* Prominent Audit QA Banner for Audit Specialists */}
      {isAuditSpecialist && (
        <div
          className="audit-qa-banner"
          style={{
            background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.08) 0%, rgba(99, 102, 241, 0.04) 100%)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            borderRadius: 'var(--r-md, 8px)',
            padding: '12px 18px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: '#4f46e5',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                flexShrink: 0
              }}
            >
              🛡️
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <strong style={{ color: '#312e81', fontSize: '14px' }}>
                  Audit QA Verification Mode
                </strong>
                <span
                  style={{
                    background: 'rgba(79, 70, 229, 0.12)',
                    color: '#4338ca',
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: '999px'
                  }}
                >
                  {vob.auditStage === 'pending_audit' || vob.audit_stage === 'pending_audit' || vob.extra?.auditStage === 'pending_audit'
                    ? 'Awaiting Audit Review'
                    : (vob.vobStatus || vob.status)}
                </span>
                {submittingSpecialist && (
                  <span style={{ fontSize: '12px', color: '#4b5563' }}>
                    Submitted by: <strong>{submittingSpecialist}</strong>
                  </span>
                )}
              </div>
              <p style={{ margin: '3px 0 0', fontSize: '12.5px', color: '#4b5563', lineHeight: 1.4 }}>
                Reviewing captured data against the call transcript. You can edit fields directly, re-extract the transcript, approve & complete the VOB, or return it to the specialist with error remarks.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {hasTranscript ? (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  background: 'rgba(16, 185, 129, 0.1)',
                  color: '#065f46',
                  fontSize: '12px',
                  fontWeight: 500
                }}
              >
                <span>☁️</span> Source Transcript Linked
              </span>
            ) : (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  background: 'rgba(245, 158, 11, 0.1)',
                  color: '#92400e',
                  fontSize: '12px',
                  fontWeight: 500
                }}
              >
                <span>⚠️</span> No Transcript Attached
              </span>
            )}
          </div>
        </div>
      )}

      {/* Main Dual-Pane Workspace Container */}
      <div className={`verification-split-layout mode-${layoutMode}`}>
        {/* LEFT PANE: Call Verification Panel + Form Inputs */}
        {(layoutMode === 'split' || layoutMode === 'form') && (
          <div className="verification-left-pane">
            {/* Call Verification Panel (Image 1 reference) */}
            <CallVerificationPanel
              formData={formData}
              hasTranscript={hasTranscript}
              onOpenTranscript={() => setIsAiDrawerOpen(true)}
              onSelectField={handleSelectField}
            />

            <VobFormSections
              formData={formData}
              provenance={provenance}
              failingRules={failingRules}
              inAuthQueue={inAuthQueue}
              onFieldChange={handleFieldChange}
            />
          </div>
        )}

        {/* RIGHT PANE: Live Preview of Parker VOB Document (Image 2 reference) */}
        {(layoutMode === 'split' || layoutMode === 'preview') && (
          <div className="verification-right-pane">
            <ParkerLivePreview formData={formData} />
          </div>
        )}
      </div>

      {/* Floating Bottom Sticky Action Bar */}
      <div className="sticky-action-bar">
        <div className="action-bar-left">
          <span className="provenance-legend hide-sm">
            Provenances:
            <span className="legend-chip blue">Recent VOB</span>
            <span className="legend-chip purple">Master Data</span>
            <span className="legend-chip green">AI Transcript</span>
          </span>
        </div>

        <div className="action-bar-right" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            type="button"
            className="btn ghost"
            onClick={handleSaveDraft}
            disabled={isSubmitting}
          >
            💾 Save Draft
          </button>

          {isAuditSpecialist ? (
            <>
              <button
                type="button"
                className="btn"
                style={{
                  backgroundColor: '#dc2626',
                  borderColor: '#dc2626',
                  color: '#ffffff',
                  fontWeight: 600,
                  padding: '10px 18px',
                  borderRadius: 'var(--r-md, 6px)'
                }}
                onClick={() => setIsReassignModalOpen(true)}
                disabled={isSubmitting}
                title="Return this record back to the submitting specialist with error remarks"
              >
                ↩ Reassign to Specialist (Error Tab)
              </button>
              <button
                type="button"
                className="btn"
                style={{
                  backgroundColor: '#059669',
                  borderColor: '#059669',
                  color: '#ffffff',
                  fontWeight: 600,
                  padding: '10px 22px',
                  borderRadius: 'var(--r-md, 6px)'
                }}
                onClick={handleAuditApprove}
                disabled={isSubmitting}
                title="Approve this VOB as verified. Moves to Auth Queue if auth required, or Saved Records if completed."
              >
                {isSubmitting ? 'Verifying & Completing…' : '✓ Approve & Complete VOB (Verified)'}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn btn-submit-vob"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting
                ? (inAuthQueue ? 'Completing Authorization…' : 'Submitting for Audit Verification…')
                : (inAuthQueue ? '✓ Complete Authorization & Approve' : '✓ Submit VOB for Audit')}
            </button>
          )}
        </div>
      </div>

      {/* AI Transcript Auto-Fill Slide-out Drawer */}
      <AiTranscriptDrawer
        isOpen={isAiDrawerOpen}
        onClose={() => setIsAiDrawerOpen(false)}
        vobId={activeVobId}
        initialTranscript={formData.transcript || formData.transcriptText || vob.transcript || ''}
        transcriptFileName={formData.transcriptFileName || vob.transcriptFileName || ''}
        onApplyFields={handleApplyAiFields}
        canAutoFill={!isAuditSpecialist}
      />

      {/* Correction & Audit Logs Modal */}
      <CorrectionLogsModal
        vob={vob}
        isOpen={isLogsOpen}
        onClose={() => setIsLogsOpen(false)}
      />

      {/* Audit Reassignment Modal for returning VOB to Specialist with Remarks */}
      {isAuditSpecialist && (
        <AuditReassignModal
          isOpen={isReassignModalOpen}
          onClose={() => setIsReassignModalOpen(false)}
          vob={vob}
          onConfirm={async (remarks) => {
            await handleAuditReassign(remarks);
            setIsReassignModalOpen(false);
          }}
          isSubmitting={isSubmitting}
        />
      )}
    </div>
  );
}
