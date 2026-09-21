import React from 'react';

export function ParkerLivePreview({ formData = {}, onPrint }) {
  const handlePrint = () => {
    if (onPrint) {
      onPrint();
    } else {
      window.print();
    }
  };

  return (
    <div className="parker-preview-card">
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
          {/* Top Brand & Summary Header */}
          <div className="parker-top-bar">
            <div className="parker-logo-box">
              <div className="parker-brand-title">
                <span className="brand-navy">US24</span>
                <span className="brand-blue"> SOLUTIONS</span>
              </div>
              <div className="parker-brand-sub">Innovative Technology Driven</div>
              <div className="brand-orange-bar"></div>
            </div>

            <div className="parker-meta-boxes">
              <div className="meta-box pat-box">
                <span className="meta-box-label">PAT:</span>
                <span className="meta-box-val">{formData.pat || "$0.00 (100% COVERED)"}</span>
              </div>
              <div className="meta-box ins-box">
                <span className="meta-box-label">INS:</span>
                <span className="meta-box-val">{formData.insAmount || "—"}</span>
              </div>
            </div>
          </div>

          {/* Form Title */}
          <div className="parker-doc-title-row">
            <h2 className="parker-doc-title">Pre-Authorization & Benefits Determination</h2>
          </div>

          {/* Parker 2-Column Medical Benefits Table */}
          <div className="parker-table">
            {/* Row 1: Project & Request metadata */}
            <div className="p-row">
              <div className="p-cell p-cell-left">
                <div className="p-line"><span className="p-lbl">Project:</span> <span className="p-val">{formData.project || "—"}</span></div>
                <div className="p-line"><span className="p-lbl">Category:</span> <span className="p-val">{formData.category || "—"}</span></div>
              </div>
              <div className="p-cell p-cell-right">
                <div className="p-line"><span className="p-lbl">Request Type:</span> <span className="p-val">{formData.requestType || "CALL"}</span></div>
                <div className="p-line"><span className="p-lbl">Request Date:</span> <span className="p-val">{formData.requestDate || "—"}</span></div>
                <div className="p-line"><span className="p-lbl">Verification:</span> <span className="p-val">{formData.verificationType || "INITIAL"}</span></div>
              </div>
            </div>

            {/* Row 2: Patient Name & DOB */}
            <div className="p-row">
              <div className="p-cell p-cell-left">
                <div className="p-line"><span className="p-lbl">Name:</span> <span className="p-val font-semibold">{formData.patientName || "—"}</span></div>
              </div>
              <div className="p-cell p-cell-right">
                <div className="p-line"><span className="p-lbl">DOB:</span> <span className="p-val">{formData.dob || "—"}</span></div>
              </div>
            </div>

            {/* Row 3: Today's Date, PAT & Additional Info */}
            <div className="p-row">
              <div className="p-cell p-cell-left">
                <div className="p-line"><span className="p-lbl">Today's Date:</span> <span className="p-val">{formData.todayDate || new Date().toISOString().split('T')[0]}</span></div>
                <div className="p-line"><span className="p-lbl">PAT:</span> <span className="p-val">{formData.pat || "—"}</span></div>
              </div>
              <div className="p-cell p-cell-right">
                <div className="p-line"><span className="p-lbl">Additional Info:</span> <span className="p-val highlight-text">{formData.additionalInfo || "PATIENT IS 100% COVERED BY THE PAYER AS PER MEMBER'S PLAN."}</span></div>
              </div>
            </div>

            {/* Row 4: Insurance & IDs */}
            <div className="p-row">
              <div className="p-cell p-cell-left">
                <div className="p-line"><span className="p-lbl">Insurance Name:</span> <span className="p-val font-semibold">{formData.insurance || "—"}</span></div>
                <div className="p-line"><span className="p-lbl">Insurance Contact Number:</span> <span className="p-val">{formData.insurancePhone || "—"}</span></div>
              </div>
              <div className="p-cell p-cell-right">
                <div className="p-line"><span className="p-lbl">Policy ID:</span> <span className="p-val font-mono">{formData.idCard || "—"}</span></div>
                <div className="p-line"><span className="p-lbl">GROUP ID:</span> <span className="p-val font-mono">{formData.groupNo || "—"}</span></div>
              </div>
            </div>

            {/* Row 5: Service, Plan, Network & Effective */}
            <div className="p-row">
              <div className="p-cell p-cell-left">
                <div className="p-line"><span className="p-lbl">Service Type:</span> <span className="p-val">{formData.serviceType || "PT"}</span></div>
                <div className="p-line"><span className="p-lbl">Plan Type:</span> <span className="p-val">{formData.planType || "—"}</span></div>
                <div className="p-line"><span className="p-lbl">Plan Name:</span> <span className="p-val">{formData.planName || "—"}</span></div>
                <div className="p-line"><span className="p-lbl">Network Status:</span> <span className="p-val">{formData.networkStatus || "—"}</span></div>
                <div className="p-line"><span className="p-lbl">Coverage:</span> <span className="p-val">{formData.coverageStatus || "—"}</span></div>
              </div>
              <div className="p-cell p-cell-right">
                <div className="p-line"><span className="p-lbl">Effective Date:</span> <span className="p-val">{formData.effectiveDate || "—"}</span></div>
                <div className="p-line"><span className="p-lbl">Termination Date:</span> <span className="p-val">{formData.terminationDate || "NO"}</span></div>
                <div className="p-line"><span className="p-lbl">HSA/HRA AMT:</span> <span className="p-val">{formData.hsaHraAmt || "NA"}</span></div>
              </div>
            </div>

            {/* Row 6: Copay & Deductibles */}
            <div className="p-row">
              <div className="p-cell p-cell-left">
                <div className="p-line"><span className="p-lbl">Co-pay?</span> <span className="p-val">{formData.copay || "NO"}</span></div>
                <div className="p-line"><span className="p-lbl">Amount:</span> <span className="p-val">{formData.copayAmount || "—"}</span></div>
              </div>
              <div className="p-cell p-cell-right">
                <div className="p-line"><span className="p-lbl">Is Deductible Applied for PT Services:</span> <span className="p-val">{formData.deductibleApplicable || "—"}</span></div>
                <div className="p-line"><span className="p-lbl">Deductible Individual:</span> <span className="p-val">{formData.deductibleIndividual || "—"}</span></div>
                <div className="p-line"><span className="p-lbl">Met Amount:</span> <span className="p-val">{formData.deductibleMet || "—"}</span></div>
                <div className="p-line"><span className="p-lbl">Remaining Amount:</span> <span className="p-val">{formData.deductibleRemaining || "—"}</span></div>
              </div>
            </div>

            {/* Row 7: Co-Insurance & OOP */}
            <div className="p-row">
              <div className="p-cell p-cell-left">
                <div className="p-line"><span className="p-lbl">Co-Insurance:</span> <span className="p-val">{formData.copayCoinsurance || formData.coinsurance || "—"}</span></div>
                <div className="p-line"><span className="p-lbl">Covered:</span> <span className="p-val">{formData.coinsuranceCovered || "—"}</span></div>
              </div>
              <div className="p-cell p-cell-right">
                <div className="p-line"><span className="p-lbl">Out of Pocket:</span> <span className="p-val">{formData.outOfPocket || "—"}</span></div>
                <div className="p-line"><span className="p-lbl">Met Amount:</span> <span className="p-val">{formData.oopMet || "—"}</span></div>
                <div className="p-line"><span className="p-lbl">Amount Remaining:</span> <span className="p-val">{formData.oopRemaining || "—"}</span></div>
              </div>
            </div>

            {/* Row 8: Visit Limitations */}
            <div className="p-row">
              <div className="p-cell p-cell-left">
                <div className="p-line"><span className="p-lbl">Visit Limitations:</span> <span className="p-val">{formData.visitsLimitation || "—"}</span></div>
                <div className="p-line"><span className="p-lbl">Initial Treatment Date:</span> <span className="p-val">{formData.initialDos || formData.initialTreatmentDate || "—"}</span></div>
              </div>
              <div className="p-cell p-cell-right">
                <div className="p-line"><span className="p-lbl">Used Visit:</span> <span className="p-val">{formData.visitsUsed || "NO"}</span></div>
              </div>
            </div>

            {/* Row 9: Authorization & Referrals */}
            <div className="p-row">
              <div className="p-cell p-cell-left">
                <div className="p-line"><span className="p-lbl">Is Authorization Required for Initial Eval?</span> <span className="p-val">{formData.authInitialEval || "NO"}</span></div>
                <div className="p-line"><span className="p-lbl">Is Authorization Required for Treatment?</span> <span className="p-val">{formData.authTreatment || "NO"}</span></div>
                <div className="p-line"><span className="p-lbl">Referral Required?</span> <span className="p-val">{formData.referral || "NO"}</span></div>
                <div className="p-line"><span className="p-lbl">Is Referral Required from PCP for Approval?</span> <span className="p-val">{formData.pcpReferral || "NO"}</span></div>
              </div>
              <div className="p-cell p-cell-right">
                <div className="p-line"><span className="p-lbl">How to obtain Authorization?</span> <span className="p-val">{formData.howToObtainAuth || "—"}</span></div>
                <div className="p-line"><span className="p-lbl">With In How many days we can request for Auth?</span> <span className="p-val">{formData.authRequestTat || "—"}</span></div>
              </div>
            </div>

            {/* Row 10: Auth Confirmation */}
            <div className="p-row">
              <div className="p-cell p-cell-left">
                <div className="p-line"><span className="p-lbl">Authorization #:</span> <span className="p-val font-mono">{formData.authNumber || formData.authDetails?.authNumber || "—"}</span></div>
              </div>
              <div className="p-cell p-cell-right">
                <div className="p-line"><span className="p-lbl">Auth Coverage Dates:</span> <span className="p-val">{formData.authCoverageDates || "—"}</span></div>
              </div>
            </div>

            {/* Row 11: Coordination & Rep Info */}
            <div className="p-row">
              <div className="p-cell p-cell-left">
                <div className="p-line">
                  <span className="p-lbl">PRIMARY:</span> <span className="p-val">{formData.primary || "YES"}</span> &nbsp;&nbsp;
                  <span className="p-lbl">SECONDARY:</span> <span className="p-val">{formData.secondary || "NO"}</span>
                </div>
              </div>
              <div className="p-cell p-cell-right">
                <div className="p-line"><span className="p-lbl">Insurance Rep Name:</span> <span className="p-val">{formData.insuranceRep || "—"}</span></div>
                <div className="p-line"><span className="p-lbl">Call Reference:</span> <span className="p-val font-mono">{formData.callReference || "—"}</span></div>
              </div>
            </div>

            {/* Row 12: Claim Filing & Secondary */}
            <div className="p-row">
              <div className="p-cell p-cell-left">
                <div className="p-line"><span className="p-lbl">Claim Mailing Address:</span> <span className="p-val">{formData.claimMailingAddress || "—"}</span></div>
                <div className="p-line"><span className="p-lbl">Payer ID:</span> <span className="p-val font-mono">{formData.payerId || "—"}</span></div>
                <div className="p-line">
                  <span className="p-lbl">TFL days for claims:</span> <span className="p-val">{formData.tflDaysClaims || "90 days"}</span> &nbsp;
                  <span className="p-lbl">TFL for corrected:</span> <span className="p-val">{formData.tflCorrectedClaims || "180 days"}</span>
                </div>
              </div>
              <div className="p-cell p-cell-right">
                <div className="p-line"><span className="p-lbl">SECONDARY (YES/NO):</span> <span className="p-val">{formData.secondaryYesNo || "NO"}</span></div>
                <div className="p-line"><span className="p-lbl">SECONDARY INS NAME:</span> <span className="p-val">{formData.secondaryInsName || "—"}</span></div>
                <div className="p-line"><span className="p-lbl">POLICY ID:</span> <span className="p-val">{formData.secondaryPolicyId || "—"}</span></div>
              </div>
            </div>

            {/* Row 13: Secondary details */}
            <div className="p-row">
              <div className="p-cell p-cell-left">
                <div className="p-line"><span className="p-lbl">PLAN NAME:</span> <span className="p-val">{formData.secondaryPlanName || "—"}</span></div>
                <div className="p-line"><span className="p-lbl">EFFECTIVE DATE:</span> <span className="p-val">{formData.secondaryEffectiveDate || "—"}</span></div>
                <div className="p-line"><span className="p-lbl">VISIT LIMIT:</span> <span className="p-val">{formData.secondaryVisitLimit || "MN"}</span></div>
              </div>
              <div className="p-cell p-cell-right">
                <div className="p-line"><span className="p-lbl">DEDUCTIBLE:</span> <span className="p-val">{formData.secondaryDeductible || "NA"}</span></div>
                <div className="p-line"><span className="p-lbl">USED LIMIT:</span> <span className="p-val">{formData.secondaryUsedLimit || "—"}</span></div>
              </div>
            </div>
          </div>

          <div className="parker-footer-note">
            HIPAA BAA Confidential Document · US24 Solutions Verification of Benefits
          </div>
        </div>
      </div>
    </div>
  );
}
