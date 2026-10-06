/**
 * Reads a payer call transcript in the browser: the values a VOB records, each
 * with the words it came from. The Queue tab uses it when no VOB record is at
 * hand for the AI to read the transcript on (the API reads a transcript for a
 * record), so any VOB can be checked. Nothing leaves the browser.
 *
 * It knows how calls usually give each value — "call reference number is
 * 876 3001", "your copay is $30", "no prior authorization is required for the
 * evaluation" — and prefers what the payer's side says. Where a value isn't
 * clearly given it gives nothing rather than guess; every value carries its
 * evidence so the specialist can check it.
 *
 * Its answer has the shape normalizeExtraction() gives the Queue tab:
 * { provider, quality, callValues: { [formKey]: { value, evidence } }, callValuesComplete }.
 */

// --- Turns: who said what -----------------------------------------------------

/** "Savi Sharma | Oct 5, 2026 04:26 PM" or "(800) 440-1561 | 10/05/2026 4:26 PM". */
const HEADER_LINE = /^(.{1,60}?)\s*\|\s*(?:[A-Z][a-z]{2,8}\.?\s+\d{1,2},?\s+\d{4}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}).*$/;
/** "Rep: …", "Specialist: …", "Savi Sharma: …". */
const LABELLED_LINE = /^([A-Za-z][\w .'’-]{0,30}?):\s+(.*)$/;
const PHONE = /^\+?1?[\s.-]*\(?\d{3}\)?[\s.-]*\d{3}[\s.-]*\d{4}$/;
const PAYER_LABEL = /\b(rep|representative|agent|payer|insurance|ivr|automated|system|customer service|advocate)\b/i;
const CALLER_LABEL = /\b(specialist|caller|provider|office|me|us24)\b/i;

function turnsOf(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim());
  const headed = lines.filter(l => HEADER_LINE.test(l)).length;
  const labelled = lines.filter(l => LABELLED_LINE.test(l)).length;
  const turns = [];

  if (headed >= 2 || (headed >= 1 && labelled < 2)) {
    let current = null;
    for (const line of lines) {
      if (!line) continue;
      const header = line.match(HEADER_LINE);
      if (header) {
        current = { speaker: header[1].trim(), text: '' };
        turns.push(current);
      } else if (current) {
        current.text += (current.text ? ' ' : '') + line;
      } else {
        turns.push(current = { speaker: '', text: line });
      }
    }
  } else if (labelled >= 2) {
    let current = null;
    for (const line of lines) {
      if (!line) continue;
      const labelledLine = line.match(LABELLED_LINE);
      if (labelledLine) {
        turns.push(current = { speaker: labelledLine[1].trim(), text: labelledLine[2] });
      } else if (current) {
        current.text += ' ' + line;
      } else {
        turns.push(current = { speaker: '', text: line });
      }
    }
  } else {
    turns.push({ speaker: '', text: lines.filter(Boolean).join(' ') });
  }

  // The payer's side: a phone number or a rep's label. With two speakers and
  // one of them the payer, the other is the caller.
  const roleOf = (speaker) => (!speaker ? 'unknown' : PHONE.test(speaker) || PAYER_LABEL.test(speaker) ? 'payer' : CALLER_LABEL.test(speaker) ? 'caller' : 'unknown');
  const speakers = [...new Set(turns.map(t => t.speaker).filter(Boolean))];
  const roles = new Map(speakers.map(s => [s, roleOf(s)]));
  if (speakers.length === 2 && [...roles.values()].includes('payer')) {
    for (const s of speakers) if (roles.get(s) === 'unknown') roles.set(s, 'caller');
  }
  return turns
    .filter(t => t.text.trim())
    .map(t => ({ ...t, text: t.text.replace(/\s+/g, ' ').trim(), role: roles.get(t.speaker) || 'unknown' }));
}

// --- Values of each kind ------------------------------------------------------

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const MONTH = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?';
const DATE = new RegExp(
  `\\b(\\d{1,2})[/-](\\d{1,2})[/-](\\d{2,4})\\b|\\b${MONTH}\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b|\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH},?\\s+(\\d{4})\\b`,
  'i'
);
const pad = (n) => String(n).padStart(2, '0');

/** The first date in `s`, as MM/DD/YYYY. */
function findDate(s) {
  const m = s.match(DATE);
  if (!m) return null;
  let month; let day; let year;
  if (m[1]) [month, day, year] = [m[1], m[2], m[3]];
  else if (m[4]) [month, day, year] = [MONTHS[m[4].slice(0, 3).toLowerCase()], m[5], m[6]];
  else [day, month, year] = [m[7], MONTHS[m[8].slice(0, 3).toLowerCase()], m[9]];
  if (String(year).length === 2) year = `20${year}`;
  return { value: `${pad(month)}/${pad(day)}/${year}`, index: m.index, length: m[0].length };
}

/** The first amount in `s`: "$1,500", "30 dollars", or a bare number where an amount is expected. */
function findMoney(s) {
  const m = s.match(/\$\s?\d+(?:,\d{3})*(?:\.\d{1,2})?|\b\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?(?=\s?(?:dollars|bucks)\b)|\bzero(?=\s+dollars\b)|\b\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?\b|\b\d{1,5}(?:\.\d{2})?\b(?!\s*(?:%|percent|days?|visits?|months?|years?))/i);
  if (!m) return null;
  const digits = /zero/i.test(m[0]) ? '0' : m[0].replace(/[$\s]/g, '');
  return { value: `$${digits}`, index: m.index, length: m[0].length };
}

function findPercent(s) {
  const m = s.match(/\b(\d{1,3})\s?(?:%|percent)/i);
  return m ? { value: `${m[1]}%`, index: m.index, length: m[0].length } : null;
}

/**
 * An ID or reference: groups that each hold a digit ("876. 3001", "W123 456
 * 789"), after an optional capital-letter prefix ("AET-883921", "AET 883921").
 */
const ID_GROUP = '(?=[A-Za-z0-9-]*\\d)[A-Za-z0-9-]+';
const ID = new RegExp(`\\b(?:[A-Z]{1,4}[\\s-]?)?${ID_GROUP}(?:[\\s.]{1,3}${ID_GROUP})*`);
function findId(s) {
  const m = s.match(ID);
  return m ? { value: m[0].replace(/[\s.]+/g, ' ').trim(), index: m.index, length: m[0].length } : null;
}

function findDays(s) {
  const m = s.match(/\b(\d{1,3})\s*(days?|months?|years?)\b/i);
  return m ? { value: `${m[1]} ${m[2].toLowerCase()}`, index: m.index, length: m[0].length } : null;
}

/** YES or NO for a clause about whether something applies or is needed. */
function polarity(clause) {
  if (/\b(?:no|not|isn'?t|doesn'?t|don'?t|won'?t|aren'?t|without|never|none)\b|n['’]t\b/i.test(clause)) return 'NO';
  if (/\b(?:yes|yeah|yep|required|requires?|need(?:s|ed)?|necessary|must|appl(?:y|ies))\b/i.test(clause)) return 'YES';
  return null;
}

const PAYER_NAMES = /\b(aetna|cigna|humana|united\s?health\s?care|uhc|blue\s+cross(?:\s+(?:and\s+)?blue\s+shield)?|bcbs|anthem|kaiser(?:\s+permanente)?|medicare|medicaid|tricare|ambetter|oscar|molina|wellcare|highmark|optum|umr|meritain|magellan|geha|carefirst|premera|regence|wellmark|harvard\s+pilgrim|tufts|emblem\s?health|oxford|horizon)\b/i;
const NOT_NAMES = new Set(['sure', 'yes', 'yeah', 'yep', 'no', 'okay', 'ok', 'it', "it's", 'my', 'i', "i'm", 'this', 'thank', 'thanks', 'hi', 'hello', 'the', 'a', 'an', 'so', 'well', 'absolutely', 'of', 'name', 'and', 'perfect', 'great', 'alright', 'one', 'just']);
const titleCase = (s) => s.replace(/\S+/g, w => (w.length > 3 && w === w.toUpperCase() ? w : w[0].toUpperCase() + w.slice(1).toLowerCase()));

/** The sentence around `index` in `text`, shortened to what fits beside a value. */
function evidenceAt(text, index, end = index) {
  let start = Math.max(0, text.lastIndexOf('. ', index) + 1, text.lastIndexOf('? ', index) + 1, text.lastIndexOf('! ', index) + 1);
  const stops = ['. ', '? ', '! '].map(p => text.indexOf(p, end)).filter(i => i !== -1);
  let stop = stops.length ? Math.min(...stops) + 1 : text.length;
  if (stop - start > 180) {
    start = Math.max(start, index - 70);
    stop = Math.min(stop, end + 90);
  }
  return text.slice(start, stop).trim();
}

/** The first value `finder` finds within `window` characters after a `topic` match in `text`. */
function valueAfter(text, topic, finder, window = 60) {
  for (const m of text.matchAll(new RegExp(topic.source, 'gi'))) {
    const from = m.index + m[0].length;
    const found = finder(text.slice(from, from + window));
    if (found) return { value: found.value, at: m.index, end: from + found.index + found.length };
  }
  return null;
}

/** A turn split into clauses, so "no auth for the eval, but treatment needs one" reads as two. */
const clausesOf = (text) => text.split(/(?<=[.?!])\s+|;\s*|,\s*(?=(?:but|however|and)\b)|\s+but\s+/i).filter(Boolean);

// --- What each field sounds like ------------------------------------------------

const TOPICS = {
  callReference: /\b(?:call\s+)?ref(?:erence)?\s*(?:number|no\.?|#)|\bcall\s+reference\b/i,
  idCard: /\b(?:member|subscriber|policy|insurance)\s*(?:id|i\.?\s?d\.?|identification)(?:\s+number)?\b|\bmember\s+number\b/i,
  groupNo: /\bgroup\s*(?:number|no\.?|#|id|i\.d\.?)\b/i,
  effectiveDate: /\beffective\b(?:\s+date)?/i,
  terminationDate: /\bterminat(?:ion|es|ed)\b(?:\s+date)?|\bterm\s+date\b/i,
  copay: /\bco-?pay(?:ment)?s?\b/i,
  deductible: /\bdeductible\b/i,
  outOfPocket: /\bout[- ]of[- ]pocket\b|\bo\.?o\.?p\.?\b/i,
  coinsurance: /\bco-?insurance\b/i,
  auth: /\b(?:prior\s+)?auth(?:orization)?s?\b|\bpre-?cert(?:ification)?\b/i,
  referral: /\breferrals?\b/i,
  authNumber: /\bauth(?:orization)?\s*(?:number|#|no\.?)\b/i,
  payerId: /\bpayer\s*(?:id|i\.?\s?d\.?)\b/i,
  timelyFiling: /\btimely\s+filing\b|\bfiling\s+limit\b|\btfl\b/i,
  claimAddress: /\bclaims?\s+(?:mailing\s+)?address\b|\bmail(?:ing)?\s+address\b|\b(?:send|mail)\s+(?:the\s+|your\s+|all\s+)?claims?\s+to\b/i,
  dob: /\bdate\s+of\s+birth\b|\bd\.?\s?o\.?\s?b\.?\b|\bbirth\s?date\b|\bborn\s+on\b/i,
  repName: /\b(?:your|the\s+rep(?:resentative)?['’]?s?)\s+name\b|\bwho\s+am\s+i\s+speaking\b|\bmay\s+i\s+have\s+your\s+name\b/i,
  secondary: /\b(?:secondary|other|additional|another)\s+(?:insurance|coverage|policy|plan)\b|\bcoordination\s+of\s+benefits\b|\bcob\b/i
};

/** Words that label an amount as met or remaining: right after it ("$500 met", "$250 has been met")… */
const AFTER_MET = /^[\s,]*(?:dollars\s+)?(?:(?:has|have|had|is|are|was|were|been|already)\s+){0,3}(?:met|satisfied|used|spent|accumulated)\b/i;
const AFTER_REMAINING = /^[\s,]*(?:dollars\s+)?(?:(?:is|are|was|still)\s+){0,2}(?:remaining|left|outstanding|to\s+go)\b/i;
/** …or just before it ("has met $500", "remaining balance is $750"). */
const BEFORE_MET = /\b(?:met|satisfied|accumulated|spent)\b[^$\d]{0,25}$/i;
const BEFORE_REMAINING = /\b(?:remaining|left|balance|outstanding)\b[^$\d]{0,25}$/i;

/** The cost-share topics a sentence can name; an amount belongs to the nearest one before it. */
const COST_TOPICS = /\bdeductible\b|\bout[- ]of[- ]pocket\b|\bo\.?o\.?p\.?\b|\bco-?pay(?:ment)?s?\b|\bco-?insurance\b/gi;

/** Whether the amount at `index` in `sentence` is about `topic`: the nearest topic before it, or else the first after it. */
function aboutTopic(sentence, index, topic) {
  const named = [...sentence.matchAll(COST_TOPICS)];
  const before = named.filter(n => n.index < index).pop();
  const nearest = before || named.find(n => n.index > index);
  return Boolean(nearest) && new RegExp(topic.source, 'i').test(nearest[0]);
}

/**
 * Splits the amounts in a deductible or out-of-pocket sentence into total, met
 * and remaining, each labelled by the words right beside it, so
 * "$4,000, $500 met, $3,500 remaining" and "$1,500 and she has met $500 of it"
 * both read right. An amount for another topic in the same sentence ("the copay
 * is $40 and the deductible does not apply") is left alone.
 */
function amountsIn(text, topic, keys) {
  const found = {};
  for (const sentence of text.split(/(?<=[.?!])\s+(?=[A-Z])/)) {
    if (!topic.test(sentence)) continue;
    const amounts = [...sentence.matchAll(/\$\s?\d+(?:,\d{3})*(?:\.\d{1,2})?|\b\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?\b|\b\d+(?:\.\d{1,2})?(?=\s?dollars\b)/gi)];
    amounts.forEach((m, i) => {
      if (!aboutTopic(sentence, m.index, topic)) return;
      const end = m.index + m[0].length;
      const before = sentence.slice(i ? amounts[i - 1].index + amounts[i - 1][0].length : 0, m.index);
      const after = sentence.slice(end, i + 1 < amounts.length ? amounts[i + 1].index : sentence.length);
      if (/family/i.test(before.slice(-25) + after.slice(0, 20))) return;
      // The words right after an amount label it before those ahead of it,
      // which may belong to the amount before ("$350 has been met, so $1,150 is remaining").
      const key = AFTER_MET.test(after) ? keys.met
        : AFTER_REMAINING.test(after) ? keys.remaining
          : BEFORE_MET.test(before) ? keys.met
            : BEFORE_REMAINING.test(before) ? keys.remaining
              : keys.total;
      if (!found[key]) found[key] = { value: `$${m[0].replace(/[$\s]/g, '')}`, evidence: evidenceAt(sentence, m.index, end) };
    });
  }
  return found;
}

/**
 * Every value the transcript gives that a VOB records, by form field. Values
 * the payer's side states win over the caller's; the first clear statement of
 * each is kept.
 */
export function readTranscriptLocally(text) {
  const turns = turnsOf(String(text || ''));
  const payerFirst = [...turns.filter(t => t.role === 'payer'), ...turns.filter(t => t.role === 'unknown'), ...turns.filter(t => t.role === 'caller')];
  const notCaller = payerFirst.filter(t => t.role !== 'caller');
  const callValues = {};
  const set = (key, value, evidence) => {
    if (!callValues[key] && value !== undefined && value !== null && String(value).trim()) {
      callValues[key] = { value: String(value).trim(), evidence: evidence.trim() };
    }
  };
  const fromTopic = (key, topic, finder, sourceTurns = payerFirst, window = 60) => {
    for (const t of sourceTurns) {
      const hit = valueAfter(t.text, topic, finder, window);
      if (hit) return set(key, hit.value, evidenceAt(t.text, hit.at, hit.end));
    }
    return undefined;
  };

  // A question from the caller, answered in the payer's next turn.
  const answers = [];
  turns.forEach((t, i) => {
    if (t.role === 'payer' || !t.text.includes('?')) return;
    const reply = turns.slice(i + 1).find(n => n.role !== t.role);
    if (reply) answers.push({ question: t.text, answer: reply.text });
  });
  const fromAnswer = (key, topic, finder) => {
    for (const { question, answer } of answers) {
      if (!topic.test(question)) continue;
      const head = answer.slice(0, 160);
      const found = finder(head);
      if (found) return set(key, found.value, evidenceAt(answer, found.index ?? 0, (found.index ?? 0) + (found.length ?? 0)));
    }
    return undefined;
  };
  const yesNoAnswer = (s) => {
    const m = s.match(/^\W*(yes|yeah|yep|correct|no|nope|not)\b/i);
    return m ? { value: /^(no|nope|not)$/i.test(m[1]) ? 'NO' : 'YES', index: m.index, length: m[0].length } : null;
  };

  // Codes and references, then dates.
  fromTopic('callReference', TOPICS.callReference, findId, payerFirst, 40);
  fromTopic('idCard', TOPICS.idCard, findId, payerFirst, 40);
  fromTopic('groupNo', TOPICS.groupNo, findId, payerFirst, 40);
  fromTopic('authNumber', TOPICS.authNumber, findId, payerFirst, 40);
  fromTopic('payerId', TOPICS.payerId, findId, payerFirst, 40);
  fromTopic('effectiveDate', TOPICS.effectiveDate, findDate, notCaller);
  fromTopic('terminationDate', TOPICS.terminationDate, findDate, notCaller);
  fromTopic('dob', TOPICS.dob, findDate, payerFirst, 40);

  // The payer and the rep.
  for (const t of notCaller) {
    const calling = t.text.match(/\bthank\s+you\s+for\s+calling\s+(.{2,40}?)(?=[.,!?]|\s+(?:my|this|how|you|where|what|for)\b|$)/i);
    if (calling) set('insurance', calling[1], evidenceAt(t.text, calling.index, calling.index + calling[0].length));
    const named = t.text.match(PAYER_NAMES);
    if (named) set('insurance', named[1], evidenceAt(t.text, named.index, named.index + named[0].length));
  }
  const payerPhone = turns.find(t => t.role === 'payer' && PHONE.test(t.speaker));
  if (payerPhone) set('insurancePhone', payerPhone.speaker, `${payerPhone.speaker} (the payer’s line)`);

  for (const t of notCaller) {
    // The lead-in in any case ("My name is"), the name itself capitalised ("Anthony", "Maria T.").
    const m = t.text.match(/\b(?:[Mm]y\s+name\s+is|[Mm]y\s+name['’]s|[Yy]ou(?:['’]re|\s+are)\s+speaking\s+(?:with|to)|[Ss]peaking\s+with|[Tt]his\s+is)\s+([A-Z][a-z'’-]+)(?:\s+([A-Z][a-z'’-]+|[A-Z])\.?)?/);
    if (m && !NOT_NAMES.has(m[1].toLowerCase()) && !PAYER_NAMES.test(m[0].slice(m[0].indexOf(m[1])))) {
      const second = m[2] && !NOT_NAMES.has(m[2].toLowerCase()) && !PAYER_NAMES.test(m[2]) ? ` ${m[2]}` : '';
      set('insuranceRep', `${m[1]}${second}`, evidenceAt(t.text, m.index, m.index + m[0].length));
    }
  }
  fromAnswer('insuranceRep', TOPICS.repName, (s) => {
    for (const m of s.matchAll(/\b([A-Z][a-z'’-]{1,20})\b/g)) {
      if (!NOT_NAMES.has(m[1].toLowerCase()) && !PAYER_NAMES.test(m[1])) return { value: m[1], index: m.index, length: m[0].length };
    }
    return null;
  });

  // The patient, as the caller gives them.
  for (const t of payerFirst) {
    const m = t.text.match(/\b(?:patient|member)(?:['’]s)?\s+(?:name\s+)?(?:is|named|called)\s+([A-Z][a-z'’-]+(?:,?\s+[A-Z][a-z'’-]+){1,2})|\bcalling\s+(?:about|for|on\s+behalf\s+of|regarding)\s+(?:the\s+)?(?:patient|member)\s*,?\s*(?:named\s+)?([A-Z][a-z'’-]+(?:\s+[A-Z][a-z'’-]+){1,2})/);
    if (m) set('patientName', m[1] || m[2], evidenceAt(t.text, m.index, m.index + m[0].length));
  }

  // Plan, network and coverage, from the payer's side.
  for (const t of notCaller) {
    const plan = t.text.match(/\b(PPO|HMO|EPO|POS|HDHP)\b/);
    if (plan) set('planType', plan[1], evidenceAt(t.text, plan.index, plan.index + plan[0].length));
    const outNet = t.text.match(/\b(?:not|isn['’]t|aren['’]t)\s+(?:in[- ]network|participating)\b|\bout[- ]of[- ]network\b|\bout\s+of\s+network\b|\bnon[- ]?participating\b/i);
    const inNet = t.text.match(/\bin[- ]network\b|\bparticipating\b/i);
    if (outNet) set('networkStatus', 'OUT-OF-NETWORK', evidenceAt(t.text, outNet.index, outNet.index + outNet[0].length));
    else if (inNet) set('networkStatus', 'IN-NETWORK', evidenceAt(t.text, inNet.index, inNet.index + inNet[0].length));
    const coverage = t.text.match(/\b(?:policy|plan|coverage|insurance|member(?:ship)?|patient)\s+is\s+(?:currently\s+|still\s+)?(active|inactive|terminated|termed)\b/i);
    if (coverage) set('coverageStatus', titleCase(coverage[1]), evidenceAt(t.text, coverage.index, coverage.index + coverage[0].length));
    const order = t.text.match(/\b(?:this|it|the\s+(?:plan|policy|coverage|insurance))\s+is\s+(?:the\s+)?(primary|secondary)\b/i);
    if (order) set('primary', titleCase(order[1]), evidenceAt(t.text, order.index, order.index + order[0].length));
  }

  // Cost share.
  for (const t of notCaller) {
    const noCopay = t.text.match(/\bno\s+co-?pay\b|\bco-?pay\s+(?:does\s+not|doesn['’]t)\s+apply\b/i);
    if (noCopay) set('copay', 'NO', evidenceAt(t.text, noCopay.index, noCopay.index + noCopay[0].length));
  }
  fromTopic('copayAmount', TOPICS.copay, findMoney, notCaller, 40);
  fromAnswer('copayAmount', TOPICS.copay, findMoney);
  if (callValues.copayAmount && !callValues.copay) set('copay', callValues.copayAmount.value === '$0' ? 'NO' : 'YES', callValues.copayAmount.evidence);
  fromTopic('copayCoinsurance', TOPICS.coinsurance, findPercent, notCaller, 40);
  fromAnswer('copayCoinsurance', TOPICS.coinsurance, findPercent);
  for (const t of notCaller) {
    const covered = t.text.match(/\b(?:covered|pays?|paid)\s+(?:at\s+)?(\d{1,3})\s?(?:%|percent)/i);
    if (covered) set('coinsuranceCovered', `${covered[1]}%`, evidenceAt(t.text, covered.index, covered.index + covered[0].length));
    const doesNotApply = t.text.match(/\bdeductible\s+(?:does\s+not|doesn['’]t|will\s+not|won['’]t)\s+apply\b|\bnot\s+subject\s+to\s+(?:the\s+)?deductible\b/i);
    const doesApply = t.text.match(/\bdeductible\s+(?:does\s+)?appl(?:y|ies)\b|\bsubject\s+to\s+(?:the\s+)?deductible\b/i);
    if (doesNotApply) set('deductibleApplicable', 'NO', evidenceAt(t.text, doesNotApply.index, doesNotApply.index + doesNotApply[0].length));
    else if (doesApply) set('deductibleApplicable', 'YES', evidenceAt(t.text, doesApply.index, doesApply.index + doesApply[0].length));
  }
  for (const t of notCaller) {
    const ded = amountsIn(t.text, TOPICS.deductible, { total: 'deductibleIndividual', met: 'deductibleMet', remaining: 'deductibleRemaining' });
    const oop = amountsIn(t.text, TOPICS.outOfPocket, { total: 'outOfPocket', met: 'oopMet', remaining: 'oopRemaining' });
    for (const [key, v] of Object.entries({ ...ded, ...oop })) set(key, v.value, v.evidence);
  }

  // Visits.
  for (const t of notCaller) {
    const limit = t.text.match(/\b(\d{1,3}|unlimited)\s+visits?\s+(?:per|a|each|every|in\s+a|for\s+the)\s+(?:calendar\s+|plan\s+|benefit\s+)?(?:year|period)\b/i)
      || t.text.match(/\bvisit\s+limit(?:ation)?s?\s+(?:is|of|are)\s+(\d{1,3})\b/i);
    if (limit) set('visitsLimitation', limit[0].replace(/^visit\s+limit(?:ation)?s?\s+(?:is|of|are)\s+/i, ''), evidenceAt(t.text, limit.index, limit.index + limit[0].length));
    const used = t.text.match(/\b(\d{1,3}|no|zero|none)\s+visits?\s+(?:have\s+been\s+|has\s+been\s+|were\s+|are\s+)?used\b/i) || t.text.match(/\bused\s+(\d{1,3})\s+visits?\b/i);
    if (used) set('visitsUsed', /^\d+$/.test(used[1]) ? used[1] : '0', evidenceAt(t.text, used.index, used.index + used[0].length));
  }

  // Authorization and referral: per clause, so the evaluation and the treatment can differ.
  const authClause = (clause, evidence, scope = clause) => {
    const answer = polarity(clause);
    if (!answer) return;
    const evalHit = /\b(?:eval(?:uation)?s?|initial)\b/i.test(scope);
    const treatHit = /\b(?:treatments?|therapy|visits?|follow[- ]?ups?|after)\b/i.test(scope);
    if (evalHit) set('authInitialEval', answer, evidence);
    if (treatHit) set('authTreatment', answer, evidence);
    if (!evalHit && !treatHit) {
      set('authInitialEval', answer, evidence);
      set('authTreatment', answer, evidence);
    }
  };
  for (const t of notCaller) {
    for (const clause of clausesOf(t.text)) {
      if (TOPICS.auth.test(clause) && !TOPICS.authNumber.test(clause)) authClause(clause, clause);
      if (TOPICS.referral.test(clause)) {
        const answer = polarity(clause);
        if (answer) set(/\bpcp\b|primary\s+care/i.test(clause) ? 'pcpReferral' : 'referral', answer, clause);
      }
    }
    const how = t.text.match(/\b(?:obtain|get|request|submit|initiate|start)\s+(?:the\s+|an\s+|a\s+)?(?:prior\s+)?auth(?:orization)?\s+(?:is\s+)?(?:by|through|via|on|online\s+(?:at|through)|at|using|with)\s+([^.?!]{3,60}?)(?=\s+and\s+|[.?!,]|$)/i);
    if (how) set('howToObtainAuth', how[1].trim(), evidenceAt(t.text, how.index, how.index + how[0].length));
    for (const sentence of t.text.split(/(?<=[.?!])\s+/)) {
      if (!TOPICS.auth.test(sentence)) continue;
      const tat = sentence.match(/\b(\d{1,2}\s*(?:-|to)\s*\d{1,2}|\d{1,2})\s+(business|working|calendar)?\s*days?\b/i);
      if (tat) set('authRequestTat', `${tat[1].replace(/\s*(?:-|to)\s*/, '-')} ${tat[2] ? `${tat[2].toLowerCase()} ` : ''}days`, sentence);
    }
  }
  for (const { question, answer } of answers) {
    const yn = yesNoAnswer(answer);
    if (!yn) continue;
    if (TOPICS.auth.test(question)) authClause(yn.value === 'NO' ? 'no' : 'yes', evidenceAt(answer, 0, yn.length), question);
    else if (TOPICS.referral.test(question)) set(/\bpcp\b|primary\s+care/i.test(question) ? 'pcpReferral' : 'referral', yn.value, evidenceAt(answer, 0, yn.length));
    else if (TOPICS.secondary.test(question)) set('secondaryYesNo', yn.value, evidenceAt(answer, 0, yn.length));
  }
  for (const t of notCaller) {
    const none = t.text.match(/\bno\s+(?:other|secondary|additional)\s+(?:insurance|coverage)\b/i);
    if (none) set('secondaryYesNo', 'NO', evidenceAt(t.text, none.index, none.index + none[0].length));
  }

  // Claims.
  for (const t of notCaller) {
    const at = t.text.search(TOPICS.claimAddress);
    if (at !== -1) {
      const rest = t.text.slice(at).replace(TOPICS.claimAddress, '').replace(/^\s*(?:is|are|:|to)?\s*/i, '');
      // The ZIP follows a state ("UT 84130"), so a box number ("P.O. Box 30555") isn't taken for one.
      const zip = rest.match(/\b[A-Z]{2},?\s+\d{5}(?:-\d{4})?\b/);
      if (zip && zip.index < 160) set('claimMailingAddress', rest.slice(0, zip.index + zip[0].length).replace(/[,\s]+$/, ''), evidenceAt(t.text, at, at + 40));
    }
    for (const sentence of t.text.split(/(?<=[.?!])\s+/)) {
      if (!TOPICS.timelyFiling.test(sentence) && !/\bcorrected\s+claims?\b/i.test(sentence)) continue;
      const days = findDays(sentence);
      if (days) set(/\bcorrected\b/i.test(sentence) ? 'tflCorrectedClaims' : 'tflDaysClaims', days.value, sentence);
    }
  }
  fromAnswer('tflDaysClaims', TOPICS.timelyFiling, findDays);

  return {
    provider: 'the browser’s transcript reader',
    failovers: [],
    quality: { classification: 'human', warning: null },
    callValues,
    callValuesComplete: true,
    readLocally: true
  };
}
