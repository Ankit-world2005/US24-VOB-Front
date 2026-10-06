import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useVobForm } from '../../hooks/useVobForm';
import { VobFormBanner } from '../../components/vob/VobFormBanner';
import { VobFormSections } from '../../components/vob/VobFormSections';
import { VobDocumentPane } from '../../components/vob/VobDocumentPane';
import { CallVerificationPanel } from '../../components/vob/CallVerificationPanel';
import { useTranscriptExtraction, TranscriptExtractBody, TranscriptExtractActions } from '../../components/vob/TranscriptExtractPanel';
import { readVobDocument, documentKind } from '../../utils/vobDocumentParser';
import { crossCheck, samePatient, documentCheckFor } from '../../utils/vobCompare';

/**
 * One of the Queue tab's side panes. Hidden, it shrinks to a rail that
 * brings it back; its state lives in the screen, so hiding loses nothing.
 */
function QueuePane({ id, icon, title, summary, open, onToggle, className, children }) {
  if (!open) {
    return (
      <aside className={`queue-pane is-hidden ${className}`} id={id}>
        <button type="button" className="queue-pane-rail" onClick={onToggle} title={`Show ${title.toLowerCase()}`}>
          <span aria-hidden="true">{icon}</span>
          <span className="queue-pane-rail-label">{title}</span>
        </button>
      </aside>
    );
  }
  return (
    <aside className={`queue-pane ${className}`} id={id}>
      <div className="queue-pane-head">
        <div>
          <h3 className="queue-pane-title">{icon} {title}</h3>
          {summary && <span className="queue-pane-summary">{summary}</span>}
        </div>
        <button type="button" className="btn btn-sm ghost" onClick={onToggle}>Hide</button>
      </div>
      <div className="queue-pane-body">{children}</div>
    </aside>
  );
}

/**
 * The Queue tab for one VOB: the call transcript on the left fills the form in
 * the middle, and the VOB someone already made, on the right, is cross-checked
 * against it. Submitting sends any wrong or blank answers to the Error Queue,
 * each with its remark; a VOB that matches is routed as on New Verification.
 *
 * Keyed on the VOB by QueueView, so a transcript or document never carries
 * over to another patient.
 */
function QueueWorkspace({ form, myVobsList, activeVobId, onSwitchVob }) {
  const { showToast } = useWorkspace();
  const {
    vob,
    formData,
    provenance,
    hasTranscript,
    isSubmitting,
    failingRules,
    handleFieldChange,
    handleSelectField,
    handleApplyAiFields,
    handleSaveDraft,
    handleSubmit
  } = form;
  const inAuthQueue = vob.status === 'auth_queue';
  const [transcriptOpen, setTranscriptOpen] = useState(true);
  const [documentOpen, setDocumentOpen] = useState(true);

  // --- Call transcript: a reading fills the empty fields it is sure of straight
  // away; values whose wording needed interpreting wait for "Apply reviewed".
  const extraction = useTranscriptExtraction(vob.id);
  const { result } = extraction;
  const appliedResult = useRef(null);
  const [reviewApplied, setReviewApplied] = useState(false);

  useEffect(() => {
    if (!result || appliedResult.current === result) return;
    appliedResult.current = result;
    setReviewApplied(false);
    const sure = result.proposed.filter(p => p.isSafe);
    if (sure.length) handleApplyAiFields(Object.fromEntries(sure.map(p => [p.key, p.value])));
  }, [result, handleApplyAiFields]);

  const toReview = result ? result.proposed.filter(p => !p.isSafe) : [];
  const filledCount = result ? result.proposed.length - toReview.length : 0;
  const transcriptSummary = inAuthQueue
    ? 'Locked while the VOB is in the Auth Queue'
    : !result
      ? 'Paste the payer call to fill the form'
      : `Filled ${filledCount} value${filledCount === 1 ? '' : 's'}${toReview.length && !reviewApplied ? ` · ${toReview.length} to review` : ''}`;

  const showTranscript = useCallback(() => {
    setTranscriptOpen(true);
    setTimeout(() => {
      const pane = document.getElementById('queue-transcript');
      pane?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      pane?.querySelector('textarea')?.focus();
    }, 50);
  }, []);

  // --- Existing VOB: read in the browser, never uploaded.
  const [doc, setDoc] = useState(null);
  const latestRead = useRef(null);

  const loadDocument = useCallback(async (file) => {
    let kind;
    try {
      kind = documentKind(file);
    } catch (err) {
      showToast(err.message, 'error');
      return;
    }
    const read = {};
    latestRead.current = read;
    setDocumentOpen(true);
    setDoc({ file, name: file.name, kind, url: kind === 'pdf' ? URL.createObjectURL(file) : null, status: 'reading' });
    try {
      const found = await readVobDocument(file);
      if (latestRead.current === read) setDoc(d => ({ ...d, ...found, status: 'ready' }));
    } catch (err) {
      if (latestRead.current === read) setDoc(d => ({ ...d, status: 'failed', error: err.message }));
    }
  }, [showToast]);

  // A PDF opens from an object URL, let go of when the document is replaced or the tab closes.
  const docUrl = doc?.url;
  useEffect(() => () => { if (docUrl) URL.revokeObjectURL(docUrl); }, [docUrl]);

  // A file pasted anywhere on the tab is taken as the existing VOB; pasted text is left alone.
  useEffect(() => {
    const onPaste = (e) => {
      const file = e.clipboardData?.files?.[0];
      if (!file) return;
      e.preventDefault();
      loadDocument(file);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [loadDocument]);

  // --- Cross-check, live as the form changes.
  const readable = doc?.status === 'ready' && doc.readable;
  const patient = useMemo(() => (readable ? samePatient(formData, doc.fields) : null), [readable, doc, formData]);
  const check = useMemo(
    () => (patient?.ok ? crossCheck(formData, doc.fields, provenance) : null),
    [patient, doc, formData, provenance]
  );
  const fieldStatus = useMemo(
    () => (check ? Object.fromEntries(check.results.map(r => [r.key, r])) : undefined),
    [check]
  );

  const documentSummary = !doc
    ? 'Drop the VOB made for this patient'
    : doc.status === 'reading'
      ? 'Reading…'
      : check
        ? (check.errors ? `${check.errors} to fix` : 'Every checked field matches')
        : 'Can’t be cross-checked';

  const blockedReason = !doc
    ? 'Drop the existing VOB first'
    : doc.status === 'reading'
      ? 'Reading the document…'
      : !check
        ? 'This document can’t be cross-checked; see the right pane'
        : null;

  const layoutClass = `queue-layout${transcriptOpen ? '' : ' transcript-hidden'}${documentOpen ? '' : ' document-hidden'}`;

  return (
    <div className="verification-form-view queue-view">
      <VobFormBanner
        vob={vob}
        formData={formData}
        myVobsList={myVobsList}
        activeVobId={activeVobId}
        onSwitchVob={onSwitchVob}
      />

      <div className={layoutClass}>
        <QueuePane
          id="queue-transcript"
          className="queue-pane-transcript"
          icon="📝"
          title="Call transcript"
          summary={transcriptSummary}
          open={transcriptOpen}
          onToggle={() => setTranscriptOpen(o => !o)}
        >
          {inAuthQueue ? (
            <p className="queue-doc-note">The transcript was read before this VOB reached the Auth Queue. Only the authorization fields are open now.</p>
          ) : (
            <>
              <TranscriptExtractBody extraction={extraction} />
              <div className="queue-pane-actions">
                {!result ? (
                  <TranscriptExtractActions extraction={extraction} onApply={handleApplyAiFields} />
                ) : (
                  <>
                    <button type="button" className="btn btn-sm ghost" onClick={extraction.clear}>
                      New transcript
                    </button>
                    {toReview.length > 0 && !reviewApplied && (
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => {
                          handleApplyAiFields(Object.fromEntries(toReview.map(p => [p.key, p.value])));
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
            </>
          )}
        </QueuePane>

        <div className="queue-fields">
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
            fieldStatus={fieldStatus}
          />
        </div>

        <QueuePane
          id="queue-document"
          className="queue-pane-document"
          icon="🧾"
          title="Existing VOB"
          summary={documentSummary}
          open={documentOpen}
          onToggle={() => setDocumentOpen(o => !o)}
        >
          <VobDocumentPane
            doc={doc}
            patient={patient}
            check={check}
            formData={formData}
            onFile={loadDocument}
            onRemove={() => { latestRead.current = null; setDoc(null); }}
            onSelectField={handleSelectField}
          />
        </QueuePane>
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
          {!inAuthQueue && check && (
            <span className={`queue-submit-hint hide-md ${check.errors ? 'has-errors' : ''}`}>
              {check.errors
                ? `✗ ${check.errors} field${check.errors === 1 ? '' : 's'} will go to the Error Queue with remarks`
                : '✓ Every checked field matches the document'}
            </span>
          )}
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
              onClick={() => handleSubmit()}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Validating against Client Rules…' : '✓ Submit Authorization'}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-submit-vob"
              onClick={() => handleSubmit({ documentCheck: documentCheckFor(doc.name, check) })}
              disabled={isSubmitting || Boolean(blockedReason)}
              title={blockedReason || 'Submit; wrong or blank answers go to the Error Queue with remarks'}
            >
              {isSubmitting ? 'Submitting…' : 'Cross-check & Submit →'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function QueueView() {
  const { activeVobId, setActiveVobId, setActiveTab } = useWorkspace();
  const form = useVobForm();

  if (form.loading) {
    return <div className="panel-card"><div className="loading-spinner-wrap">Loading VOB Verification Form…</div></div>;
  }

  if (!form.vob) {
    return (
      <div className="panel-card empty-state">
        <h3>No VOB Record Selected</h3>
        <p>Please select an assigned VOB from your dashboard queue to begin verification.</p>
        <button type="button" className="btn" onClick={() => setActiveTab('my_dashboard')}>Go to My Dashboard</button>
      </div>
    );
  }

  return (
    <QueueWorkspace
      key={form.vob.id}
      form={form}
      myVobsList={form.myVobsList}
      activeVobId={activeVobId}
      onSwitchVob={setActiveVobId}
    />
  );
}
