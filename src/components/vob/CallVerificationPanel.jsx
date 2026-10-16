import React, { useMemo, useCallback, memo } from 'react';
import {
  REP_VERIFICATION_FIELDS,
  OURS_VERIFICATION_FIELDS,
  getVerificationProgress,
  isFieldFilled
} from '../../data/clients';

export const CallVerificationPanel = memo(function CallVerificationPanel({
  formData = {},
  hasTranscript = false,
  onOpenTranscript,
  onSelectField
}) {
  const {
    filledCount,
    totalCount,
    stillToAskCount,
    stillToFillCount,
    stillToAsk,
    stillToFill
  } = useMemo(() => getVerificationProgress(formData), [formData]);

  const handlePillClick = useCallback((fieldKey) => {
    if (onSelectField) {
      onSelectField(fieldKey);
    }
  }, [onSelectField]);

  return (
    <div className="call-verification-card">
      {/* Header with Title and Status Badges */}
      <div className="call-verif-header">
        <div className="call-verif-title-wrap">
          <h3 className="call-verif-title">Call verification</h3>
          <p className="call-verif-subtitle">
            Every filled detail must match the call; required fields are tracked too.
          </p>
        </div>

        <div className="call-verif-badges">
          <span className="badge-form-progress">
            FORM {filledCount}/{totalCount}
          </span>
          <span className={`badge-transcript-status ${hasTranscript ? 'attached' : 'none'}`} title={hasTranscript ? "Associated transcript stored in Azure Blob Storage" : undefined}>
            {hasTranscript ? (formData.transcriptFileName ? `☁️ ${formData.transcriptFileName}` : '☁️ TRANSCRIPT ATTACHED') : 'NO TRANSCRIPT'}
          </span>
        </div>
      </div>

      {/* Box 1: Still to ask from Rep */}
      <div className="verif-group-box rep-box">
        <div className="verif-group-header">
          {stillToAskCount > 0 ? (
            <span>STILL TO ASK — {stillToAskCount} FIELDS FROM THE REP</span>
          ) : (
            <span className="text-success">✓ ALL 20 FIELDS VERIFIED FROM REP</span>
          )}
        </div>

        <div className="verif-pills-wrap">
          {stillToAsk.map(f => (
            <button
              key={f.key}
              type="button"
              className="verif-pill rep-pill"
              onClick={() => handlePillClick(f.key)}
              title={`Click to fill in ${f.label}`}
            >
              {f.label}
            </button>
          ))}
          {stillToAskCount === 0 && (
            <span className="all-complete-msg">All insurance rep verification questions completed.</span>
          )}
        </div>
      </div>

      {/* Box 2: Still to fill in - 5 of Ours */}
      <div className="verif-group-box ours-box">
        <div className="verif-group-header">
          {stillToFillCount > 0 ? (
            <span>STILL TO FILL IN — {stillToFillCount} OF OURS</span>
          ) : (
            <span className="text-success">✓ ALL 5 INTERNAL FIELDS FILLED</span>
          )}
        </div>

        <div className="verif-pills-wrap">
          {stillToFill.map(f => (
            <button
              key={f.key}
              type="button"
              className="verif-pill ours-pill"
              onClick={() => handlePillClick(f.key)}
              title={`Click to fill in ${f.label}`}
            >
              {f.label}
            </button>
          ))}
          {stillToFillCount === 0 && (
            <span className="all-complete-msg">All project & intake fields completed.</span>
          )}
        </div>
      </div>

      {/* Transcript Matching Section */}
      <div className="verif-transcript-footer">
        <div className="verif-transcript-tip-row">
          <p className="verif-transcript-tip">
            Attach the call transcript to check these against what the payer said.
          </p>
          {onOpenTranscript && (
            <button
              type="button"
              className="btn-attach-transcript-link"
              onClick={onOpenTranscript}
            >
              ✨ {hasTranscript ? 'View Transcript' : 'Attach Transcript'}
            </button>
          )}
        </div>

        {/* Real-time Field Verification Checklist */}
        <div className="transcript-match-row">
          <div className="match-item">
            <span className={`match-icon ${isFieldFilled(formData, 'serviceType') ? 'cross-or-check' : 'missing'}`}>
              {isFieldFilled(formData, 'serviceType') ? '✕' : '○'}
            </span>
            <span className="match-label">Service type</span>
            <strong className="match-value">{formData.serviceType || 'PT'}</strong>
          </div>

          {isFieldFilled(formData, 'insurance') && (
            <div className="match-item">
              <span className="match-icon match-success">✓</span>
              <span className="match-label">Insurance</span>
              <strong className="match-value">{formData.insurance}</strong>
            </div>
          )}

          {isFieldFilled(formData, 'idCard') && (
            <div className="match-item">
              <span className="match-icon match-success">✓</span>
              <span className="match-label">Policy ID</span>
              <strong className="match-value">{formData.idCard}</strong>
            </div>
          )}

          {isFieldFilled(formData, 'deductibleApplicable') && (
            <div className="match-item">
              <span className="match-icon match-success">✓</span>
              <span className="match-label">Deductible</span>
              <strong className="match-value">{formData.deductibleApplicable}</strong>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

