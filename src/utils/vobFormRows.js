/**
 * The VOB form document's table, row by row and line by line.
 *
 * Mirrors docs/VOB_PARKER - Copy.docx, the master template every client's VOB
 * is generated from: a 15-row two-column table whose eleventh row spans both
 * columns. Rows, labels and their order are reproduced from it; do not add or
 * reorder rows here unless the source document changes.
 *
 * The on-screen preview (ParkerLivePreview) and the Word export (vobDocx) both
 * render from this, so the two cannot drift apart. Each line also names the
 * form field it shows (`field`), so the document reader (vobDocumentParser)
 * maps a document's lines back to the form from the same table.
 */

const line = (label, value, opts = {}) => ({ label, value, fallback: '—', ...opts });

/** What a line shows: its value, or the template's placeholder when there is none. */
export const shownValue = ({ value, fallback }) => (value === 0 || value ? value : fallback);

/** The document date: the one the specialist entered, else today. */
export const formTodayDate = (f) => f.todayDate || new Date().toISOString().split('T')[0];

/**
 * The PRIMARY line names the primary insurance ("PRIMARY: BCBS"), as the
 * specialists write it. Coverage order holds "Primary" for a primary plan, so
 * that, or nothing, shows the insurance name.
 */
export const formPrimary = (f) => {
  const order = String(f.primary ?? '').trim();
  return !order || /^primary$/i.test(order) ? f.insurance : order;
};

/** Each row's cells, left to right; each cell's lines, top to bottom. */
export function vobFormRows(f) {
  return [
    // 1
    { cells: [[line('Name:', f.patientName, { field: 'patientName', bold: true })], [line('DOB:', f.dob, { field: 'dob' })]] },
    // 2
    {
      cells: [
        [line('Today’s Date:', formTodayDate(f), { field: 'todayDate' })],
        [line('Additional Info:', f.additionalInfo, { field: 'additionalInfo' })]
      ]
    },
    // 3
    {
      cells: [
        [
          line('Insurance Name:', f.insurance, { field: 'insurance', bold: true }),
          line('Insurance Contact Number:', f.insurancePhone, { field: 'insurancePhone' })
        ],
        [
          line('Policy ID:', f.idCard, { field: 'idCard', mono: true }),
          line('GROUP ID:', f.groupNo, { field: 'groupNo', mono: true })
        ]
      ]
    },
    // 4. "HCA" is what the source document says. It reads like a slip for HSA,
    // but the export reproduces the template verbatim.
    {
      cells: [
        [
          line('Service Type:', f.serviceType, { field: 'serviceType' }),
          line('Plan Type:', f.planType, { field: 'planType' }),
          line('Network Status:', f.networkStatus, { field: 'networkStatus' }),
          line('Coverage:', f.coverageStatus, { field: 'coverageStatus' })
        ],
        [
          line('Effective Date:', f.effectiveDate, { field: 'effectiveDate' }),
          line('Termination Date:', f.terminationDate, { field: 'terminationDate', fallback: 'NA' }),
          line('HCA/HRA AMT:', f.hsaHraAmt, { field: 'hsaHraAmt', fallback: 'NA' })
        ]
      ]
    },
    // 5
    {
      cells: [
        [
          line('Co-pay-', f.copay, { field: 'copay', fallback: 'NO' }),
          line('Amount:', f.copayAmount, { field: 'copayAmount' })
        ],
        [
          line('Is Deductible Applied for PT Services:', f.deductibleApplicable, { field: 'deductibleApplicable' }),
          line('Deductible Individual:', f.deductibleIndividual, { field: 'deductibleIndividual' }),
          line('Met Amount:', f.deductibleMet, { field: 'deductibleMet' }),
          line('Remaining Amount:', f.deductibleRemaining, { field: 'deductibleRemaining' })
        ]
      ]
    },
    // 6
    {
      cells: [
        [
          line('Co-insurance:', f.copayCoinsurance, { field: 'copayCoinsurance' }),
          line('Covered:', f.coinsuranceCovered, { field: 'coinsuranceCovered' })
        ],
        [
          line('Out of Pocket:', f.outOfPocket, { field: 'outOfPocket' }),
          line('Met Amount:', f.oopMet, { field: 'oopMet' }),
          line('Amount Remaining:', f.oopRemaining, { field: 'oopRemaining' })
        ]
      ]
    },
    // 7
    {
      cells: [
        [line('Visit Limitations:', f.visitsLimitation, { field: 'visitsLimitation' })],
        [line('Used Visit:', f.visitsUsed, { field: 'visitsUsed', fallback: '00' })]
      ]
    },
    // 8
    {
      cells: [
        [
          line('Is Authorization Required for Initial Eval-', f.authInitialEval, { field: 'authInitialEval', fallback: 'NO' }),
          line('Is Authorization Required for Treatment-', f.authTreatment, { field: 'authTreatment', fallback: 'NO' }),
          line('Referral Required -', f.referral, { field: 'referral', fallback: 'NO' }),
          line('Is Referral Required from PCP for Approval -', f.pcpReferral, { field: 'pcpReferral', fallback: 'NO' })
        ],
        [
          line('How to obtain Authorization?', f.howToObtainAuth, { field: 'howToObtainAuth' }),
          line('With In How many days we can request for Auth from DOS?', f.authRequestTat, { field: 'authRequestTat' })
        ]
      ]
    },
    // 9
    {
      cells: [
        [line('Authorization #', f.authNumber || f.authDetails?.authNumber, { field: 'authNumber', mono: true })],
        [line('Auth Coverage Dates:', f.authCoverageDates, { field: 'authCoverageDates' })]
      ]
    },
    // 10
    {
      cells: [
        [
          line('PRIMARY:', formPrimary(f), { field: 'primary', fallback: 'YES' }),
          line('SECONDARY:', f.secondary, { field: 'secondary', fallback: 'NO' })
        ],
        [
          line('Insurance Rep Name:', f.insuranceRep, { field: 'insuranceRep' }),
          line('Call Reference:', f.callReference, { field: 'callReference', mono: true })
        ]
      ]
    },
    // 11, spanning both columns in the source document
    {
      full: true,
      cells: [
        [
          line('Claim Mailing Address:', f.claimMailingAddress, { field: 'claimMailingAddress' }),
          line('Payer ID:', f.payerId, { field: 'payerId', mono: true }),
          line('TFL days for claims:', f.tflDaysClaims, { field: 'tflDaysClaims' }),
          line('TFL for corrected claims:', f.tflCorrectedClaims, { field: 'tflCorrectedClaims' })
        ]
      ]
    },
    // 12
    {
      cells: [
        [line('SECONDARY (YES/NO):', f.secondaryYesNo, { field: 'secondaryYesNo', fallback: 'NO' })],
        [line('SECONDARY INS NAME-', f.secondaryInsName, { field: 'secondaryInsName' })]
      ]
    },
    // 13
    {
      cells: [
        [line('PLAN NAME:', f.secondaryPlanName, { field: 'secondaryPlanName' })],
        [line('POLICY ID:', f.secondaryPolicyId, { field: 'secondaryPolicyId', mono: true })]
      ]
    },
    // 14
    {
      cells: [
        [line('EFFECTIVE DATE:', f.secondaryEffectiveDate, { field: 'secondaryEffectiveDate' })],
        [line('DEDUCTIBLE:', f.secondaryDeductible, { field: 'secondaryDeductible', fallback: 'NA' })]
      ]
    },
    // 15
    {
      cells: [
        [line('VISIT LIMIT:', f.secondaryVisitLimit, { field: 'secondaryVisitLimit', fallback: 'MN' })],
        [line('USED LIMIT:', f.secondaryUsedLimit, { field: 'secondaryUsedLimit' })]
      ]
    }
  ];
}
