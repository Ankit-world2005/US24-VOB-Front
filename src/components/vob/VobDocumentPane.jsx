import React, { useEffect, useRef, useState } from 'react';
import { ParkerLivePreview } from './ParkerLivePreview';
import { ACCEPTED_DOCUMENT_TYPES } from '../../utils/vobDocumentParser';

const RESULT_TEXT = {
  correct: '✓ Correct',
  wrong: '✗ Wrong',
  missing: '✗ Blank in document',
  unchecked: '? Not checked'
};

/**
 * A .docx drawn in the page by docx-preview, loaded the first time one opens:
 * at its own page width, shrunk to fit the pane. It is drawn off-page and
 * swapped in, so a file replaced mid-draw never leaves half of each on screen.
 */
function DocxView({ file }) {
  const hostRef = useRef(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    let cancelled = false;
    let observer = null;
    setFailed(false);
    const target = document.createElement('div');
    import('docx-preview')
      .then(({ renderAsync }) => renderAsync(file, target, undefined, {
        inWrapper: false,
        ignoreHeight: true,
        breakPages: false
      }))
      .then(() => {
        if (cancelled) return;
        host.replaceChildren(target);
        const pageWidth = target.scrollWidth;
        const fit = () => { target.style.zoom = String(Math.min(1, host.clientWidth / pageWidth)); };
        fit();
        observer = new ResizeObserver(fit);
        observer.observe(host);
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => {
      cancelled = true;
      observer?.disconnect();
      host.replaceChildren();
    };
  }, [file]);

  return (
    <>
      {failed && (
        <div className="queue-doc-alert" role="alert">
          Couldn’t show this .docx here. Its fields were still read for the cross-check.
        </div>
      )}
      <div ref={hostRef} className="queue-docx" />
    </>
  );
}

/** Each checked field with both sides' values; clicking one goes to that field on the form. */
function CrossCheckList({ check, onSelectField }) {
  const [onlyErrors, setOnlyErrors] = useState(check.errors > 0);
  const rows = check.results.filter(r =>
    r.status !== 'empty' && (!onlyErrors || r.status === 'wrong' || r.status === 'missing')
  );

  return (
    <div className="queue-check">
      <label className="queue-check-filter">
        <input type="checkbox" checked={onlyErrors} onChange={(e) => setOnlyErrors(e.target.checked)} />
        Only fields to fix
      </label>
      {rows.length === 0 ? (
        <p className="queue-doc-note">
          {onlyErrors ? 'Nothing to fix: every field on both sides matches.' : 'Neither side has values to compare yet.'}
        </p>
      ) : (
        <ul className="queue-check-list">
          {rows.map(r => (
            <li key={r.key}>
              <button
                type="button"
                className={`queue-check-item ${r.status}`}
                title={r.remark || 'Go to this field'}
                onClick={() => onSelectField(r.key)}
              >
                <span className="queue-check-item-head">
                  <strong>{r.label}</strong>
                  <span className={`field-check-badge ${r.status}`}>{RESULT_TEXT[r.status]}</span>
                </span>
                <span className="queue-check-item-values">
                  <span>Form: <b>{r.formValue || '—'}</b></span>
                  <span>Document: <b>{r.docValue || '—'}</b></span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * The Queue tab's right side: the VOB someone already made. Drop it, import
 * it or paste it; it opens here, and once its fields are read and it is this
 * patient's, the cross-check against the form shows below it.
 *
 * `doc` is the screen's document state ({ file, name, kind, url, status,
 * error, fields, found, total, readable }), `patient` the samePatient()
 * result and `check` the crossCheck() result (see src/utils/vobCompare.js).
 */
export function VobDocumentPane({ doc, patient, check, formData, onFile, onRemove, onSelectField }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [view, setView] = useState('file'); // 'file' | 'check' | 'preview'

  // A new document opens on the document itself.
  useEffect(() => { setView('file'); }, [doc?.file]);

  const pickFile = () => inputRef.current?.click();
  const shown = view === 'check' && !check ? 'file' : view;

  return (
    <div
      className={`queue-doc ${dragging ? 'drag-active' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) onFile(file);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_DOCUMENT_TYPES}
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = '';
        }}
      />

      {!doc ? (
        <div className="queue-drop">
          <strong>Drop the existing VOB here</strong>
          <span>The .docx or .pdf made for this patient. You can also paste the file (Ctrl+V).</span>
          <button type="button" className="btn btn-sm" onClick={pickFile}>📂 Import file</button>
        </div>
      ) : (
        <>
          <div className="queue-doc-bar">
            <span className="queue-doc-name" title={doc.name}>{doc.kind === 'pdf' ? '📕' : '📘'} {doc.name}</span>
            <span className="queue-doc-bar-actions">
              <button type="button" className="btn-action-link" onClick={pickFile}>Replace</button>
              <button type="button" className="btn-action-link danger-link" onClick={onRemove}>Remove</button>
            </span>
          </div>

          {doc.status === 'reading' && <div className="queue-doc-note">Reading the document…</div>}
          {doc.status === 'failed' && <div className="queue-doc-alert" role="alert">{doc.error}</div>}
          {doc.status === 'ready' && !doc.readable && (
            <div className="queue-doc-alert" role="alert">
              Couldn’t read this document’s fields: found {doc.found} of the template’s {doc.total} labels.
              Use the VOB made from the US24 template, as a .docx or a PDF with text in it. A scanned PDF can’t be read.
            </div>
          )}
          {patient && !patient.ok && (
            <div className="queue-doc-alert" role="alert">
              {patient.found
                ? `This document is for ${patient.name} (DOB ${patient.dob}), not ${formData.patientName || 'this patient'}. Drop the VOB made for this patient.`
                : 'Couldn’t find the patient’s name and DOB in this document, so it can’t be checked against this VOB.'}
            </div>
          )}

          {check && (
            <div className="queue-check-summary" aria-live="polite">
              <span className="field-check-badge correct">✓ {check.counts.correct} correct</span>
              {check.counts.wrong > 0 && <span className="field-check-badge wrong">✗ {check.counts.wrong} wrong</span>}
              {check.counts.missing > 0 && <span className="field-check-badge missing">✗ {check.counts.missing} blank in document</span>}
              {check.counts.unchecked > 0 && <span className="field-check-badge unchecked">? {check.counts.unchecked} not checked</span>}
            </div>
          )}

          <div className="layout-toggle-group queue-doc-views">
            <button type="button" className={`layout-btn ${shown === 'file' ? 'active' : ''}`} onClick={() => setView('file')}>
              📄 Document
            </button>
            <button
              type="button"
              className={`layout-btn ${shown === 'check' ? 'active' : ''}`}
              onClick={() => setView('check')}
              disabled={!check}
              title={check ? undefined : 'Shows once the document is read and is this patient’s'}
            >
              ✓ Cross-check{check ? ` (${check.errors} to fix)` : ''}
            </button>
            <button type="button" className={`layout-btn ${shown === 'preview' ? 'active' : ''}`} onClick={() => setView('preview')}>
              Live Preview
            </button>
          </div>

          {shown === 'file' && (doc.kind === 'pdf'
            ? <iframe className="queue-pdf" src={doc.url} title={`Existing VOB: ${doc.name}`} />
            : <DocxView file={doc.file} />)}
          {shown === 'check' && <CrossCheckList check={check} onSelectField={onSelectField} />}
          {shown === 'preview' && <ParkerLivePreview formData={formData} />}
        </>
      )}
    </div>
  );
}
