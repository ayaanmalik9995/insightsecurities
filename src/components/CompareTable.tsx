import type { CSSProperties } from 'react';
import type { SectorBundle } from '../lib/data';
import { median } from '../lib/data';
import { fmt, STATUS_HELP, STATUS_TEXT, UNIT_LABEL } from '../lib/format';
import { fyEndLabel } from '../lib/periods';
import type { Column } from './ui/DataTable';
import type { Cell, Direction, Unit } from '../lib/types';

export interface CompareRow {
  ticker: string;
  name: string;
  fyEndMonth: number;
  cells: Record<string, Cell>;
  ranks: Record<string, number | null>;
}

export interface CompareSpec {
  id: string;
  metric: string;
  isRank: boolean;
  label: string;
  unit: Unit;
  direction: Direction;
}

/** Build the columns of the comparison table from config entries like "pe" or "rank:pe". */
export function compareSpecs(b: SectorBundle, entries: string[]): CompareSpec[] {
  return entries
    .map((e) => {
      const isRank = e.startsWith('rank:');
      const metric = isRank ? e.slice(5) : e;
      if (!b.has(metric)) return null;
      const def = b.metric(metric);
      const short = def.short && def.short.length <= 4 ? def.short : def.label;
      return {
        id: e,
        metric,
        isRank,
        label: isRank ? `${short.replace(' (TTM)', '')} rank` : def.label,
        unit: def.unit,
        direction: def.direction,
      } satisfies CompareSpec;
    })
    .filter((x): x is CompareSpec => x !== null);
}

export function compareRows(b: SectorBundle, specs: CompareSpec[], period: string): CompareRow[] {
  const rows: CompareRow[] = b.companies.map((c) => ({ ticker: c.ticker, name: c.name, fyEndMonth: c.fyEndMonth, cells: {}, ranks: {} }));
  for (const s of specs) {
    if (s.isRank) continue;
    for (const r of rows) r.cells[s.id] = b.cell(r.ticker, period, s.metric);
  }
  // Rank 1 = cheapest, among positive values only (as in the research workbook).
  for (const s of specs.filter((x) => x.isRank)) {
    const vals = rows.map((r) => ({ r, v: b.value(r.ticker, period, s.metric) })).filter((x) => x.v !== null && x.v > 0);
    vals.sort((a, b) => (s.direction === 'higher' ? b.v! - a.v! : a.v! - b.v!));
    for (const r of rows) r.ranks[s.id] = null;
    vals.forEach((x, i) => { x.r.ranks[s.id] = i + 1; });
  }
  return rows;
}

/**
 * Heat colour by position within the column: the best value gets the strongest
 * green tint, the worst the strongest red. Valuation: lower = better (cheaper);
 * debt to equity: lower = better; everything else: higher = better.
 */
function heat(values: number[], v: number, direction: Direction, positiveOnly: boolean): CSSProperties | undefined {
  if (direction === 'neutral') return undefined;
  const pool = positiveOnly ? values.filter((x) => x > 0) : values;
  if (positiveOnly && v <= 0) return undefined;
  if (pool.length < 3) return undefined;
  const sorted = [...pool].sort((a, b) => a - b);
  const rank = sorted.indexOf(v);
  let t = rank / (sorted.length - 1); // 0 = lowest
  if (direction === 'higher') t = 1 - t; // 0 = best
  const strength = Math.abs(t - 0.5) * 2; // 0 in the middle, 1 at the ends
  if (strength < 0.2) return undefined;
  const pct = Math.round(6 + strength * 22);
  const col = t < 0.5 ? 'var(--pos)' : 'var(--neg)';
  return { backgroundColor: `color-mix(in oklab, ${col} ${pct}%, transparent)` };
}

export function compareColumns(b: SectorBundle, specs: CompareSpec[], rows: CompareRow[], period: string, onPick?: (t: string) => void): Column<CompareRow>[] {
  const annual = period.startsWith('FY');
  const cols: Column<CompareRow>[] = [
    {
      key: 'company', header: 'Company', exportHeader: 'Company', align: 'left', sticky: true, minWidth: 92,
      render: (r) => (
        <button type="button" onClick={(e) => { e.stopPropagation(); onPick?.(r.ticker); }} className="text-left font-semibold text-ink underline-offset-2 hover:text-brand-ink hover:underline" title={r.name}>
          {r.ticker}
        </button>
      ),
      exportValue: (r) => `${r.ticker} · ${r.name}`,
      sortValue: (r) => r.ticker,
    },
  ];
  if (annual) {
    cols.push({
      key: 'fyend', header: 'FY end', align: 'left',
      render: (r) => <span className="text-muted">{b.companyByTicker.get(r.ticker)?.annualStatus[period] && b.companyByTicker.get(r.ticker)!.annualStatus[period] !== 'Complete' ? 'in progress' : fyEndLabel(period, r.fyEndMonth)}</span>,
      exportValue: (r) => fyEndLabel(period, r.fyEndMonth),
      sortValue: (r) => r.fyEndMonth,
    });
  }
  for (const s of specs) {
    if (s.isRank) {
      cols.push({
        key: s.id, header: s.label, sub: '1 = cheapest', align: 'center',
        render: (r) => (r.ranks[s.id] === null ? <span className="text-faint">—</span> : <span className="num font-semibold text-ink-2">{r.ranks[s.id]}</span>),
        exportValue: (r) => r.ranks[s.id],
        sortValue: (r) => (r.ranks[s.id] === null ? null : -r.ranks[s.id]!),
      });
      continue;
    }
    const nums = rows.map((r) => r.cells[s.id]).filter((c) => c.s === 'ok').map((c) => c.v!);
    const positiveOnly = s.unit === 'x' && s.direction === 'lower';
    cols.push({
      key: s.id,
      header: s.label.replace(' (TTM)', ''),
      exportHeader: s.label,
      sub: `${UNIT_LABEL[s.unit] || ''}${s.label.includes('TTM') ? ' · TTM' : ''}`.replace(/^ · /, ''),
      render: (r) => {
        const c = r.cells[s.id];
        return c.s === 'ok' ? fmt(c.v, s.unit) : <span className="text-faint">{STATUS_TEXT[c.s]}</span>;
      },
      title: (r) => (r.cells[s.id].s === 'ok' ? undefined : STATUS_HELP[r.cells[s.id].s]),
      cellStyle: (r) => (r.cells[s.id].s === 'ok' ? heat(nums, r.cells[s.id].v!, s.direction, positiveOnly) : undefined),
      exportValue: (r) => {
        const c = r.cells[s.id];
        if (c.s !== 'ok') return STATUS_TEXT[c.s] === '—' ? '' : STATUS_TEXT[c.s];
        return s.unit === 'pct' ? +(c.v! * 100).toFixed(2) : +c.v!.toFixed(2);
      },
      sortValue: (r) => (r.cells[s.id].s === 'ok' ? r.cells[s.id].v : null),
    });
  }
  return cols;
}

export function compareMedians(specs: CompareSpec[], rows: CompareRow[]) {
  const out: Record<string, string> = {};
  for (const s of specs) {
    if (s.isRank) continue;
    const xs = rows.map((r) => r.cells[s.id]).filter((c) => c.s === 'ok').map((c) => c.v!);
    out[s.id] = fmt(median(xs), s.unit);
  }
  return out;
}
