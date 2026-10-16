import React, { useState, useRef, useEffect } from 'react';
import { vobsApi } from '../../api/vobs';

/**
 * The API's limit (MAX_TRANSCRIPT_CHARS in the backend's
 * src/features/vobs/extraction.ts), checked here so a transcript over it gets a
 * clear message instead of the API's generic 400.
 */
const MAX_TRANSCRIPT_CHARS = 300000;

/** What went wrong, in the specialist's terms. Never a guess in place of an answer. */
function describeFailure(err) {
  switch (err?.status) {
    case 503: {
      const reason = err.data?.error?.details?.reason;
      return `Auto-fill is unavailable right now${reason ? ` (${reason.replace(/_/g, ' ')})` : ''}. Enter the values manually.`;
    }
    case 409:
      return 'This VOB is approved and can no longer be changed.';
    case 404:
      return 'This VOB is not assigned to you.';
    case 403:
      return 'Only the specialist assigned to this VOB can run auto-fill.';
    default:
      return err?.message || 'Auto-fill failed. Enter the values manually.';
  }
}

const displayValue = (v) => (v === true ? 'Yes' : v === false ? 'No' : String(v ?? ''));

/**
 * A pasted transcript and what the API read from it. Kept by whoever shows the
 * panel, so the AI drawer keeps its text and result while it is closed.
 */
export function useTranscriptExtraction(vobId, { allFields = false, initialTranscript = '', transcriptFileName = '' } = {}) {
  const [transcript, setTranscript] = useState(initialTranscript || '');
  const [fileName, setFileName] = useState(transcriptFileName || '');
  const [isStorageBacked, setIsStorageBacked] = useState(Boolean(initialTranscript));
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState(0);

  // Sync initialTranscript when active VOB loads or switches
  useEffect(() => {
    if (initialTranscript && (!transcript || transcript === '')) {
      setTranscript(initialTranscript);
      setIsStorageBacked(true);
    }
    if (transcriptFileName) {
      setFileName(transcriptFileName);
    }
  }, [initialTranscript, transcriptFileName]);

  // Seconds since Extract was pressed, so a long read shows as working, not stuck.
  useEffect(() => {
    if (!isProcessing) return undefined;
    const startedAt = Date.now();
    setElapsed(0);
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(id);
  }, [isProcessing]);

  // A reading belongs to the VOB it was made on: another VOB starts without
  // one, and an answer that comes back after the VOB changed is dropped.
  const currentVob = useRef(vobId);
  useEffect(() => {
    currentVob.current = vobId;
    setResult(null);
    setError('');
  }, [vobId]);

  // The API trims before it counts, so this does too.
  const length = transcript.trim().length;
  const tooLong = length > MAX_TRANSCRIPT_CHARS;

  const readTranscriptFile = async (file) => {
    setFileName(file.name);
    try {
      if (vobId) {
        const res = await vobsApi.uploadTranscriptFile(vobId, file);
        if (res?.text) {
          setTranscript(res.text);
          setIsStorageBacked(true);
          setResult(null);
          setError('');
          return;
        }
      }
    } catch (err) {
      console.warn('Azure storage upload fallback to local read:', err);
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result || '';
      setTranscript(text);
      setIsStorageBacked(false);
      setResult(null);
      setError('');
    };
    reader.readAsText(file);
  };

  const clear = () => { setTranscript(''); setFileName(''); setIsStorageBacked(false); setResult(null); setError(''); };

  // One call: the API reads the transcript with Gemini LLM, checks every value
  // against the payer's words in it, and answers. Can run with or without a VOB ID.
  const extract = async (options = {}) => {
    if (!transcript.trim() || tooLong) return;
    const askedFor = vobId;
    const shouldCheckAll = options.allFields !== undefined ? options.allFields : allFields;
    setIsProcessing(true);
    setResult(null);
    setError('');
    try {
      const reading = await vobsApi.extract(askedFor, transcript, { allFields: shouldCheckAll });
      if (currentVob.current === askedFor) setResult(reading);
    } catch (err) {
      if (currentVob.current === askedFor) setError(describeFailure(err));
    } finally {
      setIsProcessing(false);
    }
  };

  return { transcript, setTranscript, fileName, isStorageBacked, isProcessing, result, error, elapsed, length, tooLong, readTranscriptFile, clear, extract };
}

/**
 * The transcript box and the values read from it, for useTranscriptExtraction's
 * state. A screen that uses what was read its own way passes its own
 * `description` and `showResult={false}` to leave out the result list.
 */
export function TranscriptExtractBody({ extraction, showResult = true, description }) {
  const { transcript, setTranscript, isProcessing, result, error, elapsed, length, tooLong, readTranscriptFile, clear } = extraction;
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    readTranscriptFile(file);
    e.target.value = '';
  };

  return (
    <>
      <p className="drawer-description">
        {description ?? (
          <>Paste the payer call transcript or portal eligibility text. The AI proposes values for <strong>empty fields only</strong>, each with the payer's words it came from. Nothing is saved until you save the form.</>
        )}
      </p>

      {transcript && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', padding: '6px 12px', background: 'rgba(2, 132, 199, 0.08)', border: '1px solid rgba(2, 132, 199, 0.2)', borderRadius: '6px', fontSize: '12px' }}>
          <span style={{ fontWeight: 600, color: '#0369a1' }}>☁️ Azure Blob Storage:</span>
          <span style={{ color: 'var(--ink)' }}>{extraction.fileName ? `📄 ${extraction.fileName}` : 'Associated Call Transcript'}</span>
        </div>
      )}

      <div className="transcript-input-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <span className="transcript-input-label" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink)' }}>
          Transcript / Portal Inquiry Text:
        </span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="file"
            ref={fileInputRef}
            accept=".txt,.json,.csv,.log,.doc,.docx"
            style={{ display: 'none' }}
            onChange={handleFileUpload}
          />
          <button
            type="button"
            className="btn btn-sm ghost"
            onClick={() => fileInputRef.current?.click()}
            title="Upload transcript or inquiry file (.txt, .json, .csv)"
          >
            📁 Upload Transcript File
          </button>
          {transcript && (
            <button
              type="button"
              className="btn btn-sm ghost"
              onClick={clear}
              title="Clear transcript text"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div
        className={`transcript-input-wrap ${isDragging ? 'drag-active' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) readTranscriptFile(file);
        }}
      >
        <textarea
          className="transcript-textarea"
          rows={11}
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Paste raw conversation notes, drag & drop transcript file, or click 'Upload Transcript File' above..."
        />
      </div>
      <div style={{ fontSize: '11px', textAlign: 'right', marginTop: '4px', color: tooLong ? 'var(--danger, #dc2626)' : 'var(--ink-soft)' }}>
        {length.toLocaleString()} / {MAX_TRANSCRIPT_CHARS.toLocaleString()} characters
      </div>

      {tooLong && (
        <div className="extracted-preview-box" role="alert" style={{ borderColor: 'var(--danger, #dc2626)' }}>
          <span className="extracted-note" style={{ color: 'var(--danger, #dc2626)', fontWeight: 600 }}>
            This transcript is {length.toLocaleString()} characters; the limit is {MAX_TRANSCRIPT_CHARS.toLocaleString()}. Remove repeated hold messages or split the call.
          </span>
        </div>
      )}

      {isProcessing && (
        <div className="ai-progress-wrap">
          <div className="ai-progress-bar" style={{ width: '100%' }} />
          <span className="ai-progress-text">Reading transcript with  AI… verifying quotes & payer statements. {elapsed} s</span>
        </div>
      )}

      {error && (
        <div className="extracted-preview-box" role="alert" style={{ borderColor: 'var(--danger, #dc2626)' }}>
          <span className="extracted-note" style={{ color: 'var(--danger, #dc2626)', fontWeight: 600 }}>{error}</span>
        </div>
      )}

      {showResult && result && (
        <div className="extracted-preview-box">
          {result.quality?.warning && (
            <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '6px', padding: '10px 14px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px' }}>⚠️</span>
              <span style={{ fontSize: '12px', color: '#92400e', fontWeight: 500 }}>
                {result.quality.warning}
              </span>
            </div>
          )}

          <div className="extracted-preview-head">
            <span className="ai-chip">
              ✨ {result.proposed.length} value{result.proposed.length === 1 ? '' : 's'} found
            </span>
            <span className="extracted-note">
              Read by {result.provider}
              {result.failovers.length > 0 && ` (after ${result.failovers.map((f) => f.provider).join(', ')} failed)`}
              {' · '}applies with [AI Transcript] tag
            </span>
          </div>

          {result.proposed.length === 0 && (
            <p className="extracted-note">
              The transcript did not clearly answer any empty field. Nothing will be filled.
            </p>
          )}

          <div className="extracted-grid">
            {result.proposed.map((p) => (
              <div key={p.key} className="extracted-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="extracted-k">{p.label}</span>
                    {p.isSafe && (
                      <span style={{ fontSize: '10px', background: '#dcfce7', color: '#15803d', padding: '1px 5px', borderRadius: '4px', fontWeight: 600 }}>
                        ✓ Safe
                      </span>
                    )}
                    {p.status && p.status !== 'FOUND' && (
                      <span style={{ fontSize: '10px', background: '#fef3c7', color: '#b45309', padding: '1px 5px', borderRadius: '4px', fontWeight: 600 }}>
                        {p.status}
                      </span>
                    )}
                    {p.source && (
                      <span style={{ fontSize: '10px', color: 'var(--ink-soft)' }}>
                        [{p.source === 'payer_rep' ? 'Rep' : p.source === 'specialist' ? 'Specialist' : 'Portal'}]
                      </span>
                    )}
                  </div>
                  <span className="extracted-v">
                    {displayValue(p.value)}
                    {p.confidence === 'medium' && <span title="The payer's words needed interpreting — review before submitting"> ⚠</span>}
                  </span>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--ink-soft)', fontStyle: 'italic' }}>“{p.evidence}”</span>
              </div>
            ))}
          </div>

          {result.conflicts.length > 0 && (
            <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--rule)' }}>
              <span className="extracted-note" style={{ fontWeight: 600, color: 'var(--ink)' }}>
                Conflicts Detected (Review Required):
              </span>
              {result.conflicts.map((c) => (
                <div key={c.key} className="extracted-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '4px', marginTop: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                    <span className="extracted-k">{c.label}</span>
                    <span className="extracted-v" style={{ color: 'var(--danger, #dc2626)' }}>
                      {c.conflictType === 'transcript_conflict' ? (
                        <span>Call Contradiction: {displayValue(c.current)} vs {displayValue(c.value)}</span>
                      ) : (
                        <span>VOB: {displayValue(c.current)} → Proposed: {displayValue(c.value)}</span>
                      )}
                    </span>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--ink-soft)', fontStyle: 'italic' }}>“{c.evidence}”</span>
                </div>
              ))}
            </div>
          )}

          {result.stillToAsk.length > 0 && (
            <div style={{ marginTop: '12px', padding: '8px 12px', background: 'var(--surface-muted, #f8fafc)', borderRadius: '6px' }}>
              <strong style={{ fontSize: '11px', color: 'var(--ink)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Still to Ask ({result.stillToAsk.length}):
              </strong>
              <p className="extracted-note" style={{ marginTop: '4px', margin: 0 }}>
                {result.stillToAsk.join(', ')}
              </p>
            </div>
          )}
        </div>
      )}
    </>
  );
}

/**
 * Extract before there is a result; the apply buttons after. `onApply` gets the
 * form keys and values to fill.
 */
export function TranscriptExtractActions({ extraction, onApply }) {
  const { transcript, isProcessing, result, error, tooLong, extract } = extraction;

  const handleApplyAll = () => {
    if (result?.proposed.length) {
      onApply(result.fields);
    }
  };

  const handleApplySafeOnly = () => {
    const safeItems = result?.proposed?.filter(p => p.isSafe) || [];
    if (safeItems.length) {
      onApply(Object.fromEntries(safeItems.map(p => [p.key, p.value])));
    }
  };

  const safeCount = result?.proposed?.filter(p => p.isSafe).length || 0;
  const totalProposed = result?.proposed?.length || 0;

  if (!result) {
    return (
      <button
        type="button"
        className="btn"
        onClick={extract}
        disabled={isProcessing || !transcript.trim() || tooLong}
      >
        {isProcessing ? 'Reading with AI ' : error ? 'Try Again' : 'Extract & Preview'}
      </button>
    );
  }

  return (
    <>
      {safeCount > 0 && safeCount < totalProposed && (
        <button
          type="button"
          className="btn"
          style={{ background: '#0284c7', borderColor: '#0284c7' }}
          onClick={handleApplySafeOnly}
        >
          Apply Safe Fields Only ({safeCount})
        </button>
      )}
      <button
        type="button"
        className="btn"
        style={{ background: '#16a34a', borderColor: '#16a34a' }}
        onClick={handleApplyAll}
        disabled={totalProposed === 0}
      >
        Apply All {totalProposed} (Empty Fields Only)
      </button>
    </>
  );
}
