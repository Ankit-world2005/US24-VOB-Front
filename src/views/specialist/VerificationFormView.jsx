import React, { useState } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useVobForm } from '../../hooks/useVobForm';
import { VobFormBanner } from '../../components/vob/VobFormBanner';
import { VobFormSections } from '../../components/vob/VobFormSections';
import { AiTranscriptDrawer } from '../../components/vob/AiTranscriptDrawer';
import { ParkerLivePreview } from '../../components/vob/ParkerLivePreview';
import { CallVerificationPanel } from '../../components/vob/CallVerificationPanel';
import { CorrectionLogsModal } from '../../components/vob/CorrectionLogsModal';

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
    isAuditSpecialist
  } = useVobForm();
  const [isAiDrawerOpen, setIsAiDrawerOpen] = useState(false);
  const [isLogsOpen, setIsLogsOpen] = useState(false);

  if (loading) {
    return <div className="panel-card"><div className="loading-spinner-wrap">Loading VOB Verification Form…</div></div>;
  }

  if (!vob) {
    return (
      <div className="panel-card empty-state">
        <h3>No VOB Record Selected</h3>
        <p>Please select an assigned VOB from your dashboard queue to begin verification.</p>
        <button type="button" className="btn" onClick={() => setActiveTab('my_dashboard')}>Go to My Dashboard</button>
      </div>
    );
  }

  const inAuthQueue = vob.status === 'auth_queue';

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
            : "Open transcript drawer to view, extract, and import values"}
        >
          Paste Transcript
        </button>
      </VobFormBanner>

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
          {/* Audit specialists work New Verification by Submit alone; audit approve and return live in the Audit Queue. */}
          {!isAuditSpecialist && (
            <button
              type="button"
              className="btn ghost"
              onClick={handleSaveDraft}
              disabled={isSubmitting}
            >
              💾 Save Draft
            </button>
          )}

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
        canAutoFill={true}
      />

      {/* Correction & Audit Logs Modal */}
      <CorrectionLogsModal
        vob={vob}
        isOpen={isLogsOpen}
        onClose={() => setIsLogsOpen(false)}
      />
    </div>
  );
}
