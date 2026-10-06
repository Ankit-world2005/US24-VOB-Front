import React, { useEffect, useRef, useState } from 'react';
import { StatusBadge } from './StatusBadge';
import { ACCEPTED_DOCUMENT_TYPES } from '../../utils/vobDocumentParser';
import { ParkerLivePreview } from './ParkerLivePreview';

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
          Couldn’t show this .docx here. Its fields were still read for the check.
        </div>
      )}
      <div ref={hostRef} className="queue-docx" />
    </>
  );
}

const DOC_ICONS = { pdf: '📄', docx: '📝', text: '📋', preview: '📋' };

const recordLabel = (r) => `${r.id} · DOS ${r.dos || '—'} · ${r.vobStatus}`;

/**
 * Search the specialist's own VOBs by patient or record ID and pick the one
 * this VOB belongs to, for when the names don't match on their own (the VOB
 * spells the name differently, or has none).
 */
function RecordPicker({ allRecords, onPick }) {
  const [search, setSearch] = useState('');
  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = words.length
    ? allRecords.filter(r => words.every(w => `${r.patientName} ${r.id}`.toLowerCase().includes(w))).slice(0, 6)
    : [];

  return (
    <div className="queue-record-picker">
      <label htmlFor="queue-record-search" className="queue-paste-label">Pick its record by hand</label>
      <input
        id="queue-record-search"
        type="search"
        className="search-input"
        placeholder="Search your VOBs by patient name or record ID…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        autoComplete="off"
      />
      {words.length > 0 && (shown.length > 0 ? (
        <ul className="queue-record-options">
          {shown.map(r => (
            <li key={r.id}>
              <button type="button" className="queue-record-option" onClick={() => onPick(r)}>
                <span className="bold">{r.patientName}</span>
                <span className="mono">{r.id}</span>
                <span className="queue-record-meta">DOS {r.dos || '—'}</span>
                <StatusBadge status={r.vobStatus} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="queue-doc-note">No VOB in your queues matches “{search}”.</p>
      ))}
    </div>
  );
}

/**
 * The VOB record the pasted VOB belongs to, found from its patient's name (and
 * date of birth, when both have one): the AI reads the transcript on it, and
 * the result goes to it on submit. When the patient has more than one record,
 * the specialist picks the visit. When none matches, the specialist can pick
 * the record by hand and confirm it is this patient's; until then the VOB is
 * still checked, but can't be submitted.
 */
function RecordLine({ doc, lookup, records, recordId, onRecordChange, allRecords, manualRecord, manualConfirmed, onManualPick, onManualConfirm, onRetryLookup }) {
  const { patientName, dob } = doc.fields;
  if (lookup.status === 'finding') return <div className="queue-doc-note">Finding {patientName}’s VOB record…</div>;
  if (lookup.status === 'failed') {
    return (
      <div className="queue-doc-alert" role="alert">
        {lookup.error} The VOB is still checked against the transcript, but can’t be submitted until its record is found.{' '}
        <button type="button" className="btn-action-link" onClick={onRetryLookup}>Retry</button>
      </div>
    );
  }

  if (records.length === 0) {
    if (manualRecord) {
      return (
        <div className="queue-record-line is-manual">
          <span className="queue-record-label">Record</span>
          <span className="mono">{manualRecord.id}</span>
          <span>{manualRecord.patientName}</span>
          <span className="queue-record-meta">DOS {manualRecord.dos || '—'}</span>
          <StatusBadge status={manualRecord.vobStatus} />
          <button type="button" className="btn-action-link" onClick={() => onManualPick(null)}>Change</button>
          <label className="queue-record-confirm">
            <input type="checkbox" checked={manualConfirmed} onChange={(e) => onManualConfirm(e.target.checked)} />
            I’ve checked {manualRecord.id} ({manualRecord.patientName}) is {lookup.namesPatient ? `${patientName}’s` : 'this VOB’s'} record
          </label>
        </div>
      );
    }
    return (
      <>
        <div className="queue-results-note">
          {lookup.namesPatient
            ? `No VOB record for ${patientName}${/\d/.test(dob || '') ? ` (DOB ${dob})` : ''} matched in your queues.`
            : 'Couldn’t find the patient’s name in this VOB, so its record can’t be matched.'}
          {' '}If its record is there under another spelling, pick it below. Until then the VOB is still checked, but can’t be submitted to the Error Queue.
        </div>
        <RecordPicker allRecords={allRecords} onPick={onManualPick} />
      </>
    );
  }

  const record = records.find(r => r.id === recordId) || records[0];
  return (
    <div className="queue-record-line">
      <span className="queue-record-label">Record</span>
      {records.length > 1 ? (
        <select
          className="select-input select-sm"
          value={record.id}
          onChange={(e) => onRecordChange(e.target.value)}
          aria-label={`${patientName}’s VOB record to check`}
        >
          {records.map(r => <option key={r.id} value={r.id}>{recordLabel(r)}</option>)}
        </select>
      ) : (
        <>
          <span className="mono">{record.id}</span>
          <span className="queue-record-meta">DOS {record.dos || '—'}</span>
          <StatusBadge status={record.vobStatus} />
        </>
      )}
    </div>
  );
}

/**
 * The Queue tab's right side: the VOB being checked, any patient's. Drop,
 * import or paste its file, or paste its text; it opens here, its record is
 * found from the patient it names, and once the transcript is read the check
 * is summed up below it.
 *
 * `doc` is the screen's VOB state ({ kind: 'docx' | 'pdf' | 'text', file,
 * text, name, url, status, error, fields, found, total, readable }), `lookup`
 * and `records` the search for its record (`allRecords` and `manualRecord`
 * for picking one by hand), and `check` the compareVobWithCall() result (see
 * src/utils/vobCompare.js), null until the transcript has been read.
 */
export function VobDocumentPane({
  doc, lookup, records, recordId, check, transcriptRead, onFile, onText, onRemove, onRecordChange, onShowResults,
  allRecords, manualRecord, manualConfirmed, onManualPick, onManualConfirm, onRetryLookup
}) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [pastedText, setPastedText] = useState('');

  const pickFile = () => inputRef.current?.click();

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
        <>
          <div className="queue-drop">
            <strong>Drop the VOB file here</strong>
            <span>The .docx or .pdf made for this patient. You can also paste the file (Ctrl+V).</span>
            <button type="button" className="btn btn-sm" onClick={pickFile}>📂 Import file</button>
          </div>

          <div className="queue-paste-vob">
            <label htmlFor="queue-vob-text" className="queue-paste-label">Or paste the VOB text</label>
            <textarea
              id="queue-vob-text"
              className="transcript-textarea"
              rows={6}
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="Copy the VOB from Word or the PDF and paste it here…"
            />
            <div className="queue-pane-actions">
              <button type="button" className="btn btn-sm" onClick={() => onText(pastedText)} disabled={!pastedText.trim()}>
                Read VOB text
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="queue-doc-bar">
            <span className="queue-doc-name" title={doc.name}>{DOC_ICONS[doc.kind]} {doc.name}</span>
            <span className="queue-doc-bar-actions">
              {doc.kind !== 'text' && <button type="button" className="btn-action-link" onClick={pickFile}>Replace</button>}
              <button type="button" className="btn-action-link danger-link" onClick={() => { setPastedText(''); onRemove(); }}>Remove</button>
            </span>
          </div>

          {doc.status === 'reading' && <div className="queue-doc-note">Reading the VOB…</div>}
          {doc.status === 'failed' && <div className="queue-doc-alert" role="alert">{doc.error}</div>}
          {doc.status === 'ready' && !doc.readable && (
            <div className="queue-doc-alert" role="alert">
              Couldn’t read this VOB’s fields: found {doc.found} of the template’s {doc.total} labels.
              Use the VOB made from the US24 template, as a .docx, a PDF with text in it, or its pasted text. A scanned PDF can’t be read.
            </div>
          )}
          {doc.status === 'ready' && doc.readable && (
            <RecordLine
              doc={doc}
              lookup={lookup}
              records={records}
              recordId={recordId}
              onRecordChange={onRecordChange}
              allRecords={allRecords}
              manualRecord={manualRecord}
              manualConfirmed={manualConfirmed}
              onManualPick={onManualPick}
              onManualConfirm={onManualConfirm}
              onRetryLookup={onRetryLookup}
            />
          )}
          {doc.status === 'ready' && doc.readable && !transcriptRead && (
            <div className="queue-doc-note">Paste the transcript and press Extract to check this VOB against the call.</div>
          )}

          {check && (
            <div className="queue-check-summary" aria-live="polite">
              <span className="check-chip match">✅ {check.counts.match} match</span>
              {check.counts.wrong > 0 && <span className="check-chip wrong">❌ {check.counts.wrong} wrong</span>}
              {check.counts.missing > 0 && <span className="check-chip missing">⚠️ {check.counts.missing} missing</span>}
              <button type="button" className="btn-action-link" onClick={onShowResults}>See results ↓</button>
            </div>
          )}

          {doc.kind === 'preview' && (
            <div className="queue-vob-preview-pane" style={{ marginTop: '16px' }}>
              <ParkerLivePreview formData={doc.fields} />
            </div>
          )}
          {doc.kind === 'pdf' && <iframe className="queue-pdf" src={doc.url} title={`VOB: ${doc.name}`} />}
          {doc.kind === 'docx' && <DocxView file={doc.file} />}
          {doc.kind === 'text' && <pre className="queue-vob-text">{doc.text}</pre>}
        </>
      )}
    </div>
  );
}
