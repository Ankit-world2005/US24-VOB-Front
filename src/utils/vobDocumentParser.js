import * as XLSX from 'xlsx';
import { vobFormRows } from './vobFormRows';
import { DOCX_TYPE } from './vobDocx';

/**
 * Reads a VOB document someone already made (.docx or .pdf) back into form
 * fields, for the Queue tab's cross-check.
 *
 * The document is one made from docs/VOB_PARKER - Copy.docx, so the reader
 * looks for that template's labels, which vobFormRows() lists with the form
 * field each one shows. Everything happens in the browser: the file is never
 * uploaded.
 */

/** The file input's `accept`. */
export const ACCEPTED_DOCUMENT_TYPES = '.docx,.pdf';

/** A VOB is a page or two; anything far bigger is not one. */
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

/** Fewer of the template's labels than this, and the document is not a VOB made from it. */
const MIN_LABELS_FOUND = 10;

/** Every line of the template's table, in reading order, with the row and cell it sits in. */
const LAYOUT = vobFormRows({}).flatMap((row, r) =>
  row.cells.flatMap((lines, c) => lines.map(l => ({ label: l.label, field: l.field, row: r, cell: c })))
);

/**
 * Straight quotes for curly ones as Word types them, so "Today’s Date:" matches
 * however it was written. One character for one, so positions in the result are
 * positions in the original.
 */
const plain = (text) => text.replace(/[‘’`´]/g, "'").replace(/[“”]/g, '"');

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A label as a pattern that allows any spacing, since PDF text often loses or adds spaces. */
const PATTERNS = new Map(
  [...new Set(LAYOUT.map(e => e.label))].map(label => [
    label,
    new RegExp(escapeRegExp(plain(label)).replace(/\s+/g, '\\s*'), 'g')
  ])
);

/**
 * The value after each label in `text`, up to the next label.
 *
 * Labels are found anywhere, so a two-column table read across both columns
 * still splits correctly. A label inside a longer one ("Amount:" in
 * "Met Amount:") is not a match. A label printed more than once fills its
 * fields in table order: the first "Met Amount:" is the deductible's, the
 * second the out-of-pocket's. With `lastEndsAtLineBreak`, the last value stops
 * at the end of its line, so a page footer is not read as part of it.
 */
function readLabelled(text, entries, { lastEndsAtLineBreak = false } = {}) {
  // Labels are found in the straightened copy; values are taken from the original.
  const source = plain(text);
  const hits = [];
  for (const label of new Set(entries.map(e => e.label))) {
    for (const m of source.matchAll(PATTERNS.get(label))) {
      hits.push({ label, start: m.index, end: m.index + m[0].length });
    }
  }
  // Earliest first and, at the same spot, longest first; a hit inside one already kept is dropped.
  hits.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
  const kept = [];
  for (const hit of hits) {
    if (!kept.some(k => hit.start < k.end && hit.end > k.start)) kept.push(hit);
  }

  const seen = new Map();
  const values = {};
  kept.forEach((hit, i) => {
    const n = seen.get(hit.label) || 0;
    seen.set(hit.label, n + 1);
    const entry = entries.filter(e => e.label === hit.label)[n];
    if (!entry) return;
    let end = i + 1 < kept.length ? kept[i + 1].start : source.length;
    if (i + 1 === kept.length && lastEndsAtLineBreak) {
      const lineBreak = source.indexOf('\n', hit.end);
      if (lineBreak !== -1) end = lineBreak;
    }
    values[entry.field] = text.slice(hit.end, end).replace(/\s+/g, ' ').trim();
  });
  return { values, found: kept.length };
}

/** Fields from plain text: a PDF's, or a document whose table is not the template's shape. */
export function readVobText(text) {
  return readLabelled(text, LAYOUT, { lastEndsAtLineBreak: true });
}

const TABLE = /<w:tbl[ >].*?<\/w:tbl>/gs;
const ROW = /<w:tr[ >].*?<\/w:tr>/gs;
const CELL = /<w:tc[ >].*?<\/w:tc>/gs;
const TEXT_TOKEN = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:tab\/>|<w:br\b[^>]*\/>|<w:cr\/>|<\/w:p>/g;

const decodeXml = (s) =>
  s.replace(/&(lt|gt|quot|apos|amp|#\d+|#x[0-9a-f]+);/gi, (_, e) => {
    const named = { lt: '<', gt: '>', quot: '"', apos: "'", amp: '&' }[e.toLowerCase()];
    if (named) return named;
    return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
  });

/** A piece of word/document.xml as text: one line per paragraph or line break. */
function textOf(xml) {
  let out = '';
  for (const m of xml.matchAll(TEXT_TOKEN)) {
    if (m[1] !== undefined) out += decodeXml(m[1]);
    else out += m[0] === '<w:tab/>' ? ' ' : '\n';
  }
  return out;
}

/**
 * Fields from a .docx's bytes. A document in the template's shape (its main
 * table with the template's rows and cells) is read cell by cell, each cell
 * against its own labels; any other is read as running text.
 */
export function readVobDocx(bytes) {
  let xml;
  try {
    const zip = XLSX.CFB.read(bytes, { type: 'buffer' });
    const doc = XLSX.CFB.find(zip, '/word/document.xml');
    if (!doc) throw new Error('no body');
    xml = new TextDecoder('utf-8').decode(new Uint8Array(doc.content));
  } catch {
    throw new Error('Couldn’t open this .docx. Check it opens in Word, then try again.');
  }

  const rowsOf = (tbl) => (tbl.match(ROW) || []).map(tr => tr.match(CELL) || []);
  const template = vobFormRows({});
  const main = (xml.match(TABLE) || [])
    .map(rowsOf)
    .find(rows => rows.length === template.length && rows.every((cells, r) => cells.length === template[r].cells.length));

  if (!main) return readVobText(textOf(xml));

  const values = {};
  let found = 0;
  main.forEach((cells, r) => cells.forEach((tc, c) => {
    const read = readLabelled(textOf(tc), LAYOUT.filter(e => e.row === r && e.cell === c));
    Object.assign(values, read.values);
    found += read.found;
  }));
  return { values, found };
}

/** All of a PDF's text, a line break wherever the PDF ends a line. */
async function pdfText(bytes) {
  const [pdfjs, worker] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  const task = pdfjs.getDocument({ data: bytes });
  try {
    const pdf = await task.promise;
    let text = '';
    for (let n = 1; n <= pdf.numPages; n++) {
      const content = await (await pdf.getPage(n)).getTextContent();
      for (const item of content.items) {
        if (typeof item.str === 'string') text += item.str + (item.hasEOL ? '\n' : '');
      }
      text += '\n';
    }
    return text;
  } catch (err) {
    throw new Error(err?.name === 'PasswordException'
      ? 'This PDF is password-protected. Save a copy without the password and try again.'
      : 'Couldn’t open this PDF. Check it opens in a PDF viewer, then try again.');
  } finally {
    task.destroy();
  }
}

/** 'docx' or 'pdf' for a file the Queue tab takes; an error the specialist can act on otherwise. */
export function documentKind(file) {
  const name = (file?.name || '').toLowerCase();
  if (name.endsWith('.docx') || file?.type === DOCX_TYPE) return 'docx';
  if (name.endsWith('.pdf') || file?.type === 'application/pdf') return 'pdf';
  if (name.endsWith('.doc')) throw new Error('This is an old Word file (.doc). Save it as .docx or PDF, then drop it again.');
  throw new Error('Drop the VOB as a .docx or .pdf file.');
}

/** A reading as the Queue tab keeps it: fields, labels found, and whether that is enough to check. */
const asReading = (kind, { values, found }) => ({ kind, fields: values, found, total: LAYOUT.length, readable: found >= MIN_LABELS_FOUND });

/** What a dropped or imported VOB file says. */
export async function readVobDocument(file) {
  const kind = documentKind(file);
  if (file.size > MAX_DOCUMENT_BYTES) {
    throw new Error('This file is over 10 MB, too big to be a VOB. Check it is the right file.');
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  return asReading(kind, kind === 'docx' ? readVobDocx(bytes) : readVobText(await pdfText(bytes)));
}

/** What a VOB's pasted text says (copied out of Word or a PDF). */
export function readPastedVob(text) {
  return asReading('text', readVobText(text));
}

/** Whether a pasted file is one the Queue tab reads, without the explanation documentKind() gives. */
export function isVobFile(file) {
  try {
    documentKind(file);
    return true;
  } catch {
    return false;
  }
}
