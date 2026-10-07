import {
  CLIENTS,
  CANONICAL_FIELDS,
  REP_VERIFICATION_FIELDS,
  OURS_VERIFICATION_FIELDS,
  CORE_VERIFICATION_FIELDS
} from '../DB';
import { formKeyFor } from '../utils/vobAdapter';

// Re-export static data sourced from DB folder
export {
  CLIENTS,
  CANONICAL_FIELDS,
  REP_VERIFICATION_FIELDS,
  OURS_VERIFICATION_FIELDS,
  CORE_VERIFICATION_FIELDS
};

// Fast O(1) client lookup map
export const CLIENTS_BY_ID = new Map((CLIENTS || []).map(c => [c.id, c]));

// Fast O(1) form field lookup map
export const CANONICAL_FIELDS_BY_KEY = new Map((CANONICAL_FIELDS || []).map(f => [f.key, f]));

// Labels that only make sense beside their form section ("Met Amount" twice,
// "Amount", the secondary plan's "POLICY ID"), spelled out for lists that show
// fields out of it: the Queue tab's results and failure remarks.
const STANDALONE_LABELS = {
  copayAmount: 'Co-pay Amount',
  deductibleMet: 'Deductible Met',
  deductibleRemaining: 'Deductible Remaining',
  coinsuranceCovered: 'Co-insurance Covered',
  oopMet: 'Out of Pocket Met',
  oopRemaining: 'Out of Pocket Remaining',
  secondaryPlanName: 'Secondary Plan Name',
  secondaryPolicyId: 'Secondary Policy ID',
  secondaryEffectiveDate: 'Secondary Effective Date',
  secondaryDeductible: 'Secondary Deductible',
  secondaryVisitLimit: 'Secondary Visit Limit',
  secondaryUsedLimit: 'Secondary Used Limit'
};

// A form field's label for a list that shows it out of its section
export const fieldLabel = (key) => STANDALONE_LABELS[key] || CANONICAL_FIELDS_BY_KEY.get(key)?.label || key;

// A failure's label: its field's, or "Remark" for the note a specialist adds in the Queue tab
export function failureLabel(failure) {
  if (failure.code === 'reviewer_remark') return 'Remark';
  if (failure.field === 'audit_remark' || failure.rule === 'audit_rejection') return 'Audit Remark';
  const key = formKeyFor(failure.field) || failure.field;
  return STANDALONE_LABELS[key] || CANONICAL_FIELDS_BY_KEY.get(key)?.label || CANONICAL_FIELDS_BY_KEY.get(failure.field)?.label || failure.field;
}

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
