import React, { useMemo } from 'react';
import { ProvenanceBadge } from './ProvenanceBadge';
import { CANONICAL_FIELDS, failureLabel } from '../../data/clients';
import { formKeyFor } from '../../utils/vobAdapter';

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

/**
 * Failure codes from the Queue tab's check of a VOB against a transcript: a
 * field the transcript contradicts or the VOB lacks, and the specialist's remark.
 */
const QUEUE_CHECK_CODES = new Set(['document_mismatch', 'reviewer_remark']);

/**
 * The VOB form's fields, section by section, under the Auth Queue lock banner
 * and the failed-rules banner. In the Auth Queue only the authorization
 * section is open.
 */
export function VobFormSections({ formData, provenance, failingRules, inAuthQueue, onFieldChange }) {
  // Real form field validation failures only (exclude audit remarks from form error banner)
  const formFailingRules = useMemo(() => {
    return (failingRules || []).filter(r => {
      const field = typeof r === 'string' ? r : r?.field;
      const rule = typeof r === 'object' ? r?.rule : null;
      const code = typeof r === 'object' ? r?.code : null;
      return field !== 'audit_remark' && rule !== 'audit_rejection' && code !== 'audit_remark';
    });
  }, [failingRules]);

  // Failures from the Queue tab's check carry their own remarks.
  const fromQueueCheck = formFailingRules.length > 0 && formFailingRules.every(r => QUEUE_CHECK_CODES.has(r.code));
  const mismatchCount = formFailingRules.filter(r => r.code === 'document_mismatch').length;
  const failingRuleMap = useMemo(() => {
    const map = new Map();
    for (const r of formFailingRules) {
      const key = formKeyFor(r.field) || r.field;
      map.set(key, r.message);
    }
    return map;
  }, [formFailingRules]);

  return (
    <>
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
      {formFailingRules.length > 0 && (
        <div className="validation-error-banner" role="alert">
          <div className="error-banner-icon">⚠️</div>
          <div className="error-banner-content">
            {fromQueueCheck ? (
              <>
                <h4>Transcript check — {mismatchCount} VOB field(s) wrong or missing</h4>
                <p>What the VOB has and what the transcript says. Correct the VOB, then check it again in the Queue tab:</p>
              </>
            ) : (
              <>
                <h4>Validation Error — {formFailingRules.length} Rule(s) Failed</h4>
                <p>The VOB format requires all mandatory fields to be verified before approval:</p>
              </>
            )}
            <ul className="error-fields-list">
              {formFailingRules.map((err, i) => (
                <li key={i}>
                  <strong>{failureLabel(err)}:</strong> {err.message}
                </li>
              ))}
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
                        onChange={(e) => onFieldChange(f.key, e.target.value)}
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
                        onChange={(e) => onFieldChange(f.key, e.target.value)}
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
    </>
  );
}
