import * as XLSX from 'xlsx';
import { vobFormRows, shownValue } from './vobFormRows';

/**
 * The per-patient VOB form (FR-15) as a Word document, filled into the master
 * template docs/VOB_PARKER - Copy.docx.
 *
 * Everything but the text of the PAT box and the main table's cells is the
 * template's own: the logo header, title, styles, page setup and every cell's
 * borders, shading and width. Each cell keeps its first paragraph's and first
 * run's formatting and holds its lines from vobFormRows(), one per line break,
 * as the template's multi-line cells do.
 *
 * The .docx is a zip; SheetJS (already here for the spreadsheets) reads and
 * writes it.
 */

export const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const escapeXml = (text) =>
  String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const TABLE = /<w:tbl>.*?<\/w:tbl>/gs;
const ROW = /<w:tr[ >].*?<\/w:tr>/gs;
const CELL = /<w:tc>.*?<\/w:tc>/gs;

/** A template cell holding these lines instead, in the cell's own formatting. */
function fillCell(tc, lines) {
  const tcPr = tc.match(/<w:tcPr>.*?<\/w:tcPr>/s)?.[0] ?? '';
  const pPr = tc.match(/<w:pPr>.*?<\/w:pPr>/s)?.[0] ?? '';
  const rPr = tc.match(/<w:r(?:\s[^>]*)?>(<w:rPr>.*?<\/w:rPr>)/s)?.[1] ?? '';
  const runs = lines
    .map((l) => `<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(`${l.label} ${shownValue(l)}`)}</w:t></w:r>`)
    .join(`<w:r>${rPr}<w:br/></w:r>`);
  return `<w:tc>${tcPr}<w:p>${pPr}${runs}</w:p></w:tc>`;
}

/** Each cell of a row filled from its lines, refusing a row shaped unlike the template. */
function fillRow(tr, cells, rowNumber) {
  const count = tr.match(CELL)?.length ?? 0;
  if (count !== cells.length) {
    throw new Error(`VOB form template row ${rowNumber} has ${count} cells; expected ${cells.length}.`);
  }
  let k = 0;
  return tr.replace(CELL, (tc) => fillCell(tc, cells[k++]));
}

/** word/document.xml with the PAT box and the main table filled from the VOB. */
export function fillDocumentXml(xml, formData) {
  const f = formData || {};
  const rows = vobFormRows(f);
  let table = 0;
  const filled = xml.replace(TABLE, (tbl) => {
    table += 1;
    if (table === 1) {
      return tbl.replace(CELL, (tc) => fillCell(tc, [{ label: 'PAT:', value: f.pat, fallback: '—' }]));
    }
    if (table !== 2) return tbl;
    const found = tbl.match(ROW)?.length ?? 0;
    if (found !== rows.length) {
      throw new Error(`VOB form template has ${found} table rows; expected ${rows.length}.`);
    }
    let r = 0;
    return tbl.replace(ROW, (tr) => {
      const row = rows[r++];
      return fillRow(tr, row.cells, r);
    });
  });
  if (table < 2) throw new Error('VOB form template is missing its PAT box or main table.');
  return filled;
}

/** The filled .docx, as bytes, from the template's bytes. */
export function fillVobTemplate(templateBytes, formData) {
  const { CFB } = XLSX;
  const zip = CFB.read(templateBytes, { type: 'buffer' });
  const doc = CFB.find(zip, '/word/document.xml');
  if (!doc) throw new Error('VOB form template has no word/document.xml.');

  const xml = new TextDecoder('utf-8').decode(new Uint8Array(doc.content));
  CFB.utils.cfb_add(zip, '/word/document.xml', new TextEncoder().encode(fillDocumentXml(xml, formData)));
  // SheetJS adds a marker entry of its own on read; a Word package has no place for it.
  CFB.utils.cfb_del(zip, '/\u0001Sh33tJ5');
  return new Uint8Array(CFB.write(zip, { fileType: 'zip', type: 'buffer', compression: true }));
}

/** VOB_<CLIENT>_<INSURANCE>_<INITIALS>_<MM_DD_YYYY>.docx, after the sample VOB_PARKER_UHC_ACT_01_01_2025. */
export function vobDocxFilename({ client, insurance, patientName, dos }) {
  const part = (text) => String(text || '').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
  const initials = String(patientName || '')
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('');
  const m = String(dos || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  const date = m ? `${m[2]}_${m[3]}_${m[1]}` : '';
  return `${['VOB', part(client), part(insurance), part(initials), date].filter(Boolean).join('_')}.docx`;
}
