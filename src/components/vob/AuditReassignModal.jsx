import React, { useState, useEffect } from 'react';

const QUICK_REASONS = [
  'Deductible amount or met amount mismatch with transcript',
  'Copay / Coinsurance discrepancy found in call transcript',
  'Missing required Prior Authorization / Referral details',
  'Out-of-pocket maximum value mismatch',
  'Policy inactive or date of service not covered',
  'Plan type or appointment type incorrectly categorized'
];

export function AuditReassignModal({ isOpen, onClose, vob, onConfirm, isSubmitting }) {
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    if (isOpen) {
      setRemarks('');
    }
  }, [isOpen]);

  if (!isOpen || !vob) return null;

  const targetSpecialist =
    vob.previous_assignee?.name ||
    vob.previous_assignee?.email ||
    vob.previousAssignee?.name ||
    vob.previousAssignee ||
    (vob.previous_assignee_id ? `Specialist (${vob.previous_assignee_id})` : '') ||
    vob.assignee?.name ||
    vob.assignee?.email ||
    vob.assignee_id ||
    'Submitting Specialist';

  const handleChipClick = (reason) => {
    setRemarks(prev => {
      const trimmed = prev.trim();
      if (!trimmed) return reason;
      if (trimmed.includes(reason)) return trimmed;
      return `${trimmed}; ${reason}`;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!remarks.trim()) return;
    onConfirm(remarks.trim());
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-container"
        style={{ maxWidth: '600px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <div className="modal-eyebrow" style={{ color: '#dc2626' }}>
              <span>⚠️ Quality Assurance Action</span>
            </div>
            <h2 className="modal-title" style={{ fontSize: '18px', margin: '4px 0 0' }}>
              Return VOB to Specialist (Error Queue)
            </h2>
          </div>
          <button
            type="button"
            className="btn ghost btn-sm"
            onClick={onClose}
            disabled={isSubmitting}
            style={{ fontSize: '18px', padding: '4px 8px' }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ padding: '20px 24px' }}>
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.06)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: '8px',
                padding: '12px 16px',
                marginBottom: '16px'
              }}
            >
              <div style={{ fontSize: '13px', color: '#1f2937', marginBottom: '4px' }}>
                <strong>Record:</strong> {vob.patientName || 'Unnamed Patient'} (ID: <code>{vob.id}</code>)
              </div>
              <div style={{ fontSize: '13px', color: '#1f2937' }}>
                <strong>Returning to:</strong> <span style={{ color: '#b91c1c', fontWeight: 600 }}>👤 {targetSpecialist}</span>
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '6px' }}>
                This record will be moved to the specialist’s <strong>Error Queue</strong> with your remarks logged for audit compliance.
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                Quick Reason Suggestions (Click to add):
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {QUICK_REASONS.map((reason, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleChipClick(reason)}
                    style={{
                      background: remarks.includes(reason) ? 'rgba(220, 38, 38, 0.12)' : 'var(--surface-2, #f3f4f6)',
                      border: '1px solid',
                      borderColor: remarks.includes(reason) ? '#dc2626' : 'var(--rule, #e5e7eb)',
                      color: remarks.includes(reason) ? '#b91c1c' : '#4b5563',
                      borderRadius: '6px',
                      padding: '4px 8px',
                      fontSize: '11.5px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    + {reason}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label
                htmlFor="audit-reassign-remarks"
                style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}
              >
                Discrepancy Remarks & Instructions <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <textarea
                id="audit-reassign-remarks"
                className="input-textarea"
                rows={4}
                required
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  borderRadius: '6px',
                  padding: '10px 12px',
                  fontSize: '13px',
                  lineHeight: '1.45',
                  border: '1px solid var(--rule, #d1d5db)',
                  fontFamily: 'inherit'
                }}
                placeholder="Explain the discrepancies found between the form and the call transcript so the specialist can correct them accurately..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
            </div>
          </div>

          <div
            style={{
              padding: '14px 24px',
              borderTop: '1px solid var(--rule-soft, #e5e7eb)',
              background: 'var(--surface-2, #f9fafb)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px'
            }}
          >
            <button
              type="button"
              className="btn ghost"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn"
              disabled={isSubmitting || !remarks.trim()}
              style={{
                backgroundColor: '#dc2626',
                borderColor: '#dc2626',
                color: '#ffffff',
                fontWeight: 600,
                padding: '8px 18px',
                borderRadius: '6px'
              }}
            >
              {isSubmitting ? 'Returning to Specialist…' : '↩ Return to Error Queue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
