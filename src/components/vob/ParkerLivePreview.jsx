import React, { useRef, useMemo, useCallback, useState, useContext, memo } from 'react';
import { vobFormRows, shownValue } from '../../utils/vobFormRows';
import { printElement } from '../../utils/printElement';
import templateUrl from '../../../docs/VOB_PARKER - Copy.docx?url';
import { DOCX_TYPE, fillVobTemplate, vobDocxFilename } from '../../utils/vobDocx';
import { WorkspaceContext } from '../../context/WorkspaceContext';

/**
 * The VOB output document: the letterhead, PAT box and title of
 * docs/VOB_PARKER - Copy.docx, over its table as vobFormRows() lays it out.
 *
 * DocumentGeneratorModal renders this same component, and the Word export
 * fills the template from the same rows, so the printed/saved output, the .docx
 * and the on-screen preview cannot drift apart.
 */

/** One `Label: value` line inside a cell. */
const Line = memo(function Line({ label, value, fallback = '—', mono = false, bold = false }) {
  const shown = shownValue({ value, fallback });
  return (
    <div className="p-line">
      <span className="p-lbl">{label}</span>{' '}
      <span className={`p-val${mono ? ' font-mono' : ''}${bold ? ' font-semibold' : ''}`}>{shown}</span>
    </div>
  );
});

/** Print / Save PDF for a rendered preview: its sheet alone, as the document. */
export function printVobSheet(root) {
  printElement(root?.querySelector('.parker-sheet-container'), 'Pre-Authorization & Benefits Determination');
}

export const ParkerLivePreview = memo(function ParkerLivePreview({ formData = {} }) {
  const cardRef = useRef(null);
  const workspace = useContext(WorkspaceContext);
  const showToast = workspace?.showToast;
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveDoc = useCallback(async () => {
    setIsSaving(true);
    try {
      const res = await fetch(templateUrl);
      if (!res.ok) throw new Error('Could not load the VOB form template.');
      const templateBytes = new Uint8Array(await res.arrayBuffer());
      const bytes = await fillVobTemplate(templateBytes, formData);
      const filename = vobDocxFilename({
        client: formData.clientName || formData.client_name || formData.client?.name || formData.client,
        insurance: formData.insurance,
        patientName: formData.patientName || formData.patient_name || formData.patient?.name,
        dos: formData.dos
      });

      const url = URL.createObjectURL(new Blob([bytes], { type: DOCX_TYPE }));
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      if (showToast) {
        showToast(`Saved ${filename}.`, "success");
      }
    } catch (err) {
      console.error(err);
      if (showToast) {
        showToast(err?.message || "Could not generate the Word document.", "error");
      }
    } finally {
      setIsSaving(false);
    }
  }, [formData, showToast]);
  const rows = useMemo(() => vobFormRows(formData), [formData]);

  return (
    <div className="parker-preview-card" ref={cardRef}>
      <div className="parker-preview-header">
        <div>
          <h3 className="preview-title">Live preview</h3>
          <p className="preview-subtitle">Matches the generated document.</p>
        </div>
        <button
          type="button"
          className="btn-save-doc"
          onClick={handleSaveDoc}
          disabled={isSaving}
          title="Save filled VOB document (.docx)"
        >
          {isSaving ? 'Saving…' : '💾 Save Docs'}
        </button>
      </div>

      <div className="parker-sheet-container">
        <div className="parker-sheet">
          {/* Letterhead. The source document carries the logo as a page-header image,
              with the PAT box as a separate table floated to the right of it
              (tblpX=9237, anchored to the page) rather than a full-width strip. */}
          <div className="parker-top-bar">
            <div className="parker-logo-box">
              <div className="parker-brand-title">
                <span className="brand-navy">US24</span>
                <span className="brand-blue"> SOLUTIONS</span>
              </div>
              <div className="brand-orange-bar"></div>
            </div>

            <div className="parker-pat-box">PAT: {formData.pat || '—'}</div>
          </div>

          <div className="parker-doc-title-row">
            <h2 className="parker-doc-title">Pre-Authorization &amp; Benefits Determination</h2>
          </div>

          <div className="parker-table">
            {rows.map((row, i) => (
              <div key={i} className={`p-row${row.full ? ' p-row-full' : ''}`}>
                {row.cells.map((lines, j) => (
                  <div key={j} className={row.full ? 'p-cell' : `p-cell ${j === 0 ? 'p-cell-left' : 'p-cell-right'}`}>
                    {lines.map(l => <Line key={l.label} {...l} />)}
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="parker-footer-note">
            HIPAA BAA Confidential Document · US24 Solutions Verification of Benefits
          </div>
        </div>
      </div>
    </div>
  );
});

