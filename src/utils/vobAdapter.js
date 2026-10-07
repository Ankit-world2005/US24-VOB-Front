/**
 * VOB Data Adapter
 * Bridges backend schema (api-endpoints.md) and frontend components bidirectionally.
 */

// Field name mapping between Frontend (camelCase) and Backend (snake_case)
export const FIELD_KEY_MAP = {
  // Patient & General
  patientName: 'patient_name',
  dob: 'dob',
  dos: 'dos',
  initialDos: 'initial_dos',
  todayDate: 'today_date',
  additionalInfo: 'additional_info',
  
  // Insurance & Policy
  insurance: 'insurance',
  insurancePhone: 'insurance_phone',
  idCard: 'id_card',
  policyId: 'policy_id',
  groupNo: 'group_no',
  
  // Coverage & Network
  serviceType: 'appointment_type',
  appointmentType: 'appointment_type',
  planType: 'plan_type_and_name',
  planName: 'plan_type_and_name',
  planTypeAndName: 'plan_type_and_name',
  networkStatus: 'network_status',
  inNetworkGroup: 'in_network_group',
  coverageStatus: 'coverage_status',
  effectiveDate: 'effective_date',
  terminationDate: 'termination_date',
  hsaHraAmt: 'hsa_hra_amt',
  
  // Cost Sharing
  copay: 'copay_coins',
  copayAmount: 'copay_coins',
  copayCoinsurance: 'copay_coins',
  copayCoins: 'copay_coins',
  deductibleApplicable: 'deductible_applicable',
  deductibleIndividual: 'deductible_individual',
  deductibleMet: 'deductible_met',
  deductibleRemaining: 'deductible_remaining',
  outOfPocket: 'out_of_pocket',
  oopMet: 'oop_met',
  oopRemaining: 'oop_remaining',
  
  // Visits & Limitations
  visitsLimitation: 'visits_limitation',
  visitsUsed: 'visits_used',
  
  // Authorization & Referral
  authorizationRequired: 'authorization_required',
  authInitialEval: 'authorization_required',
  authTreatment: 'authorization_required',
  referral: 'referral_required',
  referralRequired: 'referral_required',
  pcpReferral: 'pcp_referral',
  howToObtainAuth: 'how_to_obtain_auth',
  authRequestTat: 'auth_request_tat',
  authNumber: 'auth_number',
  authStartDate: 'auth_valid_from',
  authEndDate: 'auth_valid_to',
  authCoverageDates: 'auth_coverage_dates',
  
  // Representative & Contact
  insuranceRep: 'insurance_rep',
  callReference: 'call_reference',
  dialedTime: 'dialed_time',
  callWebsite: 'call_website',
  
  // Claims
  claimMailingAddress: 'claim_mailing_address',
  payerId: 'payer_id_claims',
  payerIdClaims: 'payer_id_claims',
  idCard: 'id_card_ref',
  policyId: 'id_card_ref',
  tflDaysClaims: 'tfl_days_claims',
  tflCorrectedClaims: 'tfl_corrected_claims',
  
  // Secondary Insurance
  secondaryYesNo: 'secondary_yes_no',
  secondaryInsName: 'secondary_ins_name',
  secondaryPlanName: 'secondary_plan_name',
  secondaryPolicyId: 'secondary_policy_id',
  secondaryEffectiveDate: 'secondary_effective_date',
  secondaryDeductible: 'secondary_deductible',
  secondaryVisitLimit: 'secondary_visit_limit',
  secondaryUsedLimit: 'secondary_used_limit',
  
  // Metadata
  vobCompletionDate: 'vob_completion_date'
};

// Reverse map: snake_case -> camelCase
export const REVERSE_FIELD_KEY_MAP = {
  ...Object.entries(FIELD_KEY_MAP).reduce((acc, [camel, snake]) => {
    acc[snake] = camel;
    return acc;
  }, {}),
  plan_type_and_name: 'planType',
  authorization_required: 'authTreatment',
  referral_required: 'referral',
  appointment_type: 'serviceType',
  payer_id_claims: 'payerId',
  id_card_ref: 'idCard',
  copay_coins: 'copayCoinsurance',
  call_or_website: 'callWebsite'
};

// Status mapping between backend snake_case and UI display
export const STATUS_MAP_TO_UI = {
  assigned: 'Assigned',
  in_progress: 'In Progress',
  error: 'Error',
  auth_queue: 'Auth Queue',
  approved: 'Approved'
};

export const STATUS_MAP_TO_BACKEND = {
  'Assigned': 'assigned',
  'In Progress': 'in_progress',
  'Error': 'error',
  'Auth Queue': 'auth_queue',
  'Approved': 'approved'
};

/**
 * A VOB's failures as the screens read them: `{ field, message, code? }` each.
 * A bare field name (as the mock API answers) means the field was required and empty.
 */
function toFailures(list) {
  if (!Array.isArray(list)) return [];
  return list.map(f => (typeof f === 'string' ? { field: f, message: 'Required' } : f));
}

/**
 * Normalizes a VOB row from GET /api/v1/vobs list response
 */
export function normalizeVobListItem(item) {
  if (!item) return item;

  const backendStatus = (item.status || 'assigned').toLowerCase();
  const uiStatus = STATUS_MAP_TO_UI[backendStatus] || item.status || 'Assigned';
  const clientName = typeof item.client === 'object' ? item.client?.name : item.client;
  const clientId = typeof item.client === 'object' ? item.client?.id : item.client;
  const assigneeName = typeof item.assignee === 'object' ? item.assignee?.name : item.assignedTo;

  const authNumber = item.auth_number || item.fields?.auth_number || item.authDetails?.authNumber || '';
  const authStartDate = item.auth_valid_from || item.fields?.auth_valid_from || item.authDetails?.authStartDate || '';
  const authEndDate = item.auth_valid_to || item.fields?.auth_valid_to || item.authDetails?.authEndDate || '';

  return {
    ...item,
    id: item.id,
    patientName: item.patient_name || item.patientName || item.patient?.name || 'Unknown Patient',
    dos: item.dos || item.fields?.dos || '',
    status: backendStatus,
    vobStatus: uiStatus,
    client: clientId || clientName || 'sugarland',
    clientName: clientName || clientId,
    clientObj: item.client,
    assignee: item.assignee,
    assignedTo: assigneeName || item.assignee_id || '',
    failureCount: item.failure_count || (item.failures?.length || 0),
    // The Error Queue lists these as each row's failing rules and remarks.
    failingRules: toFailures(item.failures ?? item.failingRules),
    updatedAt: item.updated_at || item.updatedAt,
    insurance: item.insurance || item.fields?.insurance || 'General Healthcare',
    appointmentType: item.appointment_type || item.appointmentType || item.fields?.service_type || item.serviceType || 'Physical Therapy',
    authRequestTat: item.auth_request_tat || item.fields?.auth_request_tat || item.authRequestTat || '3-5 business days',
    authDetails: {
      authNumber,
      authStartDate,
      authEndDate,
      notes: item.authDetails?.notes || ''
    }
  };
}

/**
 * Where each field of the VOB form (src/DB/form_fields.json) lives in the API:
 * a canonical `fields` key, or an `extra` key — the backend's PT template
 * (src/features/vobs/template.ts in the API repo), which every VOB accepts.
 *
 * One table for loading, saving and applying AI proposals, so a field saves to
 * the same place it loads from. `yesNo` fields show as "YES"/"NO": canonical
 * ones are booleans in the API ('bool'), the rest are kept as text ('text').
 * `date` fields are sent as YYYY-MM-DD. Patient name and DOB come from intake
 * and are read-only here; DOS comes from intake too, but is entered here when
 * the upload had none. "PAT" and "Today's Date" are not stored.
 */
export const FORM_FIELDS = {
  dos: { field: 'dos', date: true },
  additionalInfo: { extra: 'additional_info' },
  insurance: { field: 'insurance' },
  insurancePhone: { field: 'insurance_phone' },
  idCard: { field: 'id_card_ref' },
  groupNo: { field: 'group_no' },
  serviceType: { field: 'appointment_type' },
  planType: { field: 'plan_type_and_name' },
  networkStatus: { field: 'network_status', network: true },
  coverageStatus: { field: 'coverage_status' },
  effectiveDate: { extra: 'effective_date' },
  terminationDate: { extra: 'termination_date' },
  hsaHraAmt: { extra: 'hsa_hra_amt' },
  copay: { extra: 'copay', yesNo: 'text' },
  copayAmount: { field: 'copay_coins' },
  deductibleApplicable: { field: 'deductible_applicable', yesNo: 'text' },
  deductibleIndividual: { extra: 'deductible_individual' },
  deductibleMet: { extra: 'deductible_met' },
  deductibleRemaining: { extra: 'deductible_remaining' },
  copayCoinsurance: { extra: 'coinsurance', yesNo: 'text' },
  coinsuranceCovered: { extra: 'coinsurance_covered' },
  outOfPocket: { extra: 'out_of_pocket' },
  oopMet: { extra: 'oop_met' },
  oopRemaining: { extra: 'oop_remaining' },
  visitsLimitation: { field: 'visits_limitation' },
  visitsUsed: { extra: 'visits_used' },
  authInitialEval: { extra: 'auth_initial_eval', yesNo: 'text' },
  authTreatment: { field: 'authorization_required', yesNo: 'bool' },
  referral: { field: 'referral_required', yesNo: 'bool' },
  pcpReferral: { extra: 'pcp_referral', yesNo: 'text' },
  howToObtainAuth: { extra: 'how_to_obtain_auth' },
  authRequestTat: { field: 'auth_request_tat' },
  authNumber: { field: 'auth_number' },
  authCoverageDates: { extra: 'auth_coverage_dates' },
  primary: { field: 'coverage_order' },
  secondary: { extra: 'secondary' },
  insuranceRep: { extra: 'insurance_rep' },
  callReference: { extra: 'call_reference' },
  claimMailingAddress: { extra: 'claim_mailing_address' },
  payerId: { field: 'payer_id_claims' },
  tflDaysClaims: { extra: 'tfl_days_claims' },
  tflCorrectedClaims: { extra: 'tfl_corrected_claims' },
  secondaryYesNo: { extra: 'secondary_yes_no', yesNo: 'text' },
  secondaryInsName: { extra: 'secondary_ins_name' },
  secondaryPlanName: { extra: 'secondary_plan_name' },
  secondaryPolicyId: { extra: 'secondary_policy_id' },
  secondaryEffectiveDate: { extra: 'secondary_effective_date' },
  secondaryDeductible: { extra: 'secondary_deductible' },
  secondaryVisitLimit: { extra: 'secondary_visit_limit' },
  secondaryUsedLimit: { extra: 'secondary_used_limit' }
};

/**
 * Canonical fields the form does not show. An AI proposal for one is kept under
 * its own key and saved once filled; the form never clears one.
 */
const HIDDEN_FIELDS = {
  initial_dos: 'date',
  auth_valid_from: 'date',
  auth_valid_to: 'date',
  dialed_time: 'timestamp',
  in_network_group: 'bool',
  in_network_individual: 'bool',
  in_network_both: 'bool',
  dos_over_15_days_new_pt: 'bool',
  vob_status_text: 'text',
  call_or_website: 'text'
};

const FIELD_TO_FORM = Object.fromEntries(
  Object.entries(FORM_FIELDS).filter(([, s]) => s.field).map(([k, s]) => [s.field, k])
);
const EXTRA_TO_FORM = Object.fromEntries(
  Object.entries(FORM_FIELDS).filter(([, s]) => s.extra).map(([k, s]) => [s.extra, k])
);

/** The form key an API field (`group_no`, `extra.oop_met`) shows under, or null when the form has none. */
export function formKeyFor(apiField) {
  const key = String(apiField);
  if (key.startsWith('extra.')) return EXTRA_TO_FORM[key.slice('extra.'.length)] || null;
  if (FIELD_TO_FORM[key]) return FIELD_TO_FORM[key];
  return HIDDEN_FIELDS[key] ? key : null;
}

/** The API field a form field saves to (`group_no`, `extra.oop_met`), or null when it is not stored. */
export function apiFieldFor(formKey) {
  const spec = FORM_FIELDS[formKey];
  if (!spec) return HIDDEN_FIELDS[formKey] ? formKey : null;
  return spec.field || `extra.${spec.extra}`;
}

/** A value as a YES/NO select shows it; anything else is kept as it is. */
export function toYesNo(value) {
  if (value === true) return 'YES';
  if (value === false) return 'NO';
  if (value === null || value === undefined) return '';
  const s = String(value).trim();
  if (/^(y|yes|true)\b/i.test(s)) return 'YES';
  if (/^(n|no|false|none|n\/?a)\b|not\s+appl|does\s+not/i.test(s)) return 'NO';
  return value;
}

export function toNetwork(value) {
  const s = String(value ?? '').toUpperCase();
  if (s.includes('OUT')) return 'OUT-OF-NETWORK';
  if (s.includes('IN')) return 'IN-NETWORK';
  return value ?? '';
}

/** A form field's value as the form shows it. */
function toFormValue(spec, value) {
  if (spec.yesNo) return toYesNo(value);
  if (spec.network && value) return toNetwork(value);
  return value === null || value === undefined ? '' : value;
}

const sameFormValue = (a, b) => String(a ?? '') === String(b ?? '');

/** The longest text the API takes in one field, `fields` or `extra`. */
const MAX_TEXT = 2000;

/** `YYYY-MM-DD` for a day that exists, or undefined (2026-02-30, month 15). */
function calendarDate(y, m, d) {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
    ? dt.toISOString().slice(0, 10)
    : undefined;
}

/**
 * A typed date as `YYYY-MM-DD`: ISO, MM/DD/YYYY (the form's format; `-` and `.`
 * also separate, a two-digit year is 20xx below 50), or a month written out
 * ("Oct 7, 2026"). A date that does not exist — DD/MM typed as MM/DD gives
 * month 15 — is undefined, never a wrong day.
 */
function toApiDate(value) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return undefined;
    return calendarDate(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }
  const s = String(value).trim();
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:$|[T\s])/);
  if (iso) return calendarDate(+iso[1], +iso[2], +iso[3]);
  const us = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4}|\d{2})$/);
  if (us) {
    const y = us[3].length === 2 ? (+us[3] < 50 ? 2000 : 1900) + +us[3] : +us[3];
    return calendarDate(y, +us[1], +us[2]);
  }
  // Only with a month name: Date.parse reads a bare "7" as July 2001.
  if (!/[a-z]{3}/i.test(s)) return undefined;
  const parsed = new Date(s);
  return toApiDate(parsed);
}

/**
 * A form value as the API takes it, or undefined when it cannot be sent as
 * that field's type — the whole save would be refused for one bad value.
 */
function toApiValue(type, value) {
  if (value === '' || value === null || value === undefined) return null;
  switch (type) {
    case 'bool': {
      const yn = toYesNo(value);
      return yn === 'YES' ? true : yn === 'NO' ? false : undefined;
    }
    case 'yesNoText': {
      const yn = toYesNo(value);
      const text = yn === 'YES' || yn === 'NO' ? yn : String(value);
      return text.length <= MAX_TEXT ? text : undefined;
    }
    case 'date':
      return toApiDate(value);
    case 'timestamp': {
      // RFC 3339 UTC, as the API takes it; a time typed without a zone is local.
      const s = String(value).trim();
      const t = Date.parse(s);
      return /^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}/.test(s) && !Number.isNaN(t)
        ? new Date(t).toISOString()
        : undefined;
    }
    default: {
      const text = typeof value === 'string' ? value : String(value);
      return text.length <= MAX_TEXT ? text : undefined;
    }
  }
}

/** What the specialist is told when a form value cannot be sent as its type. */
const INVALID_MESSAGE = {
  date: 'Enter a real date as MM/DD/YYYY.',
  bool: 'Choose YES or NO.',
  timestamp: 'Enter a date and time.',
  yesNoText: `Keep this under ${MAX_TEXT.toLocaleString('en-US')} characters.`,
  text: `Keep this under ${MAX_TEXT.toLocaleString('en-US')} characters.`
};

const specType = (spec) =>
  spec.date ? 'date' : spec.yesNo === 'bool' ? 'bool' : spec.yesNo === 'text' ? 'yesNoText' : 'text';

/**
 * Normalizes a single full VOB from GET /api/v1/vobs/:id
 */
export function normalizeSingleVob(raw) {
  if (!raw) return raw;

  // Backend format has fields, patient, sources, and failures sub-objects
  const isBackendFormat = Boolean(raw.fields || raw.patient);
  const fields = raw.fields || {};
  const patient = raw.patient || {};
  const sources = raw.sources || {};
  const failures = toFailures(raw.failures);

  const backendStatus = (raw.status || 'in_progress').toLowerCase();
  const uiStatus = STATUS_MAP_TO_UI[backendStatus] || raw.vobStatus || 'In Progress';

  const authNumber = fields.auth_number || raw.auth_number || raw.authDetails?.authNumber || '';
  const authStartDate = fields.auth_valid_from || raw.auth_valid_from || raw.authDetails?.authStartDate || '';
  const authEndDate = fields.auth_valid_to || raw.auth_valid_to || raw.authDetails?.authEndDate || '';

  const normalized = {
    ...raw,
    id: raw.id,
    version: raw.version || 1,
    status: backendStatus,
    vobStatus: uiStatus,
    client: raw.client_id || raw.client || 'sugarland',
    clientId: raw.client_id || raw.client,
    patientName: patient.name || raw.patientName || fields.patient_name || '',
    dob: patient.dob || raw.dob || fields.dob || '',
    dos: fields.dos || raw.dos || '',
    failures: failures,
    failingRules: failures,
    sources: sources,
    format: raw.format,
    extra: raw.extra || {},
    provenance: raw.provenance || {},
    authDetails: {
      authNumber,
      authStartDate,
      authEndDate,
      notes: raw.authDetails?.notes || ''
    }
  };

  // Populate camelCase fields from fields object
  for (const [snakeKey, val] of Object.entries(fields)) {
    const camelKey = REVERSE_FIELD_KEY_MAP[snakeKey] || snakeKey;
    normalized[camelKey] = val !== null && val !== undefined ? val : '';
    normalized[snakeKey] = val !== null && val !== undefined ? val : '';
  }

  // Normalize boolean / option fields for UI dropdowns
  const isAuth = fields.authorization_required ?? raw.authorization_required ?? raw.authTreatment;
  if (isAuth === true || isAuth === 'YES' || isAuth === 'yes') {
    normalized.authTreatment = 'YES';
    normalized.authInitialEval = 'YES';
    normalized.authorizationRequired = 'YES';
    normalized.authorization_required = true;
  } else if (isAuth === false || isAuth === 'NO' || isAuth === 'no') {
    normalized.authTreatment = 'NO';
    normalized.authInitialEval = 'NO';
    normalized.authorizationRequired = 'NO';
    normalized.authorization_required = false;
  }

  const isRef = fields.referral_required ?? raw.referral_required ?? raw.referral;
  if (isRef === true || isRef === 'YES' || isRef === 'yes') {
    normalized.referral = 'YES';
    normalized.referralRequired = 'YES';
    normalized.referral_required = true;
  } else if (isRef === false || isRef === 'NO' || isRef === 'no') {
    normalized.referral = 'NO';
    normalized.referralRequired = 'NO';
    normalized.referral_required = false;
  }

  const netStatus = fields.network_status || raw.network_status || raw.networkStatus;
  if (netStatus) {
    const s = String(netStatus).toUpperCase();
    if (s.includes('IN') && !s.includes('OUT')) normalized.networkStatus = 'IN-NETWORK';
    else if (s.includes('OUT')) normalized.networkStatus = 'OUT-OF-NETWORK';
  }

  // Also map existing top-level properties if present
  for (const [camelKey, snakeKey] of Object.entries(FIELD_KEY_MAP)) {
    if (normalized[camelKey] === undefined && raw[camelKey] !== undefined) {
      normalized[camelKey] = raw[camelKey];
    }
  }

  // Every form field from the one table, last, so it wins over the loose
  // copies above. `__loaded` is what the form showed on load: saving sends
  // only what differs from it.
  const extra = raw.extra || {};
  const loaded = {};
  for (const [formKey, spec] of Object.entries(FORM_FIELDS)) {
    const value = toFormValue(spec, spec.field ? fields[spec.field] : extra[spec.extra]);
    normalized[formKey] = value;
    loaded[formKey] = value;
  }
  for (const key of Object.keys(HIDDEN_FIELDS)) {
    const value = fields[key] ?? '';
    normalized[key] = value;
    loaded[key] = value;
  }
  normalized.__loaded = loaded;

  // Map sources to provenance object for UI badges
  if (sources && Object.keys(sources).length > 0) {
    for (const [field, src] of Object.entries(sources)) {
      const camelKey = formKeyFor(field) || REVERSE_FIELD_KEY_MAP[field] || field;
      normalized.provenance[camelKey] = { source: src.source, date: src.source_date, confirmed: src.confirmed };
      normalized.provenance[field] = normalized.provenance[camelKey];
    }
  }

  return normalized;
}

/** Intake fields the form does not save, which a call can still confirm. */
const CALL_ONLY_KEYS = { patient_name: 'patientName', dob: 'dob' };

/**
 * The form's view of POST /api/v1/vobs/:id/extract.
 *
 * Field keys come from FORM_FIELDS, as in normalizeSingleVob(), so a proposed
 * value lands on the key the form renders — `extra.oop_met` on "Met Amount",
 * `authorization_required` on "Is Authorization Required for Treatment". A
 * client's own `extra.*` column with no field on this form is left out.
 *
 * `fields` is what applying writes; the rest is for the specialist to read:
 * each value's evidence and confidence, values that contradict the VOB, and
 * what the call did not answer.
 *
 * `callValues` is every value the call gave, by form field, whatever the VOB
 * holds: what the Queue tab checks a pasted VOB against. An answer with
 * `extracted` lists every field the call answered. Without it the values come
 * from `proposed` (fields the VOB has empty), `conflicts` (fields where the
 * call says something else) and any skipped field that carries the call's
 * value, so a field where the call agrees with the VOB's saved value is left
 * out; `callValuesComplete` says which it is.
 */
export function normalizeExtraction(res) {
  const formKey = formKeyFor;
  const ownFields = (items) => (items || []).filter((i) => formKeyFor(i.field) !== null);

  const formatSelectVal = (key, val) => {
    if (val === null || val === undefined) return val;
    const spec = FORM_FIELDS[key];
    // Yes/no and network fields show as their dropdowns do
    if (spec && (spec.yesNo || spec.network)) return toFormValue(spec, val);
    // Format plan type for UI dropdown
    if (key === 'planType') {
      const known = ['PPO', 'HMO', 'EPO', 'POS', 'Indemnity', 'Medicare', 'Medicaid'];
      const match = known.find(k => k.toLowerCase() === String(val).toLowerCase());
      if (match) return match;
    }
    return val;
  };

  const proposed = ownFields(res?.proposed).map((p) => {
    const k = formKey(p.field);
    const formattedVal = formatSelectVal(k, p.value);
    return {
      key: k,
      label: p.label,
      value: formattedVal,
      confidence: p.confidence,
      evidence: p.evidence,
      status: p.status || 'FOUND',
      source: p.source || 'payer_rep',
      isSafe: p.isSafe !== undefined ? p.isSafe : p.confidence === 'high',
      validationError: p.validationError || null
    };
  });

  const callValues = {};
  const addCallValue = (item) => {
    const key = CALL_ONLY_KEYS[item.field] || formKey(item.field);
    if (!key || callValues[key] || item.value === null || item.value === undefined || item.value === '') return;
    callValues[key] = { value: formatSelectVal(key, item.value), evidence: item.evidence || '', confidence: item.confidence };
  };
  const callValuesComplete = Array.isArray(res?.extracted);
  if (callValuesComplete) {
    res.extracted.forEach(addCallValue);
  } else {
    (res?.proposed || []).forEach(addCallValue);
    (res?.conflicts || []).forEach(addCallValue);
    (res?.skipped || []).filter((s) => s.reason !== 'not_found').forEach(addCallValue);
  }

  return {
    provider: res?.provider || 'unknown',
    failovers: res?.failovers || [],
    quality: res?.quality || { classification: 'human', warning: null },
    proposed,
    fields: Object.fromEntries(proposed.map((p) => [p.key, p.value])),
    callValues,
    callValuesComplete,
    conflicts: ownFields(res?.conflicts).map((c) => ({
      key: formKey(c.field),
      label: c.label,
      current: c.current,
      value: c.value,
      confidence: c.confidence,
      evidence: c.evidence,
      status: c.status || 'CONFLICTING',
      source: c.source || 'payer_rep',
      conflictType: c.conflictType || 'existing_value'
    })),
    stillToAsk: res?.stillToAsk && Array.isArray(res.stillToAsk) && res.stillToAsk.length > 0
      ? res.stillToAsk
      : ownFields(res?.skipped)
          .filter((s) => s.reason === 'not_found')
          .map((s) => s.label)
  };
}

/**
 * The PATCH /api/v1/vobs/:id body for what the specialist changed on the form.
 *
 * Only fields that differ from what loaded (`__loaded`, set by
 * normalizeSingleVob) are sent, each to where FORM_FIELDS says it lives, so a
 * save never clears or re-stamps a field nobody touched. Hidden canonical
 * fields (an applied AI proposal the form does not show) are sent once filled.
 *
 * The authorization answers are saved as given, a blank one staying blank:
 * submit sends a VOB with any empty authorization field to the Auth Queue.
 *
 * `only` limits the save to those form keys, for a VOB whose other fields the
 * API will not take (an Auth Queue VOB takes its authorization section alone).
 */
export function toBackendPatchPayload(formData, version, { only } = {}) {
  const data = formData || {};
  const { fields, extra } = collectPatch(data, only);
  const loaded = data.__loaded || {};

  // Copay coinsurance safety: if copay is NO and no copay amount provided, ensure copay_coins is not empty
  if (!only && (data.copay === 'NO' || data.copay === 'no') && !fields.copay_coins && !loaded.copay_coins && !data.copayAmount) {
    fields.copay_coins = '$0.00';
  }

  const payload = { version, fields, extra, confirm: [] };
  if (data.transcript !== undefined) {
    payload.transcript = data.transcript;
  }
  return payload;
}

/**
 * The edited form fields toBackendPatchPayload() would leave out because their
 * value cannot be sent as the field's type, as `{ field, message, code }`
 * failures keyed like the API's (`dos`, `extra.oop_met`). Saving with any of
 * these would quietly drop the specialist's value, so the save stops instead.
 * Hidden fields are not listed: the form gives no way to fix one.
 */
export function invalidPatchFields(formData, { only } = {}) {
  return collectPatch(formData || {}, only).invalid;
}

/** The changed fields as the API takes them, and the changed ones it would not take. */
function collectPatch(data, only) {
  const loaded = data.__loaded || {};
  const changed = (key) =>
    (!only || only.includes(key)) && data[key] !== undefined && !sameFormValue(data[key], loaded[key]);
  const fields = {};
  const extra = {};
  const invalid = [];

  for (const [formKey, spec] of Object.entries(FORM_FIELDS)) {
    if (!changed(formKey)) continue;
    const type = specType(spec);
    const value = toApiValue(type, data[formKey]);
    if (value === undefined) {
      invalid.push({ field: apiFieldFor(formKey), message: INVALID_MESSAGE[type], code: 'invalid_value' });
      continue;
    }
    if (spec.field) fields[spec.field] = value;
    else extra[spec.extra] = value;
  }

  for (const [key, type] of Object.entries(HIDDEN_FIELDS)) {
    if (!changed(key)) continue;
    const value = toApiValue(type, data[key]);
    if (value !== undefined && value !== null) fields[key] = value;
  }

  return { fields, extra, invalid };
}
