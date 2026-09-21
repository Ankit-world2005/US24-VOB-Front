import React from 'react';
import { ParkerLivePreview } from './ParkerLivePreview';

export function DocumentGeneratorModal({ vob, isOpen, onClose }) {
  if (!isOpen || !vob) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container doc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-eyebrow">Form Generator (FR-15)</div>
            <h2 className="modal-title">Pre-Authorization & Benefits Determination</h2>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-doc-action" onClick={handlePrint}>🖨️ Print / Save PDF</button>
            <button type="button" className="drawer-close-btn" onClick={onClose}>✕</button>
          </div>
        </div>

        <div className="modal-body-scroll">
          <ParkerLivePreview formData={vob} onPrint={handlePrint} />
        </div>

        <div className="modal-footer">
          <button type="button" className="btn ghost" onClick={onClose}>Close Preview</button>
        </div>
      </div>
    </div>
  );
}
