import React, { useState } from 'react';
import { vobsApi } from '../../api/vobs';

const SAMPLE_TRANSCRIPT_CALL = `AGENT: Thank you for calling UnitedHealthcare Provider Services. My name is Denise, ID #84920. Who do I have the pleasure of speaking with?
SPECIALIST: Hi Denise, this is Rohit from US24 on behalf of Arra Clinic. Verifying active eligibility and physical therapy benefits for patient Eleanor Vance, DOB 04/12/1984, Member ID UHC-992817263.
AGENT: Thank you Rohit. Coverage is active under UHC Choice Plus PPO. The network status is In-Network for both group and individual provider contracts. Payer ID is 87726.
SPECIALIST: Does the patient have a deductible, and what is the copay for outpatient physical therapy?
AGENT: Yes, annual individual deductible is $500 which is already fully met. Physical therapy copay is $20.00 per visit, followed by 10% coinsurance.
SPECIALIST: Is prior authorization or referral required?
AGENT: No authorization required for the first 24 visits per calendar year. No referral required.
SPECIALIST: Thank you Denise. Reference number for this call?
AGENT: Call reference is UHC-REF-99201. Have a wonderful day!`;

const SAMPLE_TRANSCRIPT_PORTAL = `[AVAILITY ELIGIBILITY INQUIRY RESULT]
Payer: Cigna Healthcare (62308) | Date: 09/21/2026 09:30 AM
Patient: David O'Connor | DOB: 09/15/1968 | Member ID: U819203910
Plan: Cigna Open Access Plus | Group: 009827
Coverage Status: ACTIVE | Policy Effective: 01/01/2026 - Current
Benefit Category: Physical Therapy / Occupational Therapy
Network: IN-NETWORK (Group & Individual)
Copay: $30.00 Specialist Copay per DOS
Deductible: $1,000 Individual (Met: $1,000. Remaining: $0.00)
Authorization: NO PRIOR AUTH REQUIRED FOR IN-NETWORK INITIAL EVALUATION
Limitation: 30 Visits per Calendar Year
Contact: 1-800-244-6224 | Rep Ref: AV-881928`;

export function AiTranscriptDrawer({ isOpen, onClose, vobId, onApplyFields }) {
  const [transcript, setTranscript] = useState(SAMPLE_TRANSCRIPT_CALL);
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

          <div className="sample-buttons-row">
            <span className="sample-label">Load Sample:</span>
            <button
              type="button"
              className="btn-sample"
              onClick={() => setTranscript(SAMPLE_TRANSCRIPT_CALL)}
            >
              UHC Phone Call
            </button>
            <button
              type="button"
              className="btn-sample"
              onClick={() => setTranscript(SAMPLE_TRANSCRIPT_PORTAL)}
            >
              Cigna Availity Text
            </button>
          </div>

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
