import React, { useRef } from 'react';
import { vobFormRows, shownValue } from '../../utils/vobFormRows';
import { printElement } from '../../utils/printElement';

/**
 * The VOB output document: the letterhead, PAT box and title of
 * docs/VOB_PARKER - Copy.docx, over its table as vobFormRows() lays it out.
 *
 * DocumentGeneratorModal renders this same component, and the Word export
 * fills the template from the same rows, so the printed/saved output, the .docx
 * and the on-screen preview cannot drift apart.
 */

/** One `Label: value` line inside a cell. */
function Line({ label, value, fallback = '—', mono = false, bold = false }) {
  const shown = shownValue({ value, fallback });
  return (
    <div className="p-line">
      <span className="p-lbl">{label}</span>{' '}
      <span className={`p-val${mono ? ' font-mono' : ''}${bold ? ' font-semibold' : ''}`}>{shown}</span>
    </div>
  );
}

/** Print / Save PDF for a rendered preview: its sheet alone, as the document. */
export function printVobSheet(root) {
  printElement(root?.querySelector('.parker-sheet-container'), 'Pre-Authorization & Benefits Determination');
}

export function ParkerLivePreview({ formData = {} }) {
  const f = formData;
  const cardRef = useRef(null);
  const handlePrint = () => printVobSheet(cardRef.current);

  return (
    <div className="parker-preview-card" ref={cardRef}>
      <div className="parker-preview-header">
        <div>
          <h3 className="preview-title">Live preview</h3>
          <p className="preview-subtitle">Matches the generated PDF.</p>
        </div>
        <button
          type="button"
          className="btn-print-preview"
          onClick={handlePrint}
          title="Print or export document as PDF"
        >
          🖨️ Print / Save PDF
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
              <div className="parker-brand-sub">Innovative Technology Driven</div>
              <div className="brand-orange-bar"></div>
            </div>

            <div className="parker-pat-box">PAT: {f.pat || '—'}</div>
          </div>

          <div className="parker-doc-title-row">
            <h2 className="parker-doc-title">Pre-Authorization &amp; Benefits Determination</h2>
          </div>

          <div className="parker-table">
            {vobFormRows(f).map((row, i) => (
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
}
