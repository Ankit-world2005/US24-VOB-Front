import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useVobForm } from '../../hooks/useVobForm';
import { VobFormBanner } from '../../components/vob/VobFormBanner';
import { VobFormSections } from '../../components/vob/VobFormSections';
import { ParkerLivePreview } from '../../components/vob/ParkerLivePreview';
import { CallVerificationPanel } from '../../components/vob/CallVerificationPanel';
import { useTranscriptExtraction, TranscriptExtractBody, TranscriptExtractActions } from '../../components/vob/TranscriptExtractPanel';

/** This screen's right pane is the existing VOB document, so the toggle names it. */
const LAYOUT_MODES = [
  { id: 'split', label: '◫ Split View', title: 'Side-by-side: Form & existing VOB document' },
  { id: 'form', label: '▤ Form Only', title: 'Transcript & form only' },
  { id: 'preview', label: '🧾 Document', title: 'Existing VOB document only' }
];

/**
 * Step 1, on the left: the call transcript, read by the AI into the form.
 *
 * A reading fills the empty fields it is sure of straight away. Values whose
 * wording needed interpreting wait for the specialist, as do conflicts with
 * values already on the form, which are never overwritten.
 *
 * Mounted per VOB (keyed on its id by the screen), so a transcript never
 * carries over to another patient.
 */
function TranscriptStep({ vobId, open, onToggle, locked, onApply }) {
  const extraction = useTranscriptExtraction(vobId);
  const { result, clear } = extraction;
  const appliedResult = useRef(null);
  const [reviewApplied, setReviewApplied] = useState(false);

  useEffect(() => {
    if (!result || appliedResult.current === result) return;
    appliedResult.current = result;
    setReviewApplied(false);
    const sure = result.proposed.filter(p => p.isSafe);
    if (sure.length) onApply(Object.fromEntries(sure.map(p => [p.key, p.value])));
  }, [result, onApply]);

  const toReview = result ? result.proposed.filter(p => !p.isSafe) : [];
  const filledCount = result ? result.proposed.length - toReview.length : 0;

  const summary = locked
    ? 'Locked while the VOB is in the Auth Queue'
    : !result
      ? 'Paste the payer call transcript to fill the form'
      : `Filled ${filledCount} value${filledCount === 1 ? '' : 's'}${toReview.length && !reviewApplied ? ` · ${toReview.length} to review` : ''}`;

  return (
    <div className="form-section-card doc-verify-step" id="doc-verify-transcript">
      <div className="doc-verify-step-head">
        <div>
          <h3 className="group-heading">1. Call transcript</h3>
          <span className="doc-verify-step-summary">{summary}</span>
        </div>
        {!locked && (
          <button type="button" className="btn btn-sm ghost" onClick={onToggle} aria-expanded={open}>
            {open ? 'Hide' : 'Show'}
          </button>
        )}
      </div>

      {open && !locked && (
        <div className="doc-verify-step-body">
          <TranscriptExtractBody extraction={extraction} />

          <div className="doc-verify-step-actions">
            {!result ? (
              <TranscriptExtractActions extraction={extraction} onApply={onApply} />
            ) : (
              <>
                <button type="button" className="btn btn-sm ghost" onClick={clear}>
                  New transcript
                </button>
                {toReview.length > 0 && !reviewApplied && (
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => {
                      onApply(Object.fromEntries(toReview.map(p => [p.key, p.value])));
                      setReviewApplied(true);
                    }}
                    title="Values marked ⚠ above: the payer's words needed interpreting"
                  >
                    Apply {toReview.length} reviewed value{toReview.length === 1 ? '' : 's'}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Step 2, on the right: the VOB document someone already made, which the form
 * is checked against. The Live Preview shows the form itself as a document.
 */
function DocumentPane({ formData }) {
  const [view, setView] = useState('document'); // 'document' | 'preview'

  return (
    <div className="doc-verify-pane">
      <div className="layout-toggle-group doc-verify-pane-switch">
        <button
          type="button"
          className={`layout-btn ${view === 'document' ? 'active' : ''}`}
          onClick={() => setView('document')}
        >
          🧾 Existing VOB
        </button>
        <button
          type="button"
          className={`layout-btn ${view === 'preview' ? 'active' : ''}`}
          onClick={() => setView('preview')}
        >
          📄 Live Preview
        </button>
      </div>

      {view === 'document' ? (
        <div className="parker-preview-card">
          <div className="parker-preview-header">
            <div>
              <h3 className="preview-title">2. Existing VOB document</h3>
              <p className="preview-subtitle">Each field is checked against the transcript on the left.</p>
            </div>
          </div>
          <div className="doc-drop-placeholder">
            <strong>Reading .docx and .pdf VOBs is being built.</strong>
            <span>Until then, use Live Preview to see this form as a document.</span>
          </div>
        </div>
      ) : (
        <ParkerLivePreview formData={formData} />
      )}
    </div>
  );
}

export function DocumentVerificationView() {
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
    handleSubmit
  } = useVobForm();
  const [transcriptOpen, setTranscriptOpen] = useState(true);

  const showTranscript = useCallback(() => {
    setLayoutMode(mode => (mode === 'preview' ? 'split' : mode));
    setTranscriptOpen(true);
    setTimeout(() => {
      document.getElementById('doc-verify-transcript')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }, [setLayoutMode]);

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
    <div className="verification-form-view doc-verification-view">
      <VobFormBanner
        vob={vob}
        formData={formData}
        layoutMode={layoutMode}
        onLayoutChange={setLayoutMode}
        layoutModes={LAYOUT_MODES}
        myVobsList={myVobsList}
        activeVobId={activeVobId}
        onSwitchVob={setActiveVobId}
      />

      <div className={`verification-split-layout mode-${layoutMode}`}>
        {/* LEFT PANE: Transcript + Form Inputs */}
        {(layoutMode === 'split' || layoutMode === 'form') && (
          <div className="verification-left-pane">
            <TranscriptStep
              key={vob.id}
              vobId={vob.id}
              open={transcriptOpen}
              onToggle={() => setTranscriptOpen(o => !o)}
              locked={inAuthQueue}
              onApply={handleApplyAiFields}
            />

            <CallVerificationPanel
              formData={formData}
              hasTranscript={hasTranscript}
              onOpenTranscript={inAuthQueue ? undefined : showTranscript}
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

        {/* RIGHT PANE: Existing VOB document */}
        {(layoutMode === 'split' || layoutMode === 'preview') && (
          <div className="verification-right-pane">
            <DocumentPane formData={formData} />
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

        <div className="action-bar-right">
          <button
            type="button"
            className="btn ghost"
            onClick={handleSaveDraft}
          >
            💾 Save Draft
          </button>
          {inAuthQueue ? (
            // The document was checked before the VOB got here; what is left is the
            // authorization section, which submits to Saved Records as on New Verification.
            <button
              type="button"
              className="btn btn-submit-vob"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Validating against Client Rules…' : '✓ Submit Authorization'}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-submit-vob"
              disabled
              title="Upload the existing VOB document first"
            >
              ✓ Verify Against Document
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
