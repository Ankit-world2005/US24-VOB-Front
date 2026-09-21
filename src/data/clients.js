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

// 20 FIELDS TO ASK FROM THE REP (Matches User's Call Verification reference)
export const REP_VERIFICATION_FIELDS = [
  { key: "idCard", label: "Policy ID", group: "rep" },
  { key: "groupNo", label: "Group ID", group: "rep" },
  { key: "planType", label: "Plan Type", group: "rep" },
  { key: "planName", label: "Plan Name", group: "rep" },
  { key: "inNetworkGroup", label: "Network Status (Group)", group: "rep" },
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

// 5 FIELDS TO FILL IN - OURS (Internal / Intake Fields)
export const OURS_VERIFICATION_FIELDS = [
  { key: "project", label: "Project", group: "ours" },
  { key: "requestDate", label: "Request Date", group: "ours" },
  { key: "enteredBy", label: "Entered By", group: "ours" },
  { key: "initialDos", label: "Initial Treatment Date", group: "ours" },
  { key: "insurance", label: "Insurance", group: "ours" }
];

// 2 CORE FIELDS ALREADY VERIFIED / INITIALIZED (Makes total 27 fields: FORM 2/27)
export const CORE_VERIFICATION_FIELDS = [
  { key: "serviceType", label: "Service type", group: "core", defaultValue: "PT" },
  { key: "patientName", label: "Patient Name", group: "core" }
];

// All 27 tracked fields in Call Verification
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

// Calculate progress: filled / 27
export function getVerificationProgress(formData) {
  const total = ALL_VERIFIED_TRACKED_FIELDS.length; // 27
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

// Comprehensive Canonical Form Fields for VOB Verification (Parker + PRD Standard)
export const CANONICAL_FIELDS = [
  // Section 1: Project & Request
  { key: "project", label: "Project", group: "request", required: true },
  { key: "category", label: "Category", group: "request", required: false, options: ["Commercial", "Medicare Advantage", "Medicaid HMO", "Workers Comp", "Auto / PIP"] },
  { key: "requestType", label: "Request Type", group: "request", required: true, options: ["CALL", "PORTAL", "FAX", "EMAIL"] },
  { key: "requestDate", label: "Request Date", group: "request", required: true },
  { key: "verificationType", label: "Verification", group: "request", required: true, options: ["INITIAL", "RE-VERIFICATION", "ADDITIONAL VISITS"] },
  { key: "enteredBy", label: "Entered By", group: "request", required: false },

  // Section 2: Patient Demographics & Responsibility
  { key: "patientName", label: "Patient Name", group: "patient", required: true },
  { key: "dob", label: "Date of Birth", group: "patient", required: true },
  { key: "todayDate", label: "Today's Date", group: "patient", required: true },
  { key: "pat", label: "PAT (Patient Responsibility)", group: "patient", required: false, placeholder: "$0.00 (100% COVERED)" },
  { key: "additionalInfo", label: "Additional Info", group: "patient", required: false },

  // Section 3: Insurance & Policy Identification
  { key: "insurance", label: "Insurance Carrier / Name", group: "insurance", required: true },
  { key: "insurancePhone", label: "Insurance Contact Number", group: "insurance", required: true },
  { key: "idCard", label: "Policy ID / Member ID", group: "insurance", required: true },
  { key: "groupNo", label: "Group ID", group: "insurance", required: false },
  { key: "primarySecondary", label: "Coordination of Benefits", group: "insurance", required: true, options: ["Primary", "Secondary", "Tertiary"] },

  // Section 4: Coverage, Plan & Network Status
  { key: "serviceType", label: "Service Type", group: "coverage", required: true, options: ["PT", "OT", "ST", "Chiropractic", "Acupuncture"] },
  { key: "planType", label: "Plan Type", group: "coverage", required: true, options: ["PPO", "HMO", "EPO", "POS", "Indemnity", "Medicare", "Medicaid"] },
  { key: "planName", label: "Plan Name", group: "coverage", required: false },
  { key: "networkStatus", label: "Network Status (Overall)", group: "coverage", required: true, options: ["In-Network", "Out-of-Network"] },
  { key: "inNetworkGroup", label: "Network Status (Group)", group: "coverage", required: false, options: ["Yes", "No", "N/A"] },
  { key: "coverageStatus", label: "Coverage Status", group: "coverage", required: true, options: ["Active", "Terminated", "Inactive", "Pending"] },
  { key: "effectiveDate", label: "Effective Date", group: "coverage", required: true },
  { key: "terminationDate", label: "Termination Date", group: "coverage", required: false, placeholder: "NO or YYYY-MM-DD" },
  { key: "hsaHraAmt", label: "HSA / HRA Amount", group: "coverage", required: false, placeholder: "NA or $0.00" },

  // Section 5: Cost Share, Deductibles & Out of Pocket
  { key: "copay", label: "Co-pay?", group: "financials", required: false, options: ["NO", "YES"] },
  { key: "copayAmount", label: "Co-pay Amount", group: "financials", required: false, placeholder: "$0.00" },
  { key: "deductibleApplicable", label: "Deductible Applied for PT Services", group: "financials", required: true, options: ["Yes", "No"] },
  { key: "deductibleIndividual", label: "Deductible Individual", group: "financials", required: false, placeholder: "$0.00" },
  { key: "deductibleMet", label: "Deductible Met Amount", group: "financials", required: false, placeholder: "$0.00" },
  { key: "deductibleRemaining", label: "Deductible Remaining Amount", group: "financials", required: false, placeholder: "$0.00" },
  { key: "copayCoinsurance", label: "Co-Insurance Rate", group: "financials", required: true, placeholder: "0% or 20%" },
  { key: "coinsuranceCovered", label: "Coinsurance Covered %", group: "financials", required: false, placeholder: "100%" },
  { key: "outOfPocket", label: "Out of Pocket Max", group: "financials", required: false, placeholder: "$0.00" },
  { key: "oopMet", label: "OOP Met Amount", group: "financials", required: false, placeholder: "$0.00" },
  { key: "oopRemaining", label: "OOP Amount Remaining", group: "financials", required: false, placeholder: "$0.00" },

  // Section 6: Visit Limits & Authorizations
  { key: "visitsLimitation", label: "Visit Limitations", group: "auth", required: false, placeholder: "e.g. 30 visits/year" },
  { key: "initialDos", label: "Initial Treatment Date / DOS", group: "auth", required: true },
  { key: "visitsUsed", label: "Used Visit / Prior Visits", group: "auth", required: false, placeholder: "NO or count" },
  { key: "authInitialEval", label: "Authorization Required for Initial Eval?", group: "auth", required: true, options: ["NO", "YES"] },
  { key: "authTreatment", label: "Authorization Required for Treatment?", group: "auth", required: true, options: ["NO", "YES"] },
  { key: "referral", label: "Referral Required?", group: "auth", required: false, options: ["NO", "YES"] },
  { key: "pcpReferral", label: "Referral Required from PCP for Approval?", group: "auth", required: false, options: ["NO", "YES"] },
  { key: "howToObtainAuth", label: "How to Obtain Authorization?", group: "auth", required: false, placeholder: "Portal / Phone / Fax" },
  { key: "authRequestTat", label: "Within How Many Days We Can Request Auth?", group: "auth", required: false, placeholder: "e.g. 3-5 days from DOS" },
  { key: "authNumber", label: "Authorization #", group: "auth", required: false },
  { key: "authCoverageDates", label: "Auth Coverage Dates", group: "auth", required: false, placeholder: "MM/DD/YYYY - MM/DD/YYYY" },

  // Section 7: Audit, Rep & Claim Details
  { key: "insuranceRep", label: "Insurance Rep Name", group: "contact", required: false },
  { key: "callReference", label: "Call Reference Number", group: "contact", required: false },
  { key: "claimMailingAddress", label: "Claim Mailing Address", group: "claims", required: false },
  { key: "payerId", label: "Payer ID for Claims", group: "claims", required: true },
  { key: "tflDaysClaims", label: "TFL Days for Claims", group: "claims", required: false, placeholder: "90 days" },
  { key: "tflCorrectedClaims", label: "TFL for Corrected Claims", group: "claims", required: false, placeholder: "180 days" },

  // Section 8: Secondary Insurance
  { key: "secondaryYesNo", label: "Secondary (Yes/No)", group: "secondary", required: false, options: ["NO", "YES"] },
  { key: "secondaryInsName", label: "Secondary Ins Name", group: "secondary", required: false },
  { key: "secondaryPlanName", label: "Secondary Plan Name", group: "secondary", required: false },
  { key: "secondaryPolicyId", label: "Secondary Policy ID", group: "secondary", required: false },
  { key: "secondaryEffectiveDate", label: "Secondary Effective Date", group: "secondary", required: false },
  { key: "secondaryDeductible", label: "Secondary Deductible", group: "secondary", required: false, placeholder: "NA or $0.00" },
  { key: "secondaryVisitLimit", label: "Secondary Visit Limit", group: "secondary", required: false, placeholder: "MN or count" },
  { key: "secondaryUsedLimit", label: "Secondary Used Limit", group: "secondary", required: false }
];
