import * as XLSX from 'xlsx';

/**
 * Workbook reading on top of SheetJS. We read Excel's stored (cached) results of
 * every formula; the workbook's own formulas are the source of truth. (ExcelJS
 * was tried first but silently drops cached results equal to 0.)
 */

/** A single cell after normalisation. Formula cells carry their Excel-calculated result. */
export interface Cell {
  value: number | string | Date | null;
  isFormula: boolean;
  /** Formula present but Excel never stored a calculated result. */
  missingResult: boolean;
  /** Excel error such as #DIV/0! or #N/A. */
  error?: string;
}

export interface SheetTable {
  sheet: string;
  headerRow: number;
  headers: string[];
  rows: { rowNumber: number; cells: Record<string, Cell> }[];
  /** Empty rows found between data rows (skipped). */
  blankRowsInside?: number;
}

export type Workbook = XLSX.WorkBook;

export class ConvertError extends Error {
  constructor(message: string, public readonly hint?: string) {
    super(message);
  }
}

export function loadWorkbook(buf: Buffer): Workbook {
  return XLSX.read(buf, { type: 'buffer', cellFormula: true, cellDates: false, cellNF: false, cellStyles: false, dense: false });
}

const EMPTY: Cell = { value: null, isFormula: false, missingResult: false };

function normalise(c: XLSX.CellObject | undefined): Cell {
  if (!c) return EMPTY;
  const isFormula = typeof c.f === 'string' && c.f.length > 0;
  if (c.t === 'e') return { value: null, isFormula, missingResult: false, error: String(c.w ?? XLSX.SSF?.format?.('General', c.v) ?? '#ERROR') };
  if (c.v === undefined || c.t === 'z') return { value: null, isFormula, missingResult: isFormula };
  if (c.t === 'n') return { value: c.v as number, isFormula, missingResult: false };
  if (c.t === 'd') return { value: c.v as Date, isFormula, missingResult: false };
  if (c.t === 'b') return { value: String(c.v), isFormula, missingResult: false };
  return { value: String(c.v), isFormula, missingResult: false };
}

const cellText = (c: Cell) => (typeof c.value === 'string' ? c.value.trim() : c.value === null ? '' : String(c.value));

/** Levenshtein distance, used to suggest the intended column when a header was renamed. */
function distance(a: string, b: string): number {
  const m = a.length, n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}

export function suggest(missing: string, found: string[]): string | undefined {
  const lower = missing.toLowerCase();
  const contains = found.find((f) => f.toLowerCase().includes(lower) || lower.includes(f.toLowerCase()));
  if (contains) return contains;
  let best: string | undefined, bestD = Infinity;
  for (const f of found) {
    const dd = distance(lower, f.toLowerCase());
    if (dd < bestD) { bestD = dd; best = f; }
  }
  return best && bestD <= Math.max(3, Math.floor(missing.length / 3)) ? best : undefined;
}

function sheetOrThrow(wb: Workbook, sheetName: string): XLSX.WorkSheet {
  const ws = wb.Sheets[sheetName];
  if (!ws) {
    const s = suggest(sheetName, wb.SheetNames);
    throw new ConvertError(
      `Sheet "${sheetName}" is missing from the workbook.`,
      `Sheets found: ${wb.SheetNames.join(', ')}.${s ? ` Did you rename "${sheetName}" to "${s}"? Rename it back.` : ''}`,
    );
  }
  return ws;
}

const at = (ws: XLSX.WorkSheet, r: number, c: number) => normalise(ws[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined);

/**
 * Locate a table on a sheet by finding the header row (first row, within the
 * first 20, that contains every key column), then read rows until the key
 * column is empty. Title and note rows above the header are ignored.
 * Row numbers reported to users are 1-based, as in Excel.
 */
export function readTable(wb: Workbook, sheetName: string, keyColumns: string[], required: string[]): SheetTable {
  const ws = sheetOrThrow(wb, sheetName);
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1:A1');

  let headerRow = -1;
  let headers: string[] = [];
  for (let r = range.s.r; r <= Math.min(range.s.r + 20, range.e.r); r++) {
    const texts: string[] = [];
    for (let c = 0; c <= range.e.c; c++) texts.push(cellText(at(ws, r, c)));
    if (keyColumns.every((k) => texts.includes(k))) {
      headerRow = r;
      headers = texts;
      break;
    }
  }
  if (headerRow < 0) {
    throw new ConvertError(
      `Sheet "${sheetName}": could not find the header row (looked for ${keyColumns.map((k) => `"${k}"`).join(' and ')} in rows 1-20).`,
      'The header row must keep these exact column names. Check for typos or extra spaces.',
    );
  }

  const present = headers.filter(Boolean);
  const missing = required.filter((h) => !present.includes(h));
  if (missing.length) {
    const lines = missing.map((m) => {
      const s = suggest(m, present.filter((p) => !required.includes(p)));
      return `  • "${m}"${s ? ` (found "${s}" instead; was it renamed?)` : ''}`;
    });
    throw new ConvertError(
      `Sheet "${sheetName}" is missing ${missing.length} required column(s) in header row ${headerRow + 1}:\n${lines.join('\n')}`,
      'Restore the original column names. The dashboard reads columns by name, so renamed columns cannot be matched.',
    );
  }
  const dupes = present.filter((h, i) => present.indexOf(h) !== i);
  if (dupes.length) throw new ConvertError(`Sheet "${sheetName}" has duplicate column names: ${[...new Set(dupes)].join(', ')}.`);

  const keyIdx = headers.indexOf(keyColumns[0]);
  const rows: SheetTable['rows'] = [];
  let blankRows = 0;
  let lastData = headerRow;
  for (let r = headerRow + 1; r <= range.e.r; r++) {
    if (!cellText(at(ws, r, keyIdx))) {
      // Blank rows are skipped, never treated as the end: a cleared block in the
      // middle of a sheet must not silently hide the rows below it.
      blankRows++;
      continue;
    }
    lastData = r;
    const cells: Record<string, Cell> = {};
    headers.forEach((h, i) => { if (h) cells[h] = at(ws, r, i); });
    rows.push({ rowNumber: r + 1, cells });
  }
  // Blank rows after the last data row are just the sheet's tail; only gaps inside the data matter.
  const tail = range.e.r - lastData;
  return { sheet: sheetName, headerRow: headerRow + 1, headers: present, rows, blankRowsInside: Math.max(0, blankRows - tail) };
}

export const hasSheet = (wb: Workbook, name: string) => Boolean(wb.Sheets[name]);

/** Read the "RATIOS" definitions block from Start and the note under each sheet title. */
export function readNotes(wb: Workbook, startSheet: string, otherSheets: string[]) {
  const definitions: { term: string; text: string }[] = [];
  const ws = wb.Sheets[startSheet];
  if (ws) {
    const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1:A1');
    let inRatios = false;
    for (let r = range.s.r; r <= range.e.r; r++) {
      const vals: string[] = [];
      for (let c = range.s.c; c <= range.e.c; c++) { const t = cellText(at(ws, r, c)); if (t) vals.push(t); }
      if (!vals.length) continue;
      if (vals.length === 1 && /^[A-Z][A-Z ,/&]+$/.test(vals[0])) { inRatios = vals[0] === 'RATIOS'; continue; }
      if (inRatios && vals.length >= 2) definitions.push({ term: vals[0], text: vals.slice(1).join(' ') });
    }
  }
  const sheetNotes: { sheet: string; text: string }[] = [];
  for (const name of otherSheets) {
    const s = wb.Sheets[name];
    if (!s) continue;
    for (let r = 1; r <= 2; r++) {
      const t = cellText(at(s, r, 0));
      if (t.length > 40) sheetNotes.push({ sheet: name, text: t });
    }
  }
  return { definitions, sheetNotes };
}
