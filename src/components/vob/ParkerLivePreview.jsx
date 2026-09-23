import React from 'react';

/**
 * The VOB output document.
 *
 * Mirrors docs/VOB_PARKER - Copy.docx, which is the master template every
 * client's VOB is generated from. That file is a PAT strip, a title, and a
 * 15-row two-column table whose eleventh row spans both columns. Rows, labels
 * and their order are reproduced from it; do not add or reorder rows here
 * unless the source document changes.
 *
 * DocumentGeneratorModal renders this same component, so the printed/saved
 * output and the on-screen preview cannot drift apart.
 */

/** One `Label: value` line inside a cell. */
function Line({ label, value, fallback = '—', mono = false, bold = false }) {
  const shown = value === 0 || value ? value : fallback;
  return (
    <div className="p-line">
      <span className="p-lbl">{label}</span>{' '}
      <span className={`p-val${mono ? ' font-mono' : ''}${bold ? ' font-semibold' : ''}`}>{shown}</span>
    </div>
  );
}

export function ParkerLivePreview({ formData = {}, onPrint }) {
  const f = formData;
  const handlePrint = () => (onPrint ? onPrint() : window.print());
  const todayDate = f.todayDate || new Date().toISOString().split('T')[0];

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
            {/* 1 */}
            <div className="p-row">
              <div className="p-cell p-cell-left"><Line label="Name:" value={f.patientName} bold /></div>
              <div className="p-cell p-cell-right"><Line label="DOB:" value={f.dob} /></div>
            </div>

            {/* 2 */}
            <div className="p-row">
              <div className="p-cell p-cell-left"><Line label="Today&rsquo;s Date:" value={todayDate} /></div>
              <div className="p-cell p-cell-right"><Line label="Additional Info:" value={f.additionalInfo} /></div>
            </div>

            {/* 3 */}
            <div className="p-row">
              <div className="p-cell p-cell-left">
                <Line label="Insurance Name:" value={f.insurance} bold />
                <Line label="Insurance Contact Number:" value={f.insurancePhone} />
              </div>
              <div className="p-cell p-cell-right">
                <Line label="Policy ID:" value={f.idCard} mono />
                <Line label="GROUP ID:" value={f.groupNo} mono />
              </div>
            </div>

            {/* 4 */}
            <div className="p-row">
              <div className="p-cell p-cell-left">
                <Line label="Service Type:" value={f.serviceType} />
                <Line label="Plan Type:" value={f.planType} />
                <Line label="Network Status:" value={f.networkStatus} />
                <Line label="Coverage:" value={f.coverageStatus} />
              </div>
              <div className="p-cell p-cell-right">
                <Line label="Effective Date:" value={f.effectiveDate} />
                <Line label="Termination Date:" value={f.terminationDate} fallback="NA" />
                {/* "HCA" is what the source document says. It reads like a slip for HSA,
                    but the export reproduces the template verbatim. */}
                <Line label="HCA/HRA AMT:" value={f.hsaHraAmt} fallback="NA" />
              </div>
            </div>

            {/* 5 */}
            <div className="p-row">
              <div className="p-cell p-cell-left">
                <Line label="Co-pay-" value={f.copay} fallback="NO" />
                <Line label="Amount:" value={f.copayAmount} />
              </div>
              <div className="p-cell p-cell-right">
                <Line label="Is Deductible Applied for PT Services:" value={f.deductibleApplicable} />
                <Line label="Deductible Individual:" value={f.deductibleIndividual} />
                <Line label="Met Amount:" value={f.deductibleMet} />
                <Line label="Remaining Amount:" value={f.deductibleRemaining} />
              </div>
            </div>

            {/* 6 */}
            <div className="p-row">
              <div className="p-cell p-cell-left">
                <Line label="Co-insurance:" value={f.copayCoinsurance} />
                <Line label="Covered:" value={f.coinsuranceCovered} />
              </div>
              <div className="p-cell p-cell-right">
                <Line label="Out of Pocket:" value={f.outOfPocket} />
                <Line label="Met Amount:" value={f.oopMet} />
                <Line label="Amount Remaining:" value={f.oopRemaining} />
              </div>
            </div>

            {/* 7 */}
            <div className="p-row">
              <div className="p-cell p-cell-left"><Line label="Visit Limitations:" value={f.visitsLimitation} /></div>
              <div className="p-cell p-cell-right"><Line label="Used Visit:" value={f.visitsUsed} fallback="NO" /></div>
            </div>

            {/* 8 */}
            <div className="p-row">
              <div className="p-cell p-cell-left">
                <Line label="Is Authorization Required for Initial Eval-" value={f.authInitialEval} fallback="NO" />
                <Line label="Is Authorization Required for Treatment-" value={f.authTreatment} fallback="NO" />
                <Line label="Referral Required -" value={f.referral} fallback="NO" />
                <Line label="Is Referral Required from PCP for Approval -" value={f.pcpReferral} fallback="NO" />
              </div>
              <div className="p-cell p-cell-right">
                <Line label="How to obtain Authorization?" value={f.howToObtainAuth} />
                <Line label="With In How many days we can request for Auth from DOS?" value={f.authRequestTat} />
              </div>
            </div>

            {/* 9 */}
            <div className="p-row">
              <div className="p-cell p-cell-left">
                <Line label="Authorization #" value={f.authNumber || f.authDetails?.authNumber} mono />
              </div>
              <div className="p-cell p-cell-right"><Line label="Auth Coverage Dates:" value={f.authCoverageDates} /></div>
            </div>

            {/* 10 */}
            <div className="p-row">
              <div className="p-cell p-cell-left">
                <Line label="PRIMARY:" value={f.primary} fallback="YES" />
                <Line label="SECONDARY:" value={f.secondary} fallback="NO" />
              </div>
              <div className="p-cell p-cell-right">
                <Line label="Insurance Rep Name:" value={f.insuranceRep} />
                <Line label="Call Reference:" value={f.callReference} mono />
              </div>
            </div>

            {/* 11 — spans both columns in the source document. */}
            <div className="p-row p-row-full">
              <div className="p-cell">
                <Line label="Claim Mailing Address:" value={f.claimMailingAddress} />
                <Line label="Payer ID:" value={f.payerId} mono />
                <Line label="TFL days for claims:" value={f.tflDaysClaims} />
                <Line label="TFL for corrected claims:" value={f.tflCorrectedClaims} />
              </div>
            </div>

            {/* 12 */}
            <div className="p-row">
              <div className="p-cell p-cell-left"><Line label="SECONDARY (YES/NO):" value={f.secondaryYesNo} fallback="NO" /></div>
              <div className="p-cell p-cell-right"><Line label="SECONDARY INS NAME-" value={f.secondaryInsName} /></div>
            </div>

            {/* 13 */}
            <div className="p-row">
              <div className="p-cell p-cell-left"><Line label="PLAN NAME:" value={f.secondaryPlanName} /></div>
              <div className="p-cell p-cell-right"><Line label="POLICY ID:" value={f.secondaryPolicyId} mono /></div>
            </div>

            {/* 14 */}
            <div className="p-row">
              <div className="p-cell p-cell-left"><Line label="EFFECTIVE DATE:" value={f.secondaryEffectiveDate} /></div>
              <div className="p-cell p-cell-right"><Line label="DEDUCTIBLE:" value={f.secondaryDeductible} fallback="NA" /></div>
            </div>

            {/* 15 */}
            <div className="p-row">
              <div className="p-cell p-cell-left"><Line label="VISIT LIMIT:" value={f.secondaryVisitLimit} fallback="MN" /></div>
              <div className="p-cell p-cell-right"><Line label="USED LIMIT:" value={f.secondaryUsedLimit} /></div>
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
