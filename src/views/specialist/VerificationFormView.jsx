import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { vobsApi } from '../../api/vobs';
import { StatusBadge } from '../../components/vob/StatusBadge';
import { ClientBadge } from '../../components/vob/ClientBadge';
import { ProvenanceBadge } from '../../components/vob/ProvenanceBadge';
import { AiTranscriptDrawer } from '../../components/vob/AiTranscriptDrawer';
import { ParkerLivePreview } from '../../components/vob/ParkerLivePreview';
import { CallVerificationPanel } from '../../components/vob/CallVerificationPanel';
import { CANONICAL_FIELDS, getVerificationProgress } from '../../data/clients';
import { formKeyFor } from '../../utils/vobAdapter';

/** The form's Authorization & Referral section: all an Auth Queue VOB can still change. */
const AUTH_FIELD_KEYS = CANONICAL_FIELDS.filter(f => f.group === 'auth').map(f => f.key);

/** Fast O(1) canonical fields lookup */
const CANONICAL_FIELDS_BY_KEY = new Map(CANONICAL_FIELDS.map(f => [f.key, f]));

/**
 * One section per block of the Parker document, in the order it reads.
 * Computed statically once at module load to avoid 10 array filters on every keystroke.
 */
const FIELD_GROUPS = [
  { id: 'patient', title: 'I. Patient (rows 1–2)', fields: CANONICAL_FIELDS.filter(f => f.group === 'patient') },
  { id: 'insurance', title: 'II. Insurance & Policy (row 3)', fields: CANONICAL_FIELDS.filter(f => f.group === 'insurance') },
  { id: 'coverage', title: 'III. Plan, Network & Dates (row 4)', fields: CANONICAL_FIELDS.filter(f => f.group === 'coverage') },
  { id: 'costshare', title: 'IV. Co-pay & Deductible (row 5)', fields: CANONICAL_FIELDS.filter(f => f.group === 'costshare') },
  { id: 'oop', title: 'V. Co-insurance & Out of Pocket (row 6)', fields: CANONICAL_FIELDS.filter(f => f.group === 'oop') },
  { id: 'visits', title: 'VI. Visits (row 7)', fields: CANONICAL_FIELDS.filter(f => f.group === 'visits') },
  { id: 'auth', title: 'VII. Authorization & Referral (rows 8–9)', fields: CANONICAL_FIELDS.filter(f => f.group === 'auth') },
  { id: 'rep', title: 'VIII. Coordination & Rep (row 10)', fields: CANONICAL_FIELDS.filter(f => f.group === 'rep') },
  { id: 'claims', title: 'IX. Claim Filing (row 11)', fields: CANONICAL_FIELDS.filter(f => f.group === 'claims') },
  { id: 'secondary', title: 'X. Secondary Insurance (rows 12–15)', fields: CANONICAL_FIELDS.filter(f => f.group === 'secondary') }
];

export function VerificationFormView() {
  const { activeVobId, setActiveVobId, showToast, setActiveTab, currentUser } = useWorkspace();
  const [vob, setVob] = useState(null);
  const [formData, setFormData] = useState({});
  const [provenance, setProvenance] = useState({});
  const [isAiDrawerOpen, setIsAiDrawerOpen] = useState(false);
  const [hasTranscript, setHasTranscript] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [failingRules, setFailingRules] = useState([]);
  const [myVobsList, setMyVobsList] = useState([]);
  const [layoutMode, setLayoutMode] = useState('split'); // 'split' | 'form' | 'preview'

  useEffect(() => {
    let isCurrent = true;
    vobsApi.getVobs({ userEmail: currentUser.email }).then(list => {
      if (!isCurrent) return;
      setMyVobsList(list);
      if (!activeVobId && list.length > 0) {
        setActiveVobId(list[0].id);
      }
    });
    return () => { isCurrent = false; };
  }, [currentUser.email]);

  useEffect(() => {
    if (activeVobId) {
      let isCurrent = true;
      setLoading(true);
      setFailingRules([]);
      vobsApi.getVobById(activeVobId).then(data => {
        if (!isCurrent) return;
        setVob(data);
        setFormData(data);
        setProvenance(data.provenance || {});
        setHasTranscript(Boolean(data.transcriptText || (data.provenance && Object.values(data.provenance).some(p => p.source === 'ai'))));
        if (data.failingRules) {
          setFailingRules(data.failingRules);
        }
        setLoading(false);
      }).catch(err => {
        console.error(err);
        if (isCurrent) setLoading(false);
      });
      return () => { isCurrent = false; };
    }
  }, [activeVobId]);

  const handleFieldChange = useCallback((key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    // Update provenance to manual for edited fields
    setProvenance(prev => ({
      ...prev,
      [key]: { source: 'manual' }
    }));
    // Clear failing error if field is updated (mapping backend field name if present)
    setFailingRules(prev => prev.filter(r => (formKeyFor(r.field) || r.field) !== key && r.field !== key));
  }, []);

  const handleSelectField = useCallback((fieldKey) => {
    // If preview-only mode is active, switch to split to show the form
    setLayoutMode(mode => (mode === 'preview' ? 'split' : mode));
    setTimeout(() => {
      const el = document.getElementById(fieldKey);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.focus();
        el.classList.add('field-highlight-pulse');
        setTimeout(() => el.classList.remove('field-highlight-pulse'), 1800);
      }
    }, 50);
  }, []);

  const handleApplyAiFields = useCallback((extracted) => {
    setFormData(prevForm => {
      const nextFormData = { ...prevForm };
      let count = 0;
      for (const [k, val] of Object.entries(extracted)) {
        if (!nextFormData[k] || nextFormData[k] === '') {
          nextFormData[k] = val;
          count++;
        }
      }
      showToast(`AI auto-filled ${count} empty fields with [AI Transcript] tags!`, "success");
      return nextFormData;
    });

    setProvenance(prevProv => {
      const nextProv = { ...prevProv };
      for (const [k] of Object.entries(extracted)) {
        if (!formData[k] || formData[k] === '') {
          nextProv[k] = { source: 'ai' };
        }
      }
      return nextProv;
    });

    setHasTranscript(true);
  }, [formData, showToast]);

  const reloadAfterConflict = useCallback((err) => {
    showToast(
      err?.data?.error?.code === 'invalid_transition'
        ? "This VOB's status changed and it can't be edited here. Reloading."
        : "Conflict 409: Record was updated by someone else. Reloading.",
      "error"
    );
    if (activeVobId) {
      vobsApi.getVobById(activeVobId).then(data => {
        setVob(data);
        setFormData(data);
      });
    }
  }, [activeVobId, showToast]);

  const saveForm = useCallback(() => {
    if (!vob) return Promise.resolve(null);
    return vobsApi.patchVob(
      activeVobId,
      { ...formData, provenance },
      vob.version,
      currentUser.email,
      vob.status === 'auth_queue' ? { only: AUTH_FIELD_KEYS } : {}
    );
  }, [activeVobId, formData, provenance, vob, currentUser.email]);

  const handleSaveDraft = useCallback(async () => {
    try {
      const patchRes = await saveForm();
      if (patchRes?.version) {
        setVob(prev => ({ ...prev, version: patchRes.version }));
      }
      showToast("Draft changes saved successfully.", "info");
    } catch (err) {
      if (err.status === 409) {
        reloadAfterConflict(err);
      } else {
        showToast("Error saving draft", "error");
      }
    }
  }, [saveForm, reloadAfterConflict, showToast]);

  const handleSubmit = useCallback(async () => {
    if (!vob) return;
    setIsSubmitting(true);
    try {
      const patchRes = await saveForm();
      const currentVersion = patchRes?.version || (vob.version ? vob.version + 1 : 1);
      setVob(prev => ({ ...prev, version: currentVersion }));

      const result = await vobsApi.submitVob(activeVobId, currentVersion, currentUser.email);
      const status = (result.status || '').toLowerCase();
      if (status === 'error') {
        setFailingRules(result.failingRules || []);
        showToast("Validation failed. Incomplete fields moved to Error Queue.", "error");
        setActiveTab('error_queue');
      } else if (status === 'auth_queue' || status === 'auth queue') {
        const pending = (result.awaiting || []).map(field => {
          const key = formKeyFor(field) || field;
          return CANONICAL_FIELDS_BY_KEY.get(key)?.label || field;
        });
        const shown = pending.slice(0, 3).join(', ') + (pending.length > 3 ? ` +${pending.length - 3} more` : '');
        showToast(
          pending.length > 0
            ? `Authorization section incomplete (${shown}). VOB moved to Auth Queue.`
            : "VOB moved to Auth Queue.",
          "info"
        );
        setActiveTab('auth_queue');
      } else {
        showToast("VOB validated and approved! Saved to Approved Records.", "success");
        setActiveTab('saved_records');
      }
    } catch (err) {
      console.error(err);
      if (err.status === 409) {
        reloadAfterConflict(err);
      } else {
        showToast(err?.message || "Submission error", "error");
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [vob, activeVobId, currentUser.email, saveForm, reloadAfterConflict, showToast, setActiveTab]);

  // Fast memoized progress and errors map
  const { filledCount, totalCount } = useMemo(() => getVerificationProgress(formData), [formData]);
  const failingRuleMap = useMemo(() => {
    const map = new Map();
    for (const r of failingRules) {
      const key = formKeyFor(r.field) || r.field;
      map.set(key, r.message);
    }
    return map;
  }, [failingRules]);

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
      <div className="vob-form-banner">
        <div className="vob-header-left">
          <div className="vob-tags-row">
            <ClientBadge clientId={vob.client} />
            <StatusBadge status={vob.vobStatus} />
            <span className="mono text-xs">Record ID: {vob.id}</span>
            <span className="mono text-xs">v{vob.version}</span>
            <span className="tag-progress-pill">Verified {filledCount}/{totalCount}</span>
          </div>
          <h2 className="vob-patient-name">{formData.patientName || 'Unnamed Patient'}</h2>
          <div className="vob-patient-meta">
            <span>DOB: <strong>{formData.dob || '—'}</strong></span>
            <span>DOS: <strong>{formData.dos || '—'}</strong></span>
            <span>Type: <strong>{formData.serviceType || 'PT'}</strong></span>
            <span>Insurance: <strong>{formData.insurance || '—'}</strong></span>
          </div>
        </div>

        <div className="vob-header-actions">
          {/* Layout Mode Segmented Control */}
          <div className="layout-toggle-group">
            <button
              type="button"
              className={`layout-btn ${layoutMode === 'split' ? 'active' : ''}`}
              onClick={() => setLayoutMode('split')}
              title="Side-by-side: Form & Parker VOB Preview"
            >
              ◫ Split View
            </button>
            <button
              type="button"
              className={`layout-btn ${layoutMode === 'form' ? 'active' : ''}`}
              onClick={() => setLayoutMode('form')}
              title="Form & Call Verification only"
            >
              ▤ Form Only
            </button>
            <button
              type="button"
              className={`layout-btn ${layoutMode === 'preview' ? 'active' : ''}`}
              onClick={() => setLayoutMode('preview')}
              title="Parker VOB document preview only"
            >
              📄 Live Preview
            </button>
          </div>

          {/* Quick switcher to next task */}
          {myVobsList.length > 1 && (
            <select
              className="select-input select-sm"
              value={activeVobId}
              onChange={(e) => setActiveVobId(e.target.value)}
              title="Switch to another assigned VOB"
            >
              {myVobsList.map(v => (
                <option key={v.id} value={v.id}>{v.patientName} ({v.vobStatus})</option>
              ))}
            </select>
          )}

          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setIsAiDrawerOpen(true)}
            disabled={inAuthQueue}
            title={inAuthQueue
              ? "Locked while the VOB is in the Auth Queue"
              : "Paste call transcript or payer portal text to auto-fill"}
          >
            Paste Transcript
          </button>
        </div>
      </div>

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

            {inAuthQueue && (
              <div className="auth-queue-lock-banner" role="status">
                <div className="error-banner-icon">⏳</div>
                <div className="error-banner-content">
                  <h4>In the Auth Queue: only the authorization fields are open</h4>
                  <p>Fill in every field in VII. Authorization &amp; Referral, then submit to move this VOB to Saved Records. The other sections are locked.</p>
                </div>
              </div>
            )}

            {/* Validation Error Banner */}
            {failingRules.length > 0 && (
              <div className="validation-error-banner" role="alert">
                <div className="error-banner-icon">⚠️</div>
                <div className="error-banner-content">
                  <h4>Validation Error — {failingRules.length} Rule(s) Failed</h4>
                  <p>The Parker VOB format requires all mandatory fields to be verified before approval:</p>
                  <ul className="error-fields-list">
                    {failingRules.map((err, i) => {
                      const matchedKey = formKeyFor(err.field) || err.field;
                      const fieldLabel = CANONICAL_FIELDS_BY_KEY.get(matchedKey)?.label || CANONICAL_FIELDS_BY_KEY.get(err.field)?.label || err.field;
                      return (
                        <li key={i}>
                          <strong>{fieldLabel}:</strong> {err.message}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            )}

            {/* Form Sections */}
            <div className="form-sections-grid">
              {FIELD_GROUPS.map(grp => {
                const locked = inAuthQueue && grp.id !== 'auth';
                return (
                <div key={grp.id} className="form-section-card">
                  <h3 className="group-heading">{grp.title}</h3>
                  <div className="group-fields-layout">
                    {grp.fields.map(f => {
                      const errorMsg = failingRuleMap.get(f.key);
                      const hasError = Boolean(errorMsg);
                      const prov = provenance[f.key];

                      return (
                        <div key={f.key} className={`vob-field-wrap ${hasError ? 'field-has-error' : ''}`}>
                          <div className="vob-field-label-row">
                            <label htmlFor={f.key}>
                              {f.label} {f.required && <span className="req-star">*</span>}
                            </label>
                            <ProvenanceBadge provenance={prov} />
                          </div>

                          {f.options ? (
                            <select
                              id={f.key}
                              className={`vob-select ${hasError ? 'input-error' : ''}`}
                              value={formData[f.key] || ''}
                              onChange={(e) => handleFieldChange(f.key, e.target.value)}
                              disabled={locked}
                            >
                              <option value="">Select option…</option>
                              {f.options.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              id={f.key}
                              type="text"
                              className={`vob-input ${hasError ? 'input-error' : ''}`}
                              value={formData[f.key] || ''}
                              placeholder={f.placeholder || `Enter ${f.label.toLowerCase()}…`}
                              onChange={(e) => handleFieldChange(f.key, e.target.value)}
                              disabled={locked}
                              autoComplete="off"
                              spellCheck="false"
                            />
                          )}

                          {hasError && (
                            <span className="field-error-msg">
                              {errorMsg}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                );
              })}
            </div>
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

        <div className="action-bar-right">
          <button
            type="button"
            className="btn ghost"
            onClick={handleSaveDraft}
          >
            💾 Save Draft
          </button>
          <button
            type="button"
            className="btn btn-submit-vob"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Validating against Client Rules…' : '✓ Submit VOB for Validation'}
          </button>
        </div>
      </div>

      {/* AI Transcript Auto-Fill Slide-out Drawer */}
      <AiTranscriptDrawer
        isOpen={isAiDrawerOpen}
        onClose={() => setIsAiDrawerOpen(false)}
        vobId={activeVobId}
        onApplyFields={handleApplyAiFields}
      />
    </div>
  );
}
