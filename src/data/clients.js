// Client specifications and column mapping onto canonical fields
export const CLIENTS = [
  {
    id: "parker",
    name: "Parker Clinic",
    description: "Physical therapy & sports rehabilitation",
    color: "#0284c7",
    extendedColumns: ["Request Type", "Verification Type", "PAT", "Additional Info", "HSA/HRA AMT", "TFL Claims", "Secondary Payer"],
    notes: "Uses Pre-Authorization & Benefits Determination format"
  },
  {
    id: "arra",
    name: "Arra",
    description: "Multi-specialty clinic group",
    color: "#2563eb",
    extendedColumns: ["Call duration", "INS Payment", "Patient Payment", "QA By", "Call Recording QA", "VOB File uploaded"]
  },
  {
    id: "west_az",
    name: "West AZ",
    description: "Regional outpatient practice",
    color: "#0d9488",
    extendedColumns: ["Call duration", "INS Payment", "Patient Payment", "QA By", "Call Recording QA"]
  },
  {
    id: "namste",
    name: "Namste",
    description: "Holistic care & family medicine",
    color: "#7c3aed",
    extendedColumns: [] // Core columns only
  },
  {
    id: "harikrishna_2",
    name: "Harikrishna - 2",
    description: "Surgical & specialty care",
    color: "#d97706",
    extendedColumns: ["Project Name", "User Name", "Call duration", "INS Payment", "Patient Payment", "QA By", "Call Recording QA"],
    notes: "In-network columns labeled GRP / IND / GRP&IND"
  },
  {
    id: "icure",
    name: "Icure",
    description: "Urgent & primary care network",
    color: "#e11d48",
    extendedColumns: ["Call duration", "INS Payment", "Patient Payment", "QA By", "Call Recording QA"],
    notes: "DOS comes after Appointment Type"
  },
  {
    id: "third_eye",
    name: "Third eye",
    description: "Diagnostic imaging & specialty",
    color: "#0284c7",
    extendedColumns: ["Project Name", "Call duration", "INS Payment", "Patient Payment", "QA By", "Call Recording QA"],
    notes: "DOS after Appointment Type"
  },
  {
    id: "sugarland",
    name: "Sugarland & Harvest Green",
    description: "Family health & wellness centers",
    color: "#059669",
    extendedColumns: ["Project Name", "User Name", "Call duration", "INS Payment", "Patient Payment", "QA By", "Call Recording QA"],
    notes: "In-network columns named Group / IND / GRP&IND"
  },
  {
    id: "meyerland",
    name: "MeyerLand",
    description: "Comprehensive health pavilion",
    color: "#9333ea",
    extendedColumns: ["Project Name", "User Name", "Call duration", "INS Payment"],
    notes: "18 blank leading columns in original sheet"
  }
];

// 19 FIELDS TO ASK FROM THE REP (Matches User's Call Verification reference)
//
// Every key here must also exist in CANONICAL_FIELDS, or the progress meter
// counts a field the specialist has no box to type into. "planName" and
// "inNetworkGroup" were dropped when the form was aligned to the Parker
// document; "networkStatus" is the document's equivalent of the latter.
export const REP_VERIFICATION_FIELDS = [
  { key: "idCard", label: "Policy ID", group: "rep" },
  { key: "groupNo", label: "Group ID", group: "rep" },
  { key: "planType", label: "Plan Type", group: "rep" },
  { key: "networkStatus", label: "Network Status", group: "rep" },
  { key: "coverageStatus", label: "Coverage", group: "rep" },
  { key: "effectiveDate", label: "Effective Date", group: "rep" },
  { key: "terminationDate", label: "Termination Date", group: "rep" },
  { key: "visitsLimitation", label: "Visit Limitation", group: "rep" },
  { key: "visitsUsed", label: "Visits Used", group: "rep" },
  { key: "insuranceRep", label: "Insurance Rep", group: "rep" },
  { key: "callReference", label: "Call Reference", group: "rep" },
  { key: "deductibleApplicable", label: "Deductible Applies", group: "rep" },
  { key: "deductibleIndividual", label: "Deductible Individual", group: "rep" },
  { key: "copayCoinsurance", label: "Co-insurance", group: "rep" },
  { key: "outOfPocket", label: "Out of Pocket", group: "rep" },
  { key: "authInitialEval", label: "Auth Initial Eval", group: "rep" },
  { key: "authTreatment", label: "Auth Treatment", group: "rep" },
  { key: "referral", label: "Referral Required", group: "rep" },
  { key: "pcpReferral", label: "PCP Referral", group: "rep" }
];

// 3 FIELDS TO FILL IN - OURS (Internal / Intake Fields)
//
// project, requestDate, enteredBy and initialDos went with the same alignment:
// the Parker document has no line for any of them, so the form no longer
// collects them and counting them here would strand the meter below 100%.
export const OURS_VERIFICATION_FIELDS = [
  { key: "todayDate", label: "Today's Date", group: "ours" },
  { key: "insurance", label: "Insurance", group: "ours" },
  { key: "pat", label: "PAT", group: "ours" }
];

// 2 CORE FIELDS ALREADY VERIFIED / INITIALIZED (Makes total 24 fields)
export const CORE_VERIFICATION_FIELDS = [
  { key: "serviceType", label: "Service type", group: "core", defaultValue: "PT" },
  { key: "patientName", label: "Patient Name", group: "core" }
];

// All 24 tracked fields in Call Verification
export const ALL_VERIFIED_TRACKED_FIELDS = [
  ...CORE_VERIFICATION_FIELDS,
  ...OURS_VERIFICATION_FIELDS,
  ...REP_VERIFICATION_FIELDS
];

// Helper to determine if a field has a valid, non-empty value
export function isFieldFilled(formData, key) {
  if (!formData) return false;
  const val = formData[key];
  if (val === undefined || val === null) return false;
  if (typeof val === 'string') return val.trim().length > 0;
  return Boolean(val);
}

// Helper to get remaining missing fields to ask from Rep
export function getStillToAskFields(formData) {
  return REP_VERIFICATION_FIELDS.filter(f => !isFieldFilled(formData, f.key));
}

// Helper to get remaining missing fields of ours
export function getStillToFillFields(formData) {
  return OURS_VERIFICATION_FIELDS.filter(f => !isFieldFilled(formData, f.key));
}

// Calculate progress across the tracked call-verification fields
export function getVerificationProgress(formData) {
  const total = ALL_VERIFIED_TRACKED_FIELDS.length;
  let filledCount = 0;
  for (const field of ALL_VERIFIED_TRACKED_FIELDS) {
    if (isFieldFilled(formData, field.key)) {
      filledCount++;
    }
  }
  const stillToAsk = getStillToAskFields(formData);
  const stillToFill = getStillToFillFields(formData);

  return {
    filledCount,
    totalCount: total,
    progressPercent: Math.round((filledCount / total) * 100),
    stillToAskCount: stillToAsk.length,
    stillToFillCount: stillToFill.length,
    stillToAsk,
    stillToFill
  };
}

/**
 * The verification form's fields.
 *
 * One entry per labelled line in docs/VOB_PARKER - Copy.docx, in the order the
 * document reads, so filling the form top-to-bottom fills the document
 * top-to-bottom. `row` is the document table row an entry belongs to (0 = the
 * PAT box above the table); ParkerLivePreview renders those same rows.
 *
 * Adding a field here without adding it to the document would put a box on the
 * form that never reaches the client's deliverable.
 */
export const CANONICAL_FIELDS = [
  // PAT box, above the table
  { key: "pat", label: "PAT", group: "patient", row: 0, required: false, placeholder: "100%(RESP)" },

  // Row 1–2: patient identity
  { key: "patientName", label: "Name", group: "patient", row: 1, required: true },
  { key: "dob", label: "DOB", group: "patient", row: 1, required: true, placeholder: "00/00/0000" },
  { key: "todayDate", label: "Today's Date", group: "patient", row: 2, required: true, placeholder: "00/00/0000_xx" },
  { key: "additionalInfo", label: "Additional Info", group: "patient", row: 2, required: false },

  // Row 3: carrier and policy identifiers
  { key: "insurance", label: "Insurance Name", group: "insurance", row: 3, required: true },
  { key: "insurancePhone", label: "Insurance Contact Number", group: "insurance", row: 3, required: true, placeholder: "(000) 000-0000" },
  { key: "idCard", label: "Policy ID", group: "insurance", row: 3, required: true, placeholder: "XXX0000000" },
  { key: "groupNo", label: "GROUP ID", group: "insurance", row: 3, required: false, placeholder: "000000" },

  // Row 4: plan, network and dates
  { key: "serviceType", label: "Service Type", group: "coverage", row: 4, required: true, options: ["PT", "OT", "ST", "Chiropractic", "Acupuncture"] },
  { key: "planType", label: "Plan Type", group: "coverage", row: 4, required: true, options: ["PPO", "HMO", "EPO", "POS", "Indemnity", "Medicare", "Medicaid"] },
  { key: "networkStatus", label: "Network Status", group: "coverage", row: 4, required: true, options: ["IN-NETWORK", "OUT-OF-NETWORK"] },
  { key: "coverageStatus", label: "Coverage", group: "coverage", row: 4, required: true },
  { key: "effectiveDate", label: "Effective Date", group: "coverage", row: 4, required: true, placeholder: "00/00/0000" },
  { key: "terminationDate", label: "Termination Date", group: "coverage", row: 4, required: false, placeholder: "NA" },
  // "HCA" is the source document's spelling; the key stays hsaHraAmt.
  { key: "hsaHraAmt", label: "HCA/HRA AMT", group: "coverage", row: 4, required: false, placeholder: "NA" },

  // Row 5: co-pay and deductible
  { key: "copay", label: "Co-pay", group: "costshare", row: 5, required: false, options: ["NO", "YES"] },
  { key: "copayAmount", label: "Amount", group: "costshare", row: 5, required: false, placeholder: "$0000.00" },
  { key: "deductibleApplicable", label: "Is Deductible Applied for PT Services", group: "costshare", row: 5, required: true, options: ["YES", "NO"] },
  { key: "deductibleIndividual", label: "Deductible Individual", group: "costshare", row: 5, required: false, placeholder: "$0000.00" },
  { key: "deductibleMet", label: "Met Amount", group: "costshare", row: 5, required: false, placeholder: "$0000.00" },
  { key: "deductibleRemaining", label: "Remaining Amount", group: "costshare", row: 5, required: false, placeholder: "$0000.00" },

  // Row 6: co-insurance and out of pocket
  { key: "copayCoinsurance", label: "Co-insurance", group: "oop", row: 6, required: true, options: ["YES", "NO"] },
  { key: "coinsuranceCovered", label: "Covered", group: "oop", row: 6, required: false, placeholder: "0%" },
  { key: "outOfPocket", label: "Out of Pocket", group: "oop", row: 6, required: false, placeholder: "$0000.00" },
  { key: "oopMet", label: "Met Amount", group: "oop", row: 6, required: false, placeholder: "$0000.00" },
  { key: "oopRemaining", label: "Amount Remaining", group: "oop", row: 6, required: false, placeholder: "$0000.00" },

  // Row 7: visits
  { key: "visitsLimitation", label: "Visit Limitations", group: "visits", row: 7, required: false, placeholder: "0" },
  { key: "visitsUsed", label: "Used Visit", group: "visits", row: 7, required: false, placeholder: "NO" },

  // Rows 8–9: authorization and referral
  { key: "authInitialEval", label: "Is Authorization Required for Initial Eval", group: "auth", row: 8, required: true, options: ["NO", "YES"] },
  { key: "authTreatment", label: "Is Authorization Required for Treatment", group: "auth", row: 8, required: true, options: ["NO", "YES"] },
  { key: "referral", label: "Referral Required", group: "auth", row: 8, required: false, options: ["NO", "YES"] },
  { key: "pcpReferral", label: "Is Referral Required from PCP for Approval", group: "auth", row: 8, required: false, options: ["NO", "YES"] },
  { key: "howToObtainAuth", label: "How to obtain Authorization?", group: "auth", row: 8, required: false, placeholder: "Portal / Phone / Fax" },
  { key: "authRequestTat", label: "With In How many days we can request for Auth from DOS?", group: "auth", row: 8, required: false },
  { key: "authNumber", label: "Authorization #", group: "auth", row: 9, required: false },
  { key: "authCoverageDates", label: "Auth Coverage Dates", group: "auth", row: 9, required: false, placeholder: "MM/DD/YYYY - MM/DD/YYYY" },

  // Row 10: coordination of benefits and who we spoke to
  { key: "primary", label: "PRIMARY", group: "rep", row: 10, required: false },
  { key: "secondary", label: "SECONDARY", group: "rep", row: 10, required: false, options: ["NO", "YES"] },
  { key: "insuranceRep", label: "Insurance Rep Name", group: "rep", row: 10, required: false },
  { key: "callReference", label: "Call Reference", group: "rep", row: 10, required: false, placeholder: "00000000" },

  // Row 11: claim filing (spans both columns in the document)
  { key: "claimMailingAddress", label: "Claim Mailing Address", group: "claims", row: 11, required: false },
  { key: "payerId", label: "Payer ID", group: "claims", row: 11, required: true },
  { key: "tflDaysClaims", label: "TFL days for claims", group: "claims", row: 11, required: false },
  { key: "tflCorrectedClaims", label: "TFL for corrected claims", group: "claims", row: 11, required: false },

  // Rows 12–15: secondary insurance
  { key: "secondaryYesNo", label: "SECONDARY (YES/NO)", group: "secondary", row: 12, required: false, options: ["NO", "YES"] },
  { key: "secondaryInsName", label: "SECONDARY INS NAME", group: "secondary", row: 12, required: false },
  { key: "secondaryPlanName", label: "PLAN NAME", group: "secondary", row: 13, required: false },
  { key: "secondaryPolicyId", label: "POLICY ID", group: "secondary", row: 13, required: false },
  { key: "secondaryEffectiveDate", label: "EFFECTIVE DATE", group: "secondary", row: 14, required: false },
  { key: "secondaryDeductible", label: "DEDUCTIBLE", group: "secondary", row: 14, required: false, placeholder: "NA" },
  { key: "secondaryVisitLimit", label: "VISIT LIMIT", group: "secondary", row: 15, required: false, placeholder: "MN" },
  { key: "secondaryUsedLimit", label: "USED LIMIT", group: "secondary", row: 15, required: false }
];
