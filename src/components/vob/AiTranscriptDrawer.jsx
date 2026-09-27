import React, { useState, useRef } from 'react';
import { vobsApi } from '../../api/vobs';

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

export function AiTranscriptDrawer({ isOpen, onClose, vobId, onApplyFields }) {
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    readTranscriptFile(file);
    e.target.value = '';
  };

  const readTranscriptFile = (file) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result || '';
      setTranscript(text);
      setResult(null);
      setError('');
    };
    reader.readAsText(file);
  };

  // One call: the API reads the transcript, checks every value against the
  // payer's words in it, and answers. If it cannot, the specialist is told so —
  // nothing is guessed in its place.
  const handleExtract = async () => {
    if (!transcript.trim()) return;
    setIsProcessing(true);
    setResult(null);
    setError('');
    try {
      setResult(await vobsApi.extract(vobId, transcript));
    } catch (err) {
      setError(describeFailure(err));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApplyAll = () => {
    if (result?.proposed.length) {
      onApplyFields(result.fields);
      onClose();
    }
  };

  const handleApplySafeOnly = () => {
    const safeItems = result?.proposed?.filter(p => p.isSafe) || [];
    if (safeItems.length) {
      const safeMap = Object.fromEntries(safeItems.map(p => [p.key, p.value]));
      onApplyFields(safeMap);
      onClose();
    }
  };

  const safeCount = result?.proposed?.filter(p => p.isSafe).length || 0;
  const totalProposed = result?.proposed?.length || 0;

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <div>
            <div className="drawer-eyebrow">Transcript Extraction (Groq AI)</div>
            <h2 className="drawer-title">AI Transcript Auto-Fill</h2>
          </div>
          <button type="button" className="drawer-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="drawer-body">
          <p className="drawer-description">
            Paste the payer call transcript or portal eligibility text. The AI proposes values for <strong>empty fields only</strong>, each with the payer's words it came from. Nothing is saved until you save the form.
          </p>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink)' }}>
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
                  onClick={() => { setTranscript(''); setResult(null); setError(''); }}
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

          {isProcessing && (
            <div className="ai-progress-wrap">
              <div className="ai-progress-bar" style={{ width: '100%' }} />
              <span className="ai-progress-text">Reading transcript with Groq AI… verifying quotes & payer statements.</span>
            </div>
          )}

          {error && (
            <div className="extracted-preview-box" role="alert" style={{ borderColor: 'var(--danger, #dc2626)' }}>
              <span className="extracted-note" style={{ color: 'var(--danger, #dc2626)', fontWeight: 600 }}>{error}</span>
            </div>
          )}

          {result && (
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
        </div>

        <div className="drawer-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          {!result ? (
            <button
              type="button"
              className="btn"
              onClick={handleExtract}
              disabled={isProcessing || !transcript.trim()}
            >
              {isProcessing ? 'Reading with Groq…' : error ? 'Try Again' : 'Extract & Preview'}
            </button>
          ) : (
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
          )}
        </div>
      </div>
    </div>
  );
}
