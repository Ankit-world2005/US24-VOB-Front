import React, { useState } from 'react';
import { vobsApi } from '../../api/vobs';
export function AiTranscriptDrawer({ isOpen, onClose, vobId, onApplyFields }) {
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [extractedData, setExtractedData] = useState(null);

  if (!isOpen) return null;

  const handleExtract = async () => {
    if (!transcript.trim()) return;
    setIsProcessing(true);
    setProgress(20);
    setExtractedData(null);

    try {
      const { jobId } = await vobsApi.postTranscript(vobId, transcript);
      setProgress(50);

      // Poll extraction job
      const pollInterval = setInterval(async () => {
        try {
          const res = await vobsApi.getExtraction(vobId, jobId);
          if (res.status === 'completed') {
            clearInterval(pollInterval);
            setProgress(100);
            setIsProcessing(false);
            setExtractedData(res.extractedFields);
          } else {
            setProgress(res.progress || 75);
          }
        } catch (e) {
          clearInterval(pollInterval);
          setIsProcessing(false);
        }
      }, 400);
    } catch (err) {
      setIsProcessing(false);
      alert('Error initiating AI extraction');
    }
  };

  const handleApply = () => {
    if (extractedData) {
      onApplyFields(extractedData);
      onClose();
    }
  };

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <div>
            <div className="drawer-eyebrow">HIPAA BAA Compliant Engine</div>
            <h2 className="drawer-title">AI Transcript Auto-Fill</h2>
          </div>
          <button type="button" className="drawer-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="drawer-body">
          <p className="drawer-description">
            Paste payer phone call transcripts or provider portal eligibility text. The AI extracts coverage rules and fills <strong>only empty fields</strong> without overwriting existing data.
          </p>


          <div className="transcript-input-wrap">
            <textarea
              className="transcript-textarea"
              rows={11}
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Paste raw conversation notes or payer portal response here..."
            />
          </div>

          {isProcessing && (
            <div className="ai-progress-wrap">
              <div className="ai-progress-bar" style={{ width: `${progress}%` }} />
              <span className="ai-progress-text">Analyzing transcript with HIPAA NLP model ({progress}%)…</span>
            </div>
          )}

          {extractedData && (
            <div className="extracted-preview-box">
              <div className="extracted-preview-head">
                <span className="ai-chip">✨ {Object.keys(extractedData).length} Fields Extracted</span>
                <span className="extracted-note">Will apply with [AI Transcript] provenance badge</span>
              </div>
              <div className="extracted-grid">
                {Object.entries(extractedData).map(([k, val]) => (
                  <div key={k} className="extracted-item">
                    <span className="extracted-k">{k}</span>
                    <span className="extracted-v">{val}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="drawer-footer">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          {!extractedData ? (
            <button
              type="button"
              className="btn"
              onClick={handleExtract}
              disabled={isProcessing || !transcript.trim()}
            >
              {isProcessing ? 'Extracting Fields…' : 'Extract & Preview'}
            </button>
          ) : (
            <button
              type="button"
              className="btn"
              style={{ background: '#16a34a', borderColor: '#16a34a' }}
              onClick={handleApply}
            >
              Apply to VOB Form (Safe Fill)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
