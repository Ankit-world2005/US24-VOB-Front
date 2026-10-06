import { CANONICAL_FIELDS_BY_KEY } from '../data/clients';
import { FORM_FIELDS, apiFieldFor, toYesNo, toNetwork } from './vobAdapter';
import { vobFormRows, formPrimary } from './vobFormRows';

/**
 * The Queue tab's cross-check: the VOB form, as the transcript and the
 * specialist filled it, against what an existing VOB document says.
 *
 * Each field the document prints and the form stores ends up as one of:
 *   correct   — both say the same
 *   wrong     — both filled, but they differ
 *   missing   — the form has a value, the document is blank
 *   unchecked — only the document has a value, so there is nothing to check it against
 *   empty     — neither has a value
 * Wrong and missing are errors: on submit they send the VOB to the Error Queue,
 * each with its remark.
 */

/** The document's lines the form stores, in document order. Name and DOB are the patient check instead. */
const CHECKED_LINES = vobFormRows({}).flatMap(row => row.cells.flat()).filter(l => FORM_FIELDS[l.field]);

const labelOf = (line) => CANONICAL_FIELDS_BY_KEY.get(line.field)?.label || line.label.replace(/[\s:?#-]+$/, '');

/** The template's stand-ins for "no value". */
const EMPTY = /^(?:—|–|-|n\/?a)?$/i;

/** Fields compared as codes: case, spaces and punctuation don't matter. */
const ID_FIELDS = new Set(['idCard', 'groupNo', 'payerId', 'secondaryPolicyId', 'authNumber', 'callReference']);

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

/** A value reduced to what matters for comparing it: '' when it is blank. */
export function comparable(field, value) {
  const s = String(value ?? '').trim();
  if (EMPTY.test(s)) return '';
  const spec = FORM_FIELDS[field] || {};
  if (spec.yesNo) return String(toYesNo(s)).toUpperCase();
  if (spec.network) return String(toNetwork(s));
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

/** PRIMARY prints the insurance name for a primary plan; a document may say YES instead. */
const isPrimaryPlan = (f) => !String(f.primary ?? '').trim() || /^primary$/i.test(String(f.primary).trim());

function remarkFor(status, formValue, docValue, fromTranscript) {
  const source = fromTranscript ? 'transcript gave' : 'form has';
  if (status === 'wrong') return `Document has "${docValue}"; ${source} "${formValue}"`;
  if (status === 'missing') return `Blank in the document; ${source} "${formValue}"`;
  return '';
}

/**
 * Each checked field's result, in document order, with counts. `provenance`
 * says which values the AI read from the transcript, for the remarks.
 */
export function crossCheck(formData, docFields, provenance = {}) {
  const results = CHECKED_LINES.map(line => {
    const key = line.field;
    const formValue = String((key === 'primary' ? formPrimary(formData) : formData[key]) ?? '').trim();
    const docValue = String(docFields[key] ?? '').trim();
    const a = comparable(key, formValue);
    const b = comparable(key, docValue);

    let status;
    if (key === 'primary' && !String(formData.primary ?? '').trim()) {
      // With no coverage order on the form, the PRIMARY line only repeats the
      // insurance name; it is worth a result only when the document names another plan.
      status = !b || b === 'yes' || b === comparable('insurance', formData.insurance) ? 'empty' : 'wrong';
    } else if (!a && !b) status = 'empty';
    else if (!b) status = 'missing';
    else if (!a) status = 'unchecked';
    else if (a === b || (key === 'primary' && b === 'yes' && isPrimaryPlan(formData))) status = 'correct';
    else status = 'wrong';

    return {
      key,
      label: labelOf(line),
      status,
      formValue,
      docValue,
      remark: remarkFor(status, formValue, docValue, provenance[key]?.source === 'ai')
    };
  });

  const count = (status) => results.filter(r => r.status === status).length;
  const counts = { correct: count('correct'), wrong: count('wrong'), missing: count('missing'), unchecked: count('unchecked') };
  return { results, counts, errors: counts.wrong + counts.missing };
}

/** A name's words, lowercase, in any order: "Vance, Eleanor" is "Eleanor Vance". */
const nameWords = (v) => String(v ?? '').toLowerCase().split(/[^a-z]+/).filter(Boolean);

/**
 * Whether the document is for this VOB's patient: same date of birth, and the
 * shorter name's words all in the longer one (a middle initial may be left out).
 */
export function samePatient(formData, docFields) {
  const docName = nameWords(docFields.patientName);
  const docDob = isoDate(String(docFields.dob ?? '').trim());
  if (!docName.length || !docDob) return { ok: false, found: false };

  const formName = nameWords(formData.patientName);
  const [shorter, longer] = docName.length <= formName.length ? [docName, formName] : [formName, docName];
  const ok = docDob === isoDate(String(formData.dob ?? '').trim()) && shorter.every(w => longer.includes(w));
  return { ok, found: true, name: docFields.patientName, dob: docFields.dob };
}

/** The `document_check` submit sends: the file's name and every field with a value on either side. */
export function documentCheckFor(filename, check) {
  return {
    filename,
    results: check.results
      .filter(r => r.status !== 'empty')
      .map(r => ({
        field: apiFieldFor(r.key),
        status: r.status,
        document_value: r.docValue || null,
        vob_value: r.formValue || null,
        remark: r.remark || null
      }))
  };
}
