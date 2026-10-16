import React from 'react';
import { useTranscriptExtraction, TranscriptExtractBody, TranscriptExtractActions } from './TranscriptExtractPanel';

export function AiTranscriptDrawer({ isOpen, onClose, vobId, initialTranscript = '', transcriptFileName = '', onApplyFields }) {
  // Held here, above the early return, so the text and result survive closing the drawer.
  const extraction = useTranscriptExtraction(vobId, { initialTranscript, transcriptFileName });

  if (!isOpen) return null;

  const handleApply = (fields) => {
    onApplyFields(fields, extraction.transcript);
    onClose();
  };

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <div>
            <div className="drawer-eyebrow">Transcript Extraction With Ai </div>
            <h2 className="drawer-title">AI Transcript Auto-Fill</h2>
          </div>
          <button type="button" className="drawer-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="drawer-body">
          <TranscriptExtractBody extraction={extraction} />
        </div>

        <div className="drawer-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <TranscriptExtractActions extraction={extraction} onApply={handleApply} />
        </div>
      </div>
    </div>
  );
}
