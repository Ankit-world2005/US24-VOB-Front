/**
 * Dynamic AI Transcript Extractor for VOB Intake
 * Parses raw audio conversation notes, phone call transcripts, or payer portal text
 * and extracts canonical VOB fields dynamically without hardcoded sample data.
 */

export function extractFieldsFromTranscript(text, vob = {}) {
  if (!text || typeof text !== 'string') return {};

  const cleanText = text.trim();
  const lower = cleanText.toLowerCase();
  const extracted = {};

  // 1. Payer / Insurance Carrier
  if (lower.includes('unitedhealthcare') || lower.includes('united healthcare') || lower.includes('uhc')) {
    extracted.insurance = 'UnitedHealthcare (UHC)';
  } else if (lower.includes('cigna')) {
    extracted.insurance = 'Cigna Healthcare';
  } else if (lower.includes('aetna')) {
    extracted.insurance = 'Aetna';
  } else if (lower.includes('blue cross') || lower.includes('bcbs') || lower.includes('anthem')) {
    extracted.insurance = 'Blue Cross Blue Shield';
  } else if (lower.includes('humana')) {
    extracted.insurance = 'Humana';
  } else if (lower.includes('medicare')) {
    extracted.insurance = 'Medicare';
  } else if (lower.includes('medicaid')) {
    extracted.insurance = 'Medicaid';
  } else if (lower.includes('kaiser')) {
    extracted.insurance = 'Kaiser Permanente';
  } else if (lower.includes('oscar')) {
    extracted.insurance = 'Oscar Health';
  } else if (lower.includes('molina')) {
    extracted.insurance = 'Molina Healthcare';
  } else {
    const payerMatch = cleanText.match(/(?:Payer|Insurance|Carrier|Health Plan)\s*:\s*([^\n\r|;,]+)/i);
    if (payerMatch) extracted.insurance = payerMatch[1].trim();
  }

  // 2. Patient Name
  const patientMatch = cleanText.match(/(?:Patient Name|Member Name)\s*:\s*([A-Za-z\s.'-]+?)(?:\s*\||\s*,|\s*\n|\s*DOB)/i)
    || cleanText.match(/(?:patient(?:\s*name)?\s*[:\s]\s*|for patient\s+)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i);
  if (patientMatch) {
    const pName = patientMatch[1].trim();
    if (pName.length > 2 && !['call', 'coverage', 'active', 'eligibility'].includes(pName.toLowerCase())) {
      extracted.patientName = pName;
    }
  }

  // 3. Date of Birth (DOB)
  const dobMatch = cleanText.match(/(?:DOB|Date of Birth|Birthdate)\s*[:\s]\s*([0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{2,4}|[0-9]{4}-[0-9]{2}-[0-9]{2})/i);
  if (dobMatch) {
    extracted.dob = dobMatch[1].trim();
  }

  // 4. Member ID / Policy ID / ID Card
  const idMatch = cleanText.match(/(?:Member ID|Policy ID|Policy #|Subscriber ID|ID #)\s*[:\s]\s*([A-Za-z0-9-]+)/i)
    || cleanText.match(/\b(?:Member ID|Policy ID)\s+([A-Za-z0-9-]+)/i);
  if (idMatch) {
    extracted.idCard = idMatch[1].trim();
  }

  // 5. Group Number
  const grpMatch = cleanText.match(/(?:Group #|Group Number|Group ID|Group)\s*[:\s]\s*([A-Za-z0-9-]+)/i);
  if (grpMatch && grpMatch[1].toLowerCase() !== 'and') {
    extracted.groupNo = grpMatch[1].trim();
  }

  // 6. Plan Type & Plan Name
  if (/\b(ppo)\b/i.test(cleanText)) {
    extracted.planType = 'PPO';
  } else if (/\b(hmo)\b/i.test(cleanText)) {
    extracted.planType = 'HMO';
  } else if (/\b(epo)\b/i.test(cleanText)) {
    extracted.planType = 'EPO';
  } else if (/\b(pos)\b/i.test(cleanText)) {
    extracted.planType = 'POS';
  } else if (/\b(hdhp)\b/i.test(cleanText)) {
    extracted.planType = 'HDHP';
  }

  const planMatch = cleanText.match(/(?:Plan Name|Plan)\s*:\s*([^\n\r|;,]+)/i)
    || cleanText.match(/(?:under|plan is)\s+([A-Z][A-Za-z0-9\s]+?(?:PPO|HMO|EPO|POS|Choice Plus|Open Access|Advantage|Select|Option))/i);
  if (planMatch) {
    extracted.planName = planMatch[1].trim();
  }

  // 7. Network Status
  if (lower.includes('in-network') || lower.includes('in network')) {
    extracted.networkStatus = 'In-Network';
    extracted.inNetworkGroup = 'Yes';
  } else if (lower.includes('out-of-network') || lower.includes('out of network') || lower.includes('non-participating')) {
    extracted.networkStatus = 'Out-of-Network';
    extracted.inNetworkGroup = 'No';
  }

  // 8. Coverage Status
  if (lower.includes('coverage is active') || lower.includes('status: active') || lower.includes('status : active') || lower.includes('| active |') || /\bactive\b/i.test(cleanText)) {
    extracted.coverageStatus = 'Active';
  } else if (lower.includes('inactive') || lower.includes('terminated')) {
    extracted.coverageStatus = 'Inactive';
  }

  // 9. Effective & Termination Date
  const effMatch = cleanText.match(/(?:Effective|Policy Effective|Effective Date)\s*[:\s]\s*([0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{2,4}|[0-9]{4}-[0-9]{2}-[0-9]{2})/i);
  if (effMatch) {
    extracted.effectiveDate = effMatch[1].trim();
  }

  const termMatch = cleanText.match(/(?:Termination|Term Date|End Date)\s*[:\s]\s*([0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{2,4}|[0-9]{4}-[0-9]{2}-[0-9]{2}|None|Current|NO)/i);
  if (termMatch) {
    extracted.terminationDate = termMatch[1].trim();
  } else {
    extracted.terminationDate = 'NO';
  }

  // 10. Deductible Applicable & Amounts
  if (lower.includes('no deductible') || lower.includes('deductible: $0') || lower.includes('deductible: 0')) {
    extracted.deductibleApplicable = 'No';
    extracted.deductibleIndividual = '$0.00';
  } else if (lower.includes('deductible')) {
    extracted.deductibleApplicable = 'Yes';
    const dedAmtMatch = cleanText.match(/(?:annual individual deductible is|individual deductible is|deductible\s*:\s*|deductible\s+is\s+)\$?([0-9,]+(?:\.[0-9]{2})?)/i)
      || cleanText.match(/deductible.*?\$([0-9,]+(?:\.[0-9]{2})?)/i);
    if (dedAmtMatch) {
      const amt = dedAmtMatch[1].replace(/,/g, '');
      extracted.deductibleIndividual = `$${Number(amt).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
  }

  // 11. Copay / Coinsurance
  const copayMatch = cleanText.match(/(?:copay\s+is\s*|copay\s*:\s*|copay\s+of\s+)\$?([0-9]+(?:\.[0-9]{2})?)/i)
    || cleanText.match(/\$([0-9]+(?:\.[0-9]{2})?)\s*(?:specialist\s*)?copay/i);
  const coinsMatch = cleanText.match(/(?:coinsurance is|coinsurance\s*:\s*|followed by\s*)([0-9]+%)/i);

  if (copayMatch && coinsMatch) {
    extracted.copayCoinsurance = `$${Number(copayMatch[1]).toFixed(2)} Copay / ${coinsMatch[1]} Coinsurance`;
  } else if (copayMatch) {
    extracted.copayCoinsurance = `$${Number(copayMatch[1]).toFixed(2)} Copay`;
  } else if (coinsMatch) {
    extracted.copayCoinsurance = `${coinsMatch[1]} Coinsurance`;
  }

  // 12. Out of Pocket Maximum
  const oopMatch = cleanText.match(/(?:out of pocket|oop|max out of pocket)\s*(?:is|:)?\s*\$?([0-9,]+(?:\.[0-9]{2})?)/i);
  if (oopMatch) {
    const oopAmt = oopMatch[1].replace(/,/g, '');
    extracted.outOfPocket = `$${Number(oopAmt).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  // 13. Visits Limitation & Used
  const visitMatch = cleanText.match(/([0-9]+)\s*visits?(?:\s*per calendar year|\s*per plan year|\s*per year|\s*limitation|\s*limit)/i);
  if (visitMatch) {
    extracted.visitsLimitation = `${visitMatch[1]} visits / calendar year`;
  }

  const visitUsedMatch = cleanText.match(/(?:used visits|visits used)\s*[:\s]\s*([0-9]+|none|no)/i);
  if (visitUsedMatch) {
    extracted.visitsUsed = visitUsedMatch[1].trim();
  } else {
    extracted.visitsUsed = 'NO';
  }

  // 14. Prior Authorization & Referral Requirements
  if (
    lower.includes('no authorization required') ||
    lower.includes('no prior auth required') ||
    lower.includes('no auth required') ||
    lower.includes('auth: no') ||
    lower.includes('prior auth: not required') ||
    lower.includes('authorization: no prior auth required')
  ) {
    extracted.authInitialEval = 'NO';
    extracted.authTreatment = 'NO';
  } else if (lower.includes('authorization required') || lower.includes('prior auth required') || lower.includes('auth required: yes')) {
    extracted.authInitialEval = 'YES';
    extracted.authTreatment = 'YES';
  }

  if (lower.includes('no referral') || lower.includes('referral: no') || lower.includes('no referral required')) {
    extracted.referral = 'NO';
    extracted.pcpReferral = 'NO';
  } else if (lower.includes('referral required') || lower.includes('referral: yes')) {
    extracted.referral = 'YES';
    extracted.pcpReferral = 'YES';
  }

  // 15. Representative Name & Reference Number
  const repMatch = cleanText.match(/(?:My name is|rep(?:\s*name)?\s*:\s*|representative\s*:\s*|spoke with\s*)([A-Za-z\s]+?)(?:,|\.|ID|#|\n|\||\s+from)/i);
  if (repMatch) {
    const repName = repMatch[1].trim();
    if (repName.length > 1 && !['a', 'the', 'provider', 'uhc', 'cigna', 'aetna'].includes(repName.toLowerCase())) {
      extracted.insuranceRep = repName;
    }
  }

  const refMatch = cleanText.match(/(?:reference(?:\s*number)?\s*(?:is|:)|call reference\s*is\s*|ref(?:\s*#|\s*ref\s*:))\s*([A-Za-z0-9-]+)/i);
  if (refMatch) {
    extracted.callReference = refMatch[1].trim();
  }

  // 16. Payer ID
  const payerIdMatch = cleanText.match(/(?:Payer ID\s*[:\s(]\s*)([0-9A-Za-z]{3,7})/i);
  if (payerIdMatch) {
    extracted.payerId = payerIdMatch[1].trim();
  }

  // 17. Contact Phone Number
  const phoneMatch = cleanText.match(/(1-[0-9]{3}-[0-9]{3}-[0-9]{4}|[0-9]{3}-[0-9]{3}-[0-9]{4})/);
  if (phoneMatch) {
    extracted.insurancePhone = phoneMatch[1].trim();
  }

  // 18. Website or Contact Method
  if (lower.includes('availity') || lower.includes('portal') || lower.includes('inquiry result') || lower.includes('website')) {
    extracted.callWebsite = 'Provider Portal';
  } else {
    extracted.callWebsite = 'Phone Call';
  }

  // Set standard administrative audit metadata
  extracted.requestDate = new Date().toISOString().split('T')[0];
  if (vob.initialDos || vob.dos) {
    extracted.initialDos = vob.initialDos || vob.dos;
  }

  return extracted;
}
