import React from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useTranscriptExtraction, TranscriptExtractBody, TranscriptExtractActions } from './TranscriptExtractPanel';

export function AiTranscriptDrawer({ isOpen, onClose, vobId, initialTranscript = '', transcriptFileName = '', onApplyFields, canAutoFill }) {
  const { currentUser } = useWorkspace();
  const isAuditSpecialist = currentUser?.role === 'auth' || currentUser?.role === 'auth_specialist' || currentUser?.role === 'audit' || currentUser?.email === 'jitender.s@us24solutions.com' || currentUser?.email === 'ankit.k@us24solutions.com';
  const effectiveCanAutoFill = canAutoFill !== undefined ? canAutoFill : !isAuditSpecialist;

  // Held here, above the early return, so the text and result survive closing the drawer.
  const extraction = useTranscriptExtraction(vobId, {
    initialTranscript,
    transcriptFileName,
    allFields: isAuditSpecialist
  });

  if (!isOpen) return null;

  const handleApply = (fields) => {
    if (isAuditSpecialist || !effectiveCanAutoFill) {
      return;
    }
    onApplyFields(fields, extraction.transcript);
    onClose();
  };

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <div>
            <div className="drawer-eyebrow">
              {isAuditSpecialist ? 'Audit QA Transcript Inspection' : 'Transcript Extraction With AI'}
            </div>
            <h2 className="drawer-title">
              {isAuditSpecialist ? 'Audit Transcript Re-Extraction' : 'AI Transcript Auto-Fill'}
            </h2>
          </div>
          <button type="button" className="drawer-close-btn" onClick={onClose}>✕</button>
        </div>

        {isAuditSpecialist && (
          <div style={{ margin: '0 20px 12px', padding: '10px 14px', background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.25)', borderRadius: '6px', fontSize: '12px', color: '#4338ca' }}>
            ℹ️ <strong>Quality Audit Mode:</strong> You can view and re-extract transcript values to verify against the submitted VOB. Auto-fill is disabled for Audit Specialists to preserve the specialist's entries.
          </div>
        )}

        <div className="drawer-body">
          <TranscriptExtractBody
            extraction={extraction}
            description={isAuditSpecialist
              ? "Associated transcript loaded from Azure Blob Storage. You can review or re-extract values using AI for verification comparison."
              : undefined}
          />
        </div>

        <div className="drawer-footer" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px' }}>
          <button type="button" className="btn ghost" onClick={onClose}>
            {isAuditSpecialist ? 'Close' : 'Cancel'}
          </button>
          <TranscriptExtractActions
            extraction={extraction}
            onApply={handleApply}
            canAutoFill={effectiveCanAutoFill}
            isAuditSpecialist={isAuditSpecialist}
          />
        </div>
      </div>
    </div>
  );
}
