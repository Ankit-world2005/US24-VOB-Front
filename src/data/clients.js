import {
  CLIENTS,
  CANONICAL_FIELDS,
  REP_VERIFICATION_FIELDS,
  OURS_VERIFICATION_FIELDS,
  CORE_VERIFICATION_FIELDS
} from '../DB';

// Re-export static data sourced from DB folder
export {
  CLIENTS,
  CANONICAL_FIELDS,
  REP_VERIFICATION_FIELDS,
  OURS_VERIFICATION_FIELDS,
  CORE_VERIFICATION_FIELDS
};

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
