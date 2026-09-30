import React, { useEffect, useRef, useState } from 'react';
import templateUrl from '../../../docs/VOB_PARKER - Copy.docx?url';
import { useWorkspace } from '../../context/WorkspaceContext';
import { vobsApi } from '../../api/vobs';
import { DOCX_TYPE, fillVobTemplate, vobDocxFilename } from '../../utils/vobDocx';
import { ParkerLivePreview, printVobSheet } from './ParkerLivePreview';

/**
 * The per-patient VOB form (FR-15) for a saved record: a preview, a Word
 * download filled into the master template, and Print / Save PDF.
 *
 * `vob` is a Saved Records row, which carries only what the list shows, so the
 * full record is loaded before anything is rendered or generated from it.
 */
export function DocumentGeneratorModal({ vob, isOpen, onClose }) {
  const { showToast } = useWorkspace();
  const [record, setRecord] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const bodyRef = useRef(null);

  useEffect(() => {
    if (!isOpen || !vob?.id) return undefined;
    let cancelled = false;
    setRecord(null);
    setLoadError('');
    vobsApi.getVobById(vob.id)
      .then(data => { if (!cancelled) setRecord(data); })
      .catch(err => { if (!cancelled) setLoadError(err?.message || 'Could not load this VOB.'); });
    return () => { cancelled = true; };
  }, [isOpen, vob?.id]);

  if (!isOpen || !vob) return null;

  const handlePrint = () => printVobSheet(bodyRef.current);

  const handleDownloadDocx = async () => {
    setIsDownloading(true);
    try {
      const res = await fetch(templateUrl);
      if (!res.ok) throw new Error('Could not load the VOB form template.');
      const bytes = fillVobTemplate(new Uint8Array(await res.arrayBuffer()), record);
      const filename = vobDocxFilename({
        client: vob.clientName,
        insurance: record.insurance,
        patientName: record.patientName,
        dos: record.dos
      });

      const url = URL.createObjectURL(new Blob([bytes], { type: DOCX_TYPE }));
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast(`Downloaded ${filename}.`, "success");
    } catch (err) {
      console.error(err);
      showToast(err?.message || "Could not generate the Word document.", "error");
    } finally {
      setIsDownloading(false);
    }
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
            <button type="button" className="btn btn-sm" onClick={handleDownloadDocx} disabled={!record || isDownloading}>
              {isDownloading ? 'Generating…' : '⬇ Download .docx'}
            </button>
            <button type="button" className="btn-doc-action" onClick={handlePrint} disabled={!record}>🖨️ Print / Save PDF</button>
            <button type="button" className="drawer-close-btn" onClick={onClose}>✕</button>
          </div>
        </div>

        <div className="modal-body-scroll" ref={bodyRef}>
          {loadError ? (
            <div className="table-empty">{loadError}</div>
          ) : !record ? (
            <div className="table-empty">Loading VOB form…</div>
          ) : (
            <ParkerLivePreview formData={record} />
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn ghost" onClick={onClose}>Close Preview</button>
        </div>
      </div>
    </div>
  );
}
