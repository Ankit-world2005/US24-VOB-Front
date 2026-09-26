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
  serviceType: 'service_type',
  planType: 'plan_type',
  planName: 'plan_name',
  planTypeAndName: 'plan_type_and_name',
  networkStatus: 'network_status',
  inNetworkGroup: 'in_network_group',
  coverageStatus: 'coverage_status',
  effectiveDate: 'effective_date',
  terminationDate: 'termination_date',
  hsaHraAmt: 'hsa_hra_amt',
  
  // Cost Sharing
  copay: 'copay',
  copayAmount: 'copay_amount',
  copayCoinsurance: 'copay_coins',
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
  authInitialEval: 'auth_initial_eval',
  authTreatment: 'auth_treatment',
  referral: 'referral',
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
  payerId: 'payer_id',
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
export const REVERSE_FIELD_KEY_MAP = Object.entries(FIELD_KEY_MAP).reduce((acc, [camel, snake]) => {
  acc[snake] = camel;
  return acc;
}, {});

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

  const proposed = ownFields(res?.proposed).map((p) => ({
    key: formKey(p.field),
    label: p.label,
    value: p.value,
    confidence: p.confidence,
    evidence: p.evidence
  }));

  return {
    provider: res?.provider || 'unknown',
    failovers: res?.failovers || [],
    proposed,
    fields: Object.fromEntries(proposed.map((p) => [p.key, p.value])),
    conflicts: ownFields(res?.conflicts).map((c) => ({
      key: formKey(c.field),
      label: c.label,
      current: c.current,
      value: c.value,
      evidence: c.evidence
    })),
    stillToAsk: ownFields(res?.skipped)
      .filter((s) => s.reason === 'not_found')
      .map((s) => s.label)
  };
}

/**
 * Prepares payload for PATCH /api/v1/vobs/:id from form changes
 */
export function toBackendPatchPayload(formData, version, options = {}) {
  const fields = {};
  const extra = { ...(options.extra || {}) };
  const confirm = [...(options.confirm || [])];

  for (const [camelKey, val] of Object.entries(formData)) {
    // Skip internal UI metadata
    if (['id', 'version', 'status', 'vobStatus', 'client', 'client_id', 'provenance', 'sources', 'failures', 'failingRules', 'format', 'extra'].includes(camelKey)) {
      continue;
    }

    const snakeKey = FIELD_KEY_MAP[camelKey] || camelKey;
    
    // Server does not accept vob_completion_date in PATCH
    if (snakeKey === 'vob_completion_date') continue;

    // Convert booleans for authorization_required
    if (snakeKey === 'authorization_required' && typeof val === 'string') {
      fields[snakeKey] = val.toUpperCase() === 'YES' || val.toUpperCase() === 'TRUE';
    } else {
      fields[snakeKey] = val === '' ? null : val;
    }
  }

  return {
    version,
    fields,
    extra,
    confirm
  };
}
