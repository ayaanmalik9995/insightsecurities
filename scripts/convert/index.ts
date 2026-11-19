/**
 * Sector workbook → dashboard JSON converter.
 *
 *   npm run data            convert every "live" sector in sectors.config.json
 *   npm run data -- pharma  convert one sector
 *
 * Reads only the Excel-calculated values (the workbook's formulas are the source
 * of truth), validates the format, cleans known quirks and writes public/data/.
 * Any structural problem stops the run with a plain-English message and a
 * non-zero exit code, so a bad file can never reach the dashboard.
 */
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import {
  BALANCE_SHEET_INPUTS, CATALOG, NON_METRIC_COLUMNS, REQUIRED_COLUMNS, TEMPLATE_SHEETS,
  inferUnit, slugify, type MetricDef, type Unit,
} from './catalog.ts';
import { ConvertError, hasSheet, loadWorkbook, readNotes, readTable, type Cell, type SheetTable, type Workbook } from './read.ts';

const ROOT = resolve(import.meta.dirname, '../..');
const OUT = join(ROOT, 'public/data');
const COVERAGE_THRESHOLD = 0.75;

type Status = 'ok' | 'na' | 'nm' | 'blank' | 'nobs' | 'err';
interface SectorConfig {
  slug: string; name: string; shortName?: string; status: 'live' | 'coming_soon' | 'hidden' | 'dev';
  workbook?: string; description?: string;
  aggregates?: AggregateDef[]; kpis?: string[]; trend?: unknown; leagueTables?: string[];
  valuationMap?: unknown; compare?: unknown; companyCharts?: unknown; headToHead?: unknown;
  headline?: unknown; metricOverrides?: Record<string, Partial<MetricDef>>;
}
interface AggregateDef {
  id: string; label: string; unit: Unit; type: 'sum' | 'median' | 'ratio_of_sums';
  metric?: string; num?: string; den?: string; ttm?: boolean; minusOne?: boolean;
  denAverageLag?: number; positiveOnly?: boolean; direction?: 'higher' | 'lower' | 'neutral';
}

// ---------------------------------------------------------------- helpers
const iso = (d: Date) => d.toISOString().slice(0, 10);
const serialToDate = (serial: number) => new Date(Math.round((serial - 25569) * 86400000));
const round = (v: number) => (Number.isInteger(v) ? v : Number(v.toPrecision(7)));
const quarterKey = (d: Date) => `${d.getUTCFullYear()}Q${Math.floor(d.getUTCMonth() / 3) + 1}`;
const keyToIndex = (k: string) => Number(k.slice(0, 4)) * 4 + Number(k.slice(5)) - 1;
const indexToKey = (i: number) => `${Math.floor(i / 4)}Q${(i % 4) + 1}`;
const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

function asDate(c: Cell | undefined): Date | null {
  if (!c || c.value === null) return null;
  if (c.value instanceof Date) return c.value;
  if (typeof c.value === 'number') return serialToDate(c.value);
  if (typeof c.value === 'string') {
    const t = Date.parse(c.value);
    return Number.isNaN(t) ? null : new Date(t);
  }
  return null;
}

/** Interpret a value cell: number, or one of the workbook's documented text markers. */
function asValue(c: Cell | undefined): { value: number | null; status: Status; raw?: string } {
  if (!c) return { value: null, status: 'blank' };
  if (c.error) return { value: null, status: 'err', raw: c.error };
  if (typeof c.value === 'number') return Number.isFinite(c.value) ? { value: c.value, status: 'ok' } : { value: null, status: 'na' };
  if (c.value === null) return { value: null, status: 'blank' };
  const s = String(c.value).trim().toLowerCase();
  if (s === '') return { value: null, status: 'blank' };
  if (s === 'n/a' || s === 'na') return { value: null, status: 'na' };
  if (s === 'n/m' || s === 'nm') return { value: null, status: 'nm' };
  const n = Number(s.replace(/,/g, ''));
  if (!Number.isNaN(n)) return { value: n, status: 'ok' };
  return { value: null, status: 'err', raw: String(c.value) };
}

class Issues {
  errors: string[] = [];
  warnings: string[] = [];
  error(msg: string) { this.errors.push(msg); }
  warn(msg: string) { this.warnings.push(msg); }
}

function findWorkbook(sector: SectorConfig): string {
  if (sector.workbook && existsSync(sector.workbook) && statSync(sector.workbook).isFile()) return resolve(sector.workbook);
  if (!sector.workbook) throw new ConvertError(`Sector "${sector.slug}" is live but has no "workbook" in sectors.config.json.`);
  const p = join(ROOT, sector.workbook);
  if (!existsSync(p)) throw new ConvertError(`Workbook path not found: ${sector.workbook}`, `Create the folder and put the sector's .xlsx file in it.`);
  if (statSync(p).isFile()) return p;
  const files = readdirSync(p).filter((f) => f.toLowerCase().endsWith('.xlsx') && !f.startsWith('~$'));
  if (files.length === 0) throw new ConvertError(`No .xlsx workbook found in ${sector.workbook}/`, 'Copy the sector workbook into this folder.');
  if (files.length > 1) throw new ConvertError(`More than one .xlsx in ${sector.workbook}/: ${files.join(', ')}`, 'Keep exactly one workbook per sector folder (move old versions elsewhere).');
  return join(p, files[0]);
}

// ---------------------------------------------------------------- convert one sector
async function convertSector(sector: SectorConfig, dryRun = false) {
  const issues = new Issues();
  const file = findWorkbook(sector);
  const buf = readFileSync(file);
  let wb: Workbook;
  try {
    wb = loadWorkbook(buf);
  } catch (e) {
    throw new ConvertError(`Could not open ${basename(file)} as an Excel workbook (${(e as Error).message}).`, 'Make sure it is a .xlsx file saved from Excel, not .xls or .csv, and not password-protected.');
  }

  const S = TEMPLATE_SHEETS;
  const tCo = readTable(wb, S.companies, ['Ticker', 'Company'], REQUIRED_COLUMNS.Companies);
  const tQ = readTable(wb, S.quarterly, ['Ticker', 'Quarter end'], REQUIRED_COLUMNS.Qtr_Input);
  const tA = readTable(wb, S.annual, ['Ticker', 'Year'], REQUIRED_COLUMNS.Annual);
  const tP = readTable(wb, S.prices, ['Ticker', 'Date', 'Price'], REQUIRED_COLUMNS.Prices);
  const filingsSheet = hasSheet(wb, S.filings);
  for (const t of [tCo, tQ, tA, tP]) if (t.blankRowsInside) issues.warn(`Sheet "${t.sheet}": ${t.blankRowsInside} empty row(s) between data rows were skipped. Check nothing was deleted by mistake.`);

  // ---- formulas must have been calculated by Excel
  for (const t of [tCo, tQ, tA]) {
    const missingByCol = new Map<string, number[]>();
    for (const r of t.rows) for (const [h, c] of Object.entries(r.cells)) if (c.missingResult) {
      if (!missingByCol.has(h)) missingByCol.set(h, []);
      missingByCol.get(h)!.push(r.rowNumber);
    }
    if (missingByCol.size) {
      const cols = [...missingByCol.entries()].slice(0, 6).map(([h, rows]) => `"${h}" (rows ${rows.slice(0, 5).join(', ')}${rows.length > 5 ? ', …' : ''})`);
      issues.error(`Sheet "${t.sheet}": ${missingByCol.size} formula column(s) have no calculated values: ${cols.join('; ')}. Open the workbook in Excel, let it calculate (Formulas → Calculate Now), save, and run again.`);
    }
  }

  // ---- companies
  const companies: Record<string, { ticker: string; name: string; shares: number; fyEndMonth: number; row: number }> = {};
  for (const r of tCo.rows) {
    const ticker = String(r.cells['Ticker'].value ?? '').trim().toUpperCase();
    const name = String(r.cells['Company'].value ?? '').trim();
    const shares = asValue(r.cells['Shares outstanding (mn)']).value;
    const fy = asValue(r.cells['FY end month']).value;
    if (!ticker) continue;
    if (companies[ticker]) issues.error(`Companies row ${r.rowNumber}: ticker ${ticker} appears twice.`);
    if (!name) issues.error(`Companies row ${r.rowNumber}: ${ticker} has no company name.`);
    if (shares === null || shares <= 0) issues.error(`Companies row ${r.rowNumber}: ${ticker} shares outstanding must be a positive number (found "${r.cells['Shares outstanding (mn)'].value ?? ''}").`);
    if (fy === null || !Number.isInteger(fy) || fy < 1 || fy > 12) issues.error(`Companies row ${r.rowNumber}: ${ticker} FY end month must be 1-12 (6 = June, 12 = December).`);
    companies[ticker] = { ticker, name, shares: shares ?? 0, fyEndMonth: fy ?? 12, row: r.rowNumber };
  }
  if (!Object.keys(companies).length) issues.error('Companies sheet has no companies.');

  // ---- metric dictionary from headers
  const metrics: Record<string, MetricDef & { id: string; header: string; basis: ('Q' | 'FY')[]; inferred?: boolean }> = {};
  const registerColumns = (t: SheetTable, basis: 'Q' | 'FY') => {
    for (const h of t.headers) {
      const id = slugify(h);
      if (NON_METRIC_COLUMNS.has(id)) continue;
      if (metrics[id]) { if (!metrics[id].basis.includes(basis)) metrics[id].basis.push(basis); continue; }
      const known = CATALOG[id];
      const override = sector.metricOverrides?.[id] ?? {};
      if (known) {
        metrics[id] = { id, header: h, basis: [basis], ...known, ...override };
      } else {
        const sample = t.rows.slice(0, 200).map((r) => asValue(r.cells[h]).value).filter((v): v is number => v !== null);
        metrics[id] = { id, header: h, basis: [basis], label: h, unit: inferUnit(h, sample), direction: 'neutral', group: 'income', inferred: true, ...override };
        if (!sector.metricOverrides?.[id]) issues.warn(`New column "${h}" on ${t.sheet} → metric "${id}" (unit guessed as ${metrics[id].unit}). Describe it under metricOverrides in sectors.config.json if the guess is wrong.`);
      }
    }
  };
  registerColumns(tQ, 'Q');
  registerColumns(tA, 'FY');

  // ---- quarterly facts
  type Fact = [string, string, string, number | null, Status?];
  const facts: Fact[] = [];
  const qIndex = new Map<string, Map<string, { values: Record<string, { value: number | null; status: Status }>; hasBS: boolean }>>();
  const seen = new Set<string>();
  const quarterCols = tQ.headers.filter((h) => !NON_METRIC_COLUMNS.has(slugify(h)));
  for (const r of tQ.rows) {
    const ticker = String(r.cells['Ticker'].value ?? '').trim().toUpperCase();
    const d = asDate(r.cells['Quarter end']);
    if (!companies[ticker]) { issues.error(`Qtr_Input row ${r.rowNumber}: ticker "${ticker}" is not in the Companies sheet.`); continue; }
    if (!d) { issues.error(`Qtr_Input row ${r.rowNumber}: "Quarter end" for ${ticker} is not a date.`); continue; }
    const m = d.getUTCMonth() + 1;
    const last = new Date(Date.UTC(d.getUTCFullYear(), m, 0)).getUTCDate();
    if (![3, 6, 9, 12].includes(m) || d.getUTCDate() !== last) issues.error(`Qtr_Input row ${r.rowNumber}: ${ticker} quarter end ${iso(d)} is not a calendar quarter end (31 Mar, 30 Jun, 30 Sep, 31 Dec).`);
    const pk = quarterKey(d);
    if (seen.has(ticker + pk)) issues.error(`Qtr_Input row ${r.rowNumber}: ${ticker} ${pk} is entered twice.`);
    seen.add(ticker + pk);

    const hasBS = BALANCE_SHEET_INPUTS.some((id) => asValue(r.cells[metrics[id]?.header ?? '']).status === 'ok');
    const values: Record<string, { value: number | null; status: Status }> = {};
    for (const h of quarterCols) {
      const id = slugify(h);
      let v = asValue(r.cells[h]);
      if (v.status === 'err') {
        if (metrics[id]?.input) issues.error(`Qtr_Input row ${r.rowNumber}, "${h}": expected a number, found "${v.raw}".`);
        else issues.warn(`Qtr_Input row ${r.rowNumber}, "${h}": Excel error ${v.raw}; shown as n/a.`);
        v = { value: null, status: 'na' };
      }
      // Excel computes 0 for borrowings / net cash when the balance sheet is blank: not a real zero.
      if (!hasBS && metrics[id]?.needsBalanceSheet) v = { value: null, status: 'nobs' };
      values[id] = v;
      facts.push(v.status === 'ok' ? [ticker, pk, id, round(v.value!)] : [ticker, pk, id, null, v.status]);
    }
    if (values.net_sales?.status === 'blank') issues.warn(`Qtr_Input row ${r.rowNumber}: ${ticker} ${pk} has no net sales.`);
    if (!qIndex.has(ticker)) qIndex.set(ticker, new Map());
    qIndex.get(ticker)!.set(pk, { values, hasBS });
  }

  // ---- annual facts
  const annualStatus: Record<string, Record<string, string>> = {};
  const annualCols = tA.headers.filter((h) => !NON_METRIC_COLUMNS.has(slugify(h)));
  const seenA = new Set<string>();
  for (const r of tA.rows) {
    const ticker = String(r.cells['Ticker'].value ?? '').trim().toUpperCase();
    const year = asValue(r.cells['Year']).value;
    if (!companies[ticker]) { issues.error(`Annual row ${r.rowNumber}: ticker "${ticker}" is not in the Companies sheet.`); continue; }
    if (year === null || !Number.isInteger(year)) { issues.error(`Annual row ${r.rowNumber}: "Year" for ${ticker} must be a whole year like 2025.`); continue; }
    const pk = `FY${year}`;
    if (seenA.has(ticker + pk)) issues.error(`Annual row ${r.rowNumber}: ${ticker} ${pk} is entered twice.`);
    seenA.add(ticker + pk);
    const status = String(r.cells['Status'].value ?? '').trim();
    (annualStatus[ticker] ??= {})[pk] = status || 'Complete';
    if (status && status !== 'Complete') continue; // incomplete years are reported as "in progress", not as zeros
    for (const h of annualCols) {
      const id = slugify(h);
      let v = asValue(r.cells[h]);
      if (v.status === 'err') { issues.warn(`Annual row ${r.rowNumber}, "${h}": unexpected value "${v.raw}"; shown as n/a.`); v = { value: null, status: 'na' }; }
      facts.push(v.status === 'ok' ? [ticker, pk, id, round(v.value!)] : [ticker, pk, id, null, v.status]);
    }
  }

  // ---- prices
  const priceMap = new Map<string, Map<number, number>>();
  const unknownPriceTickers = new Set<string>();
  let badPrices = 0;
  for (const r of tP.rows) {
    const ticker = String(r.cells['Ticker'].value ?? '').trim().toUpperCase();
    const d = asDate(r.cells['Date']);
    const p = asValue(r.cells['Price']).value;
    if (!companies[ticker]) { unknownPriceTickers.add(ticker); continue; }
    if (!d || p === null || p <= 0) { badPrices++; if (badPrices <= 5) issues.warn(`Prices row ${r.rowNumber}: skipped (date or price missing/invalid).`); continue; }
    const day = Math.floor(d.getTime() / 86400000);
    if (!priceMap.has(ticker)) priceMap.set(ticker, new Map());
    priceMap.get(ticker)!.set(day, p); // later rows win if a day is pasted twice
  }
  if (badPrices > 5) issues.warn(`Prices: ${badPrices} rows skipped in total.`);
  if (unknownPriceTickers.size) issues.warn(`Prices: tickers not in Companies were ignored: ${[...unknownPriceTickers].join(', ')}.`);
  for (const t of Object.keys(companies)) if (!priceMap.has(t)) issues.warn(`Prices: no prices for ${t}; its price chart and valuation will be empty.`);

  // ---- spot-check Excel's calculated columns against an independent recalculation
  let checks = 0, mismatches = 0;
  const close = (a: number, b: number) => Math.abs(a - b) <= Math.max(1e-6, Math.abs(b) * 0.002);
  for (const [ticker, qs] of qIndex) {
    for (const [pk, row] of qs) {
      const i = keyToIndex(pk);
      const last4 = [0, 1, 2, 3].map((k) => qs.get(indexToKey(i - k)));
      const v = row.values;
      if (last4.every(Boolean) && v.ttm_net_sales?.status === 'ok') {
        checks++;
        const s = last4.reduce((a, q) => a + (q!.values.net_sales?.value ?? 0), 0);
        if (!close(s, v.ttm_net_sales.value!)) { mismatches++; if (mismatches <= 8) issues.warn(`Check: ${ticker} ${pk} TTM net sales is ${v.ttm_net_sales.value}, recalculated ${s}.`); }
      }
      if (v.gross_margin?.status === 'ok' && v.net_sales?.value) {
        checks++;
        const gm = (v.gross_profit.value ?? 0) / v.net_sales.value;
        if (!close(gm, v.gross_margin.value!)) { mismatches++; if (mismatches <= 8) issues.warn(`Check: ${ticker} ${pk} gross margin ${v.gross_margin.value} vs recalculated ${gm}.`); }
      }
      if (v.market_cap?.status === 'ok' && v.average_price?.status === 'ok') {
        checks++;
        const mc = v.average_price.value! * companies[ticker].shares;
        if (!close(mc, v.market_cap.value!)) { mismatches++; if (mismatches <= 8) issues.warn(`Check: ${ticker} ${pk} market cap ${v.market_cap.value} vs price × shares ${mc}.`); }
      }
      if (v.pe_ttm?.status === 'ok' && v.ttm_net_profit?.value) {
        checks++;
        const pe = v.market_cap.value! / v.ttm_net_profit.value;
        if (!close(pe, v.pe_ttm.value!)) { mismatches++; if (mismatches <= 8) issues.warn(`Check: ${ticker} ${pk} P/E ${v.pe_ttm.value} vs recalculated ${pe}.`); }
      }
    }
  }
  if (mismatches > 8) issues.warn(`Check: ${mismatches} of ${checks} recalculations differ from the workbook (first 8 listed).`);

  if (issues.errors.length) {
    const list = issues.errors.slice(0, 40).map((e) => `  ✗ ${e}`).join('\n');
    throw new ConvertError(`${basename(file)} has ${issues.errors.length} problem(s):\n${list}${issues.errors.length > 40 ? `\n  … and ${issues.errors.length - 40} more` : ''}`, 'Nothing was published. Fix the workbook and run `npm run data` again.');
  }

  // ---- calendar quarters, coverage, as-of dates
  const allQuarters = [...new Set([...qIndex.values()].flatMap((m) => [...m.keys()]))].sort((a, b) => keyToIndex(a) - keyToIndex(b));
  const coverage = allQuarters.map((pk) => {
    let rows = 0, pl = 0, bs = 0;
    for (const qs of qIndex.values()) { const q = qs.get(pk); if (!q) continue; rows++; if (q.values.net_sales?.status === 'ok') pl++; if (q.hasBS) bs++; }
    return { period: pk, companies: rows, pl, bs };
  });
  const nCo = Object.keys(companies).length;
  const latestWith = (f: (c: (typeof coverage)[number]) => number) =>
    [...coverage].reverse().find((c) => f(c) / Math.max(1, nCo) >= COVERAGE_THRESHOLD)?.period ?? allQuarters.at(-1)!;
  const quarterEnd = (pk: string) => { const y = Number(pk.slice(0, 4)), q = Number(pk.slice(5)); return iso(new Date(Date.UTC(y, q * 3, 0))); };
  const latestPL = latestWith((c) => c.pl);
  const latestBS = latestWith((c) => c.bs);
  const lastPriceDay = Math.max(...[...priceMap.values()].map((m) => Math.max(...m.keys())));

  // ---- sector aggregates
  const get = (t: string, pk: string, id: string) => {
    const v = qIndex.get(t)?.get(pk)?.values[id];
    return v && v.status === 'ok' ? v.value! : null;
  };
  const ttm = (t: string, pk: string, id: string) => {
    const i = keyToIndex(pk); let s = 0;
    for (let k = 0; k < 4; k++) { const v = get(t, indexToKey(i - k), id); if (v === null) return null; s += v; }
    return s;
  };
  const aggregates: Record<string, unknown> = {};
  const tickers = Object.keys(companies);
  for (const a of sector.aggregates ?? []) {
    for (const ref of [a.metric, a.num, a.den]) if (ref && !metrics[ref]) issues.warn(`Aggregate "${a.id}" uses metric "${ref}", which is not in this workbook; it will be empty.`);
    const points = allQuarters.map((pk) => {
      const i = keyToIndex(pk);
      const prev = indexToKey(i - 4);
      let value: number | null = null, n = 0, yoy: number | null = null;
      if (a.type === 'sum') {
        let s = 0, now = 0, then = 0, both = 0;
        for (const t of tickers) {
          const v = get(t, pk, a.metric!); if (v === null) continue; s += v; n++;
          const p = get(t, prev, a.metric!); if (p !== null) { now += v; then += p; both++; }
        }
        value = n ? s : null;
        yoy = both && then ? now / then - 1 : null; // like-for-like: only companies present in both periods
      } else if (a.type === 'median') {
        const xs = tickers.map((t) => get(t, pk, a.metric!)).filter((v): v is number => v !== null && (!a.positiveOnly || v > 0));
        value = median(xs); n = xs.length;
        const ps = tickers.map((t) => get(t, prev, a.metric!)).filter((v): v is number => v !== null && (!a.positiveOnly || v > 0));
        const pm = median(ps); yoy = value !== null && pm ? value / pm - 1 : null;
      } else if (a.type === 'ratio_of_sums') {
        const calc = (period: string) => {
          let num = 0, den = 0, cnt = 0;
          for (const t of tickers) {
            const nv = a.ttm ? ttm(t, period, a.num!) : get(t, period, a.num!);
            let dv = a.ttm ? ttm(t, period, a.den!) : get(t, period, a.den!);
            if (dv !== null && a.denAverageLag) {
              const lagged = get(t, indexToKey(keyToIndex(period) - a.denAverageLag), a.den!);
              dv = lagged === null ? null : (dv + lagged) / 2;
            }
            if (nv === null || dv === null || dv === 0) continue;
            num += nv; den += dv; cnt++;
          }
          return { v: cnt && den ? num / den - (a.minusOne ? 1 : 0) : null, cnt };
        };
        const cur = calc(pk); value = cur.v; n = cur.cnt;
        const pr = calc(prev); yoy = value !== null && pr.v !== null ? value - pr.v : null; // change in percentage points
      }
      const cov = coverage.find((c) => c.period === pk)!;
      return { p: pk, v: value === null ? null : round(value), n, of: cov.companies, yoy: yoy === null ? null : round(yoy) };
    });
    const latest = [...points].reverse().find((pt) => pt.v !== null && pt.n / Math.max(1, nCo) >= COVERAGE_THRESHOLD)?.p ?? null;
    const refs = [a.metric, a.num, a.den].filter(Boolean).join(' ');
    const basis = a.ttm || a.denAverageLag || /ttm/.test(refs) ? 'ttm' : a.type === 'median' ? 'point' : 'quarter';
    const direction = a.direction ?? (a.type === 'median' && metrics[a.metric!]?.group === 'valuation' ? 'neutral' : 'higher');
    aggregates[a.id] = { id: a.id, label: a.label, unit: a.unit, type: a.type, yoyKind: a.type === 'ratio_of_sums' ? 'pp' : 'pct', basis, direction, metric: a.metric ?? a.num, points, latest };
  }

  // ---- company master
  const companyOut = tickers.map((t) => {
    const qs = qIndex.get(t);
    const keys = qs ? [...qs.keys()].sort((a, b) => keyToIndex(a) - keyToIndex(b)) : [];
    const bsKeys = keys.filter((k) => qs!.get(k)!.hasBS);
    const pm = priceMap.get(t);
    const days = pm ? [...pm.keys()].sort((a, b) => a - b) : [];
    const lastDay = days.at(-1), prevDay = days.at(-2);
    return {
      ticker: t,
      name: companies[t].name,
      sharesOutstandingMn: companies[t].shares,
      fyEndMonth: companies[t].fyEndMonth,
      firstQuarter: keys[0] ?? null,
      lastQuarter: keys.at(-1) ?? null,
      lastBalanceSheet: bsKeys.at(-1) ?? null,
      quarters: keys.length,
      annualStatus: annualStatus[t] ?? {},
      price: lastDay === undefined ? null : {
        from: iso(new Date(days[0] * 86400000)),
        to: iso(new Date(lastDay * 86400000)),
        last: round(pm!.get(lastDay)!),
        prev: prevDay === undefined ? null : round(pm!.get(prevDay)!),
        points: days.length,
      },
    };
  });

  // ---- optional Filings sheet (Ticker, Date, Title, URL, Type)
  let filings: { ticker: string; date: string; title: string; url?: string; type?: string }[] | null = null;
  if (filingsSheet) {
    try {
      const tF = readTable(wb, S.filings, ['Ticker', 'Date', 'Title'], ['Ticker', 'Date', 'Title']);
      filings = tF.rows.flatMap((r) => {
        const ticker = String(r.cells['Ticker'].value ?? '').trim().toUpperCase();
        const d = asDate(r.cells['Date']);
        const title = String(r.cells['Title'].value ?? '').trim();
        if (!d || !title) { issues.warn(`Filings row ${r.rowNumber}: skipped (needs a date and a title).`); return []; }
        if (!companies[ticker]) issues.warn(`Filings row ${r.rowNumber}: ticker "${ticker}" is not in Companies.`);
        const url = r.cells['URL'] ? String(r.cells['URL'].value ?? '').trim() : '';
        const type = r.cells['Type'] ? String(r.cells['Type'].value ?? '').trim() : '';
        return [{ ticker, date: iso(d), title, ...(url && /^https?:\/\//.test(url) ? { url } : {}), ...(type ? { type } : {}) }];
      }).sort((a, b) => b.date.localeCompare(a.date));
    } catch (e) {
      issues.warn(`Filings sheet ignored: ${(e as Error).message}`);
    }
  }

  if (dryRun) return { sectorOut: { asOf: { financials: quarterEnd(latestPL), prices: iso(new Date(lastPriceDay * 86400000)) } }, warnings: issues.warnings, nCo, facts: facts.length, checks, mismatches };

  // ---- write
  // Write into a staging folder, then swap it in, so a live site never reads a half-written sector.
  const finalDir = join(OUT, sector.slug);
  const dir = `${finalDir}.staging`;
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(dir, 'prices'), { recursive: true });
  const write = (name: string, data: unknown) => writeFileSync(join(dir, name), JSON.stringify(data));
  const notes = readNotes(wb, S.start, [S.quarterly, S.annual, 'Compare', S.companies, S.prices]);
  const sha = createHash('sha256').update(buf).digest('hex');
  const generatedAt = new Date().toISOString();

  write('metrics.json', Object.values(metrics));
  write('companies.json', companyOut);
  write('facts.json', { sector: sector.slug, fields: ['company', 'period', 'metric', 'value', 'status'], rows: facts });
  for (const [t, m] of priceMap) {
    const pts = [...m.entries()].sort((a, b) => a[0] - b[0]).map(([d, p]) => [d, Math.round(p * 100) / 100]);
    write(`prices/${t}.json`, { ticker: t, points: pts });
  }
  const sectorOut = {
    slug: sector.slug, name: sector.name, shortName: sector.shortName ?? sector.name, description: sector.description ?? '',
    generatedAt,
    source: { file: basename(file), sha256: sha, modified: statSync(file).mtime.toISOString() },
    asOf: { financials: quarterEnd(latestPL), financialsPeriod: latestPL, balanceSheet: quarterEnd(latestBS), balanceSheetPeriod: latestBS, prices: iso(new Date(lastPriceDay * 86400000)) },
    quarters: allQuarters,
    fiscalYears: [...new Set(facts.filter((f) => f[1].startsWith('FY')).map((f) => f[1]))].sort(),
    coverage,
    aggregates,
    config: {
      kpis: sector.kpis ?? [], trend: sector.trend ?? null, leagueTables: sector.leagueTables ?? [],
      valuationMap: sector.valuationMap ?? null, compare: sector.compare ?? null, companyCharts: sector.companyCharts ?? null,
      headToHead: sector.headToHead ?? null, headline: sector.headline ?? null,
    },
    notes,
    filings,
    warnings: issues.warnings.length,
  };
  write('sector.json', sectorOut);
  publishDir(dir, finalDir);

  // human-readable report next to the workbook
  const report = [
    `# Conversion report: ${sector.name}`,
    ``,
    `- Workbook: \`${basename(file)}\` (sha256 ${sha.slice(0, 12)}…)`,
    `- Converted: ${generatedAt}`,
    `- Companies: ${nCo} · quarterly rows: ${tQ.rows.length} · annual rows: ${tA.rows.length} · price rows: ${tP.rows.length}`,
    `- Facts written: ${facts.length} · metrics: ${Object.keys(metrics).length}`,
    `- Financials as of ${quarterEnd(latestPL)} (${latestPL}); balance sheets as of ${quarterEnd(latestBS)} (${latestBS}); prices to ${iso(new Date(lastPriceDay * 86400000))}`,
    `- Recalculation checks: ${checks} run, ${mismatches} differences`,
    ``,
    `## Coverage by company`,
    `| Ticker | FY end | Quarters | First | Last | Last balance sheet | Prices to |`,
    `|---|---|---|---|---|---|---|`,
    ...companyOut.map((c) => `| ${c.ticker} | ${c.fyEndMonth === 6 ? 'June' : c.fyEndMonth === 12 ? 'December' : c.fyEndMonth} | ${c.quarters} | ${c.firstQuarter} | ${c.lastQuarter} | ${c.lastBalanceSheet} | ${c.price?.to ?? '—'} |`),
    ``,
    `## Warnings (${issues.warnings.length})`,
    ...(issues.warnings.length ? issues.warnings.map((w) => `- ${w}`) : ['- None']),
    ``,
  ].join('\n');
  writeFileSync(join(ROOT, sector.workbook!, 'convert-report.md'), report);

  return { sectorOut, warnings: issues.warnings, nCo, facts: facts.length, checks, mismatches };
}

/** Swap a staging folder into place. Falls back to copy-over when Windows locks the folder (e.g. a running dev server). */
function publishDir(staging: string, finalDir: string) {
  const old = `${finalDir}.old`;
  try {
    if (existsSync(old)) rmSync(old, { recursive: true, force: true });
    if (existsSync(finalDir)) renameSync(finalDir, old);
    renameSync(staging, finalDir);
    rmSync(old, { recursive: true, force: true });
  } catch {
    if (existsSync(old) && !existsSync(finalDir)) renameSync(old, finalDir);
    cpSync(staging, finalDir, { recursive: true, force: true });
    const keep = new Set(listFiles(staging).map((f) => f.slice(staging.length)));
    for (const f of listFiles(finalDir)) if (!keep.has(f.slice(finalDir.length))) rmSync(f, { force: true });
    rmSync(staging, { recursive: true, force: true });
  }
}

function listFiles(d: string): string[] {
  return readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? listFiles(join(d, e.name)) : [join(d, e.name)]));
}

// ---------------------------------------------------------------- main
async function main() {
  const cfgPath = join(ROOT, 'sectors.config.json');
  let cfg: { defaultSector: string; sectors: SectorConfig[] };
  try {
    cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
  } catch (e) {
    throw new ConvertError(`sectors.config.json could not be read: ${(e as Error).message}`);
  }
  const slugs = new Set<string>();
  for (const s of cfg.sectors) {
    if (!/^[a-z0-9-]+$/.test(s.slug)) throw new ConvertError(`Sector slug "${s.slug}" must be lowercase letters, numbers or dashes.`);
    if (slugs.has(s.slug)) throw new ConvertError(`Sector slug "${s.slug}" appears twice in sectors.config.json.`);
    slugs.add(s.slug);
    if (!['live', 'coming_soon', 'hidden', 'dev'].includes(s.status)) throw new ConvertError(`Sector "${s.slug}": status must be live, coming_soon, hidden or dev.`);
  }
  // Validate a workbook without publishing:  npm run data -- --check path/to/file.xlsx [sector]
  if (process.argv[2] === '--check') {
    const file = process.argv[3];
    if (!file) throw new ConvertError('Usage: npm run data -- --check path/to/workbook.xlsx [sector-slug]');
    const base = cfg.sectors.find((x) => x.slug === (process.argv[4] ?? cfg.defaultSector)) ?? cfg.sectors[0];
    const r = await convertSector({ ...base, workbook: file }, true);
    console.log(`✓ ${basename(file)} is valid: ${r.nCo} companies, ${r.facts} facts, financials to ${r.sectorOut.asOf.financials}, prices to ${r.sectorOut.asOf.prices}.`);
    console.log(`  ${r.checks} recalculation checks, ${r.mismatches} differences, ${r.warnings.length} warning(s).`);
    for (const w of r.warnings.slice(0, 10)) console.log(`  ! ${w}`);
    console.log('  Nothing was published (check mode).');
    return;
  }
  const only = process.argv[2];
  mkdirSync(OUT, { recursive: true });

  const registry = [];
  for (const s of cfg.sectors) {
    if (s.status === 'hidden') continue;
    if ((s.status === 'live' || s.status === 'dev') && (!only || only === s.slug)) {
      const t0 = Date.now();
      process.stdout.write(`→ ${s.name}: reading ${s.workbook} … `);
      const r = await convertSector(s);
      console.log(`ok (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
      console.log(`  ${r.nCo} companies, ${r.facts} facts, financials to ${r.sectorOut.asOf.financials}, prices to ${r.sectorOut.asOf.prices}`);
      console.log(`  ${r.checks} recalculation checks, ${r.mismatches} differences, ${r.warnings.length} warning(s) → ${s.workbook}/convert-report.md`);
      for (const w of r.warnings.slice(0, 5)) console.log(`  ! ${w}`);
      registry.push({ slug: s.slug, name: s.name, shortName: s.shortName ?? s.name, status: s.status, description: s.description ?? '', asOf: r.sectorOut.asOf, companies: r.nCo });
    } else if (s.status === 'live' || s.status === 'dev') {
      const prev = existsSync(join(OUT, s.slug, 'sector.json')) ? JSON.parse(readFileSync(join(OUT, s.slug, 'sector.json'), 'utf8')) : null;
      registry.push({ slug: s.slug, name: s.name, shortName: s.shortName ?? s.name, status: s.status, description: s.description ?? '', asOf: prev?.asOf ?? null, companies: prev ? JSON.parse(readFileSync(join(OUT, s.slug, 'companies.json'), 'utf8')).length : 0 });
    } else {
      registry.push({ slug: s.slug, name: s.name, shortName: s.shortName ?? s.name, status: s.status, description: s.description ?? '' });
    }
  }
  const def = registry.find((r) => r.slug === cfg.defaultSector && r.status === 'live')?.slug ?? registry.find((r) => r.status === 'live')?.slug;
  if (!def) throw new ConvertError('No live sector to publish. Set at least one sector to "live" in sectors.config.json.');
  writeFileSync(join(OUT, 'sectors.json'), JSON.stringify({ generatedAt: new Date().toISOString(), defaultSector: def, sectors: registry }, null, 1));
  console.log(`✓ Wrote public/data/ (default sector: ${def})`);
}

main().catch((e) => {
  console.error('\n✗ Data conversion failed.\n');
  console.error(e instanceof ConvertError ? e.message : e);
  if (e instanceof ConvertError && e.hint) console.error(`\n  How to fix: ${e.hint}`);
  console.error('');
  process.exit(1);
});
