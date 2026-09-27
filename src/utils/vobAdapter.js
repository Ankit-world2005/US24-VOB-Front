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
 * Normalizes a single full VOB from GET /api/v1/vobs/:id
 */
export function normalizeSingleVob(raw) {
  if (!raw) return raw;

  // Backend format has fields, patient, sources, and failures sub-objects
  const isBackendFormat = Boolean(raw.fields || raw.patient);
  const fields = raw.fields || {};
  const patient = raw.patient || {};
  const sources = raw.sources || {};
  const failures = raw.failures || [];

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

  // Map sources to provenance object for UI badges
  if (sources && Object.keys(sources).length > 0) {
    for (const [field, src] of Object.entries(sources)) {
      const camelKey = REVERSE_FIELD_KEY_MAP[field] || field;
      normalized.provenance[camelKey] = { source: src.source, date: src.source_date, confirmed: src.confirmed };
      normalized.provenance[field] = normalized.provenance[camelKey];
    }
  }

  return normalized;
}

/**
 * The form's view of POST /api/v1/vobs/:id/extract.
 *
 * Field keys follow the same rule as normalizeSingleVob(), so a proposed value
 * lands on the key the form already renders. Client-specific `extra.*` columns
 * are left out: the form keeps those in `extra`, not as fields.
 *
 * `fields` is what applying writes; the rest is for the specialist to read:
 * each value's evidence and confidence, values that contradict the VOB, and
 * what the call did not answer.
 */
export function normalizeExtraction(res) {
  const formKey = (field) => REVERSE_FIELD_KEY_MAP[field] || field;
  const ownFields = (items) => (items || []).filter((i) => !String(i.field).startsWith('extra.'));

  const formatSelectVal = (key, val) => {
    if (val === null || val === undefined) return val;
    // Format boolean / yes-no fields for UI dropdowns
    if (['authTreatment', 'authorizationRequired', 'authInitialEval', 'referral', 'referralRequired', 'deductibleApplicable', 'copay', 'copayCoinsurance', 'secondary', 'secondaryYesNo'].includes(key)) {
      if (val === true || String(val).toLowerCase() === 'yes' || String(val).toLowerCase() === 'true') return 'YES';
      if (val === false || String(val).toLowerCase() === 'no' || String(val).toLowerCase() === 'false') return 'NO';
    }
    // Format network status for UI dropdown
    if (key === 'networkStatus') {
      const s = String(val).toUpperCase();
      if (s.includes('IN') && !s.includes('OUT')) return 'IN-NETWORK';
      if (s.includes('OUT')) return 'OUT-OF-NETWORK';
    }
    // Format plan type for UI dropdown
    if (key === 'planType' || key === 'planTypeAndName') {
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

  return {
    provider: res?.provider || 'unknown',
    failovers: res?.failovers || [],
    quality: res?.quality || { classification: 'human', warning: null },
    proposed,
    fields: {
      ...Object.fromEntries(proposed.map((p) => [p.key, p.value])),
      // Populate canonical aliases so both the UI form and backend payload get populated
      ...(proposed.some(p => p.key === 'planType') ? { planTypeAndName: proposed.find(p => p.key === 'planType').value } : {}),
      ...(proposed.some(p => p.key === 'authTreatment') ? { authorizationRequired: proposed.find(p => p.key === 'authTreatment').value, authInitialEval: proposed.find(p => p.key === 'authTreatment').value } : {}),
      ...(proposed.some(p => p.key === 'referral') ? { referralRequired: proposed.find(p => p.key === 'referral').value } : {})
    },
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
 * Prepares payload for PATCH /api/v1/vobs/:id from form changes
 */
const CANONICAL_BACKEND_FIELDS = new Set([
  'dos',
  'appointment_type',
  'insurance',
  'plan_type_and_name',
  'group_no',
  'coverage_order',
  'coverage_status',
  'network_status',
  'in_network_group',
  'in_network_individual',
  'in_network_both',
  'authorization_required',
  'referral_required',
  'auth_request_tat',
  'deductible_applicable',
  'copay_coins',
  'visits_limitation',
  'initial_dos',
  'vob_status_text',
  'dos_over_15_days_new_pt',
  'payer_id_claims',
  'insurance_phone',
  'call_or_website',
  'id_card_ref',
  'dialed_time',
  'auth_number',
  'auth_valid_from',
  'auth_valid_to'
]);

const DATE_FIELDS = new Set(['dos', 'initial_dos', 'auth_valid_from', 'auth_valid_to']);
const BOOLEAN_FIELDS = new Set(['authorization_required', 'referral_required', 'in_network_group', 'in_network_individual', 'in_network_both', 'dos_over_15_days_new_pt']);

export function toBackendPatchPayload(formData, version, options = {}) {
  const fields = {};
  const extra = { ...(options.extra || {}) };
  const confirm = [...(options.confirm || [])];

  for (const [camelKey, val] of Object.entries(formData || {})) {
    // Check if it's an extra key from the client format
    if (String(camelKey).startsWith('extra.')) {
      extra[camelKey.replace(/^extra./, '')] = val;
      continue;
    }

    const snakeKey = FIELD_KEY_MAP[camelKey] || camelKey;

    // Strict validation: Only send valid canonical fields in the fields object
    if (!CANONICAL_BACKEND_FIELDS.has(snakeKey)) {
      continue;
    }

    // Format boolean fields (handles string 'YES'/'NO', booleans, and nulls)
    if (BOOLEAN_FIELDS.has(snakeKey)) {
      if (typeof val === 'boolean') {
        fields[snakeKey] = val;
      } else if (typeof val === 'string' && val.trim().length > 0) {
        const upper = val.trim().toUpperCase();
        fields[snakeKey] = upper === 'YES' || upper === 'TRUE';
      } else {
        fields[snakeKey] = null;
      }
      continue;
    }

    // Format date fields as YYYY-MM-DD (backend Zod rejects full ISO timestamps like 2026-10-01T00:00:00.000Z)
    if (DATE_FIELDS.has(snakeKey)) {
      if (!val || val === '') {
        fields[snakeKey] = null;
      } else if (typeof val === 'string') {
        fields[snakeKey] = val.slice(0, 10);
      } else if (val instanceof Date) {
        fields[snakeKey] = val.toISOString().slice(0, 10);
      } else {
        fields[snakeKey] = null;
      }
      continue;
    }

    // Default string / number field handling
    fields[snakeKey] = (val === '' || val === undefined) ? null : val;
  }

  // Explicitly handle authorization_required based on any authorization field
  const authCandidates = [formData.authTreatment, formData.authInitialEval, formData.authorizationRequired, formData.authorization_required];
  if (authCandidates.some(v => v === true || (typeof v === 'string' && ['YES', 'TRUE'].includes(v.trim().toUpperCase())))) {
    fields['authorization_required'] = true;
  } else if (authCandidates.some(v => v === false || (typeof v === 'string' && ['NO', 'FALSE'].includes(v.trim().toUpperCase())))) {
    fields['authorization_required'] = false;
  }

  // Explicitly handle referral_required based on referral fields
  const refCandidates = [formData.referral, formData.referralRequired, formData.referral_required];
  if (refCandidates.some(v => v === true || (typeof v === 'string' && ['YES', 'TRUE'].includes(v.trim().toUpperCase())))) {
    fields['referral_required'] = true;
  } else if (refCandidates.some(v => v === false || (typeof v === 'string' && ['NO', 'FALSE'].includes(v.trim().toUpperCase())))) {
    fields['referral_required'] = false;
  }

  return {
    version,
    fields,
    extra,
    confirm
  };
}
