import { CANONICAL_FIELDS_BY_KEY, fieldLabel } from '../data/clients';
import { FORM_FIELDS, apiFieldFor, toYesNo, toNetwork } from './vobAdapter';
import { vobFormRows } from './vobFormRows';

/**
 * The Queue tab's validation: a pasted or uploaded VOB checked against a call
 * transcript. The VOB's answers are what is checked; the values the AI read
 * from the transcript are what they are checked against. The VOB record's
 * saved values play no part.
 *
 * Each field the VOB prints ends up as one of:
 *   match         — the call gives the same value as the VOB
 *   wrong         — the call gives a different value
 *   missing       — the call gives a value; the VOB has none
 *   not_mentioned — the call gives none: neutral, whatever the VOB says
 * Wrong and missing are errors: on submit they send the VOB to the Error Queue,
 * each with its remark.
 */

/** The VOB's lines checked against the call, in document order. Today's Date is when the VOB was made. */
const CHECKED_LINES = vobFormRows({}).flatMap(row => row.cells.flat()).filter(l => l.field !== 'todayDate');

const labelOf = (line) => (CANONICAL_FIELDS_BY_KEY.has(line.field) ? fieldLabel(line.field) : line.label.replace(/[\s:?#-]+$/, ''));

/** The template's stand-ins for "no value". */
const EMPTY = /^(?:—|–|-|n\/?a)?$/i;

/** Fields compared as codes: case, spaces and punctuation don't matter. */
const ID_FIELDS = new Set(['idCard', 'groupNo', 'payerId', 'secondaryPolicyId', 'authNumber', 'callReference']);

/** Fields compared by their number: "30 per year" is "30 visits per year". */
const COUNT_FIELDS = new Set(['visitsLimitation', 'visitsUsed', 'secondaryVisitLimit', 'secondaryUsedLimit']);

/** Fields compared as a length of time: "5 to 7 business days" is "5-7 days". */
const DURATION_FIELDS = new Set(['authRequestTat', 'tflDaysClaims', 'tflCorrectedClaims']);

/**
 * Free text compared loosely: one naming the other is a match, since a call
 * and a VOB word the same thing more or less fully ("Aetna" and "Aetna
 * Commercial PPO", "Anthony" and "Anthony S").
 */
const LOOSE_TEXT_FIELDS = new Set([
  'insurance', 'insuranceRep', 'planType', 'coverageStatus', 'claimMailingAddress',
  'howToObtainAuth', 'secondaryInsName', 'secondaryPlanName', 'additionalInfo'
]);

/** The API's names for the intake fields the form does not save. */
const INTAKE_API_FIELDS = { patientName: 'patient_name', dob: 'dob' };

/** A date as YYYY-MM-DD when it is written as one (2026-09-28, 09/28/2026, 9-28-26); otherwise null. */
function isoDate(s) {
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:T.*)?$/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
  if (m) return `${m[3].length === 2 ? `20${m[3]}` : m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  return null;
}

/** An amount to two decimals when the value is only an amount ($30, 30, 30.00, 1,250); otherwise null. */
function amount(s) {
  const m = s.replace(/[\s,]/g, '').match(/^\$?(-?\d+(?:\.\d+)?)$/);
  return m ? Number(m[1]).toFixed(2) : null;
}

/** A name's words, lowercase, in any order: "Vance, Eleanor" is "Eleanor Vance". */
const nameWords = (v) => String(v ?? '').toLowerCase().split(/[^a-z]+/).filter(Boolean);

/** A value reduced to what matters for comparing it: '' when it is blank. */
export function comparable(field, value) {
  const s = String(value ?? '').trim();
  if (EMPTY.test(s)) return '';
  const spec = FORM_FIELDS[field] || {};
  if (spec.yesNo) return String(toYesNo(s)).toUpperCase();
  if (spec.network) return String(toNetwork(s));
  if (field === 'patientName') return nameWords(s).sort().join(' ');
  if (COUNT_FIELDS.has(field)) {
    if (/unlimited|no\s+limit/i.test(s)) return 'unlimited';
    const n = s.match(/\d+/);
    if (n) return String(Number(n[0]));
  }
  if (DURATION_FIELDS.has(field)) {
    const m = s.match(/(\d+)(?:\s*(?:-|–|to)\s*(\d+))?\s*(?:business\s+|working\s+|calendar\s+)?(day|month|year)s?/i);
    if (m) return `${m[1]}${m[2] ? `-${m[2]}` : ''} ${m[3].toLowerCase()}`;
  }
  if (field === 'insurancePhone') {
    const digits = s.replace(/\D/g, '');
    return digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  }
  if (ID_FIELDS.has(field)) return s.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return isoDate(s) ?? amount(s) ?? s
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .replace(/\s*%/g, '%')
    .replace(/[.;,]$/, '');
}

/**
 * The VOB's PRIMARY line names the plan's insurance (or says YES) when the plan
 * is primary, so a call saying the plan is primary agrees with either.
 */
const callSaysPrimary = (callValue) => /^(primary|yes)$/i.test(callValue);

function remarkFor(status, vobValue, callValue) {
  if (status === 'wrong') return `VOB has "${vobValue}"; transcript says "${callValue}"`;
  if (status === 'missing') return `VOB is blank; transcript says "${callValue}"`;
  return '';
}

/**
 * Each field of the VOB (`docFields`, from vobDocumentParser) against the
 * values the call gave (`callValues`, from normalizeExtraction), in document
 * order, with counts.
 */
export function compareVobWithCall(docFields, callValues) {
  const results = CHECKED_LINES.map(line => {
    const key = line.field;
    const vobValue = String(docFields[key] ?? '').trim();
    const call = callValues[key];
    const callValue = String(call?.value ?? '').trim();
    const v = comparable(key, vobValue);
    const c = comparable(key, callValue);

    const [vTight, cTight] = [v.replace(/\s+/g, ''), c.replace(/\s+/g, '')];
    const loose = LOOSE_TEXT_FIELDS.has(key) && Math.min(vTight.length, cTight.length) >= 3 && (vTight.includes(cTight) || cTight.includes(vTight));
    let status;
    if (!c) status = 'not_mentioned';
    else if (!v) status = 'missing';
    else if (v === c || loose || (key === 'primary' && callSaysPrimary(callValue) && !/^(no|secondary)$/.test(v))) status = 'match';
    else status = 'wrong';

    return {
      key,
      label: labelOf(line),
      status,
      vobValue: v ? vobValue : '',
      callValue: c ? callValue : '',
      evidence: call?.evidence || '',
      remark: remarkFor(status, vobValue, callValue)
    };
  });

  const count = (status) => results.filter(r => r.status === status).length;
  const counts = { match: count('match'), wrong: count('wrong'), missing: count('missing'), notMentioned: count('not_mentioned') };
  return { results, counts, errors: counts.wrong + counts.missing };
}

/** Whether two names are one person's: the shorter name's words all in the longer one (a middle initial may be left out). */
export function namesMatch(a, b) {
  const [x, y] = [nameWords(a), nameWords(b)];
  if (!x.length || !y.length) return false;
  const [shorter, longer] = x.length <= y.length ? [x, y] : [y, x];
  return shorter.every(w => longer.includes(w));
}

/**
 * Whether a VOB record (`{ patientName, dob }`) is the pasted VOB's patient:
 * the same name, and the same date of birth when both have one (records
 * uploaded without a DOB still match by name).
 */
export function samePatient(record, docFields) {
  const docDob = isoDate(String(docFields.dob ?? '').trim());
  const recordDob = isoDate(String(record.dob ?? '').trim());
  return namesMatch(record.patientName, docFields.patientName) && (!docDob || !recordDob || docDob === recordDob);
}

/**
 * The `document_check` submit sends: which VOB was checked, the specialist's
 * remark, and every field with a value on either side.
 */
export function documentCheckFor({ name, kind }, check, remark) {
  return {
    filename: name,
    source: kind,
    remark: remark.trim() || null,
    results: check.results
      .filter(r => r.vobValue || r.callValue)
      .map(r => ({
        field: apiFieldFor(r.key) || INTAKE_API_FIELDS[r.key] || r.key,
        status: r.status,
        vob_value: r.vobValue || null,
        transcript_value: r.callValue || null,
        remark: r.remark || null
      }))
  };
}
