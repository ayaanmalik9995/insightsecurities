import type { Status, Unit } from './types';

const MINUS = '−';
const nf = (digits: number) => new Intl.NumberFormat('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const cache = new Map<number, Intl.NumberFormat>();
function n(v: number, digits: number) {
  let f = cache.get(digits);
  if (!f) cache.set(digits, (f = nf(digits)));
  return f.format(v).replace('-', MINUS);
}

export interface FmtOpts {
  /** "379.8 bn" instead of "379,801" for PKR mn. */
  compact?: boolean;
  /** Prefix currency ("PKR", "Rs"). */
  currency?: boolean;
  digits?: number;
  sign?: boolean;
}

/** Format a metric value in its unit. PKR values are stored in millions. */
export function fmt(v: number | null | undefined, unit: Unit, o: FmtOpts = {}): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  const sign = o.sign && v > 0 ? '+' : '';
  switch (unit) {
    case 'pkr_mn': {
      const a = Math.abs(v);
      if (o.compact) {
        const [x, u] = a >= 1e6 ? [v / 1e6, 'tn'] : a >= 1e3 ? [v / 1e3, 'bn'] : [v, 'mn'];
        const d = o.digits ?? (Math.abs(x) >= 100 ? 0 : 1);
        return `${sign}${o.currency ? 'PKR ' : ''}${n(x, u === 'mn' ? 0 : d)} ${u}`;
      }
      return `${sign}${o.currency ? 'PKR ' : ''}${n(v, o.digits ?? 0)}${o.currency ? ' mn' : ''}`;
    }
    case 'pct': {
      const p = v * 100;
      const d = o.digits ?? (Math.abs(p) >= 1000 ? 0 : 1);
      return `${sign}${n(p, d)}%`;
    }
    case 'x': {
      const d = o.digits ?? (Math.abs(v) >= 100 ? 0 : 1);
      return `${sign}${n(v, d)}x`;
    }
    case 'rs': {
      const d = o.digits ?? (Math.abs(v) >= 1000 ? 0 : 2);
      return `${sign}${o.currency === false ? '' : 'Rs '}${n(v, d)}`;
    }
    default:
      return `${sign}${n(v, o.digits ?? 2)}`;
  }
}

/** Change label: relative % or percentage points. */
export function fmtChange(v: number | null | undefined, kind: 'pct' | 'pp'): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  const s = v > 0 ? '+' : '';
  if (kind === 'pp') return `${s}${n(v * 100, 1)} pp`;
  const p = v * 100;
  return `${s}${n(p, Math.abs(p) >= 1000 ? 0 : 1)}%`;
}

export const STATUS_TEXT: Record<Status, string> = {
  ok: '',
  na: 'n/a',
  nm: 'n/m',
  blank: '—',
  nobs: '—',
  err: 'n/a',
};

export const STATUS_HELP: Record<Status, string> = {
  ok: '',
  na: 'Not available: not enough history for this figure yet.',
  nm: 'Not meaningful: the company (or the comparison period) made a loss.',
  blank: 'Not reported for this period.',
  nobs: 'Balance sheet not yet filed for this quarter.',
  err: 'Not available.',
};

/** Value or its status marker. */
export function fmtCell(c: { v: number | null; s: Status }, unit: Unit, o: FmtOpts = {}) {
  return c.s === 'ok' ? fmt(c.v, unit, o) : STATUS_TEXT[c.s];
}

export const UNIT_LABEL: Record<Unit, string> = { pkr_mn: 'PKR mn', pct: '%', x: 'x', rs: 'Rs', number: '' };

/** Plain value for CSV/XLSX exports (no thousands separators, % as number). */
export function exportValue(c: { v: number | null; s: Status }, unit: Unit): number | string {
  if (c.s !== 'ok' || c.v === null) return STATUS_TEXT[c.s] === '—' ? '' : STATUS_TEXT[c.s];
  if (unit === 'pct') return Math.round(c.v * 100 * 100) / 100;
  return Math.round(c.v * 100) / 100;
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "30 Sep 2026" (long) or "Sep 2026" (short); fixed English months so "Sept" never appears. */
export function fmtDate(iso: string, style: 'short' | 'long' = 'long') {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return style === 'long' ? `${d} ${MON[m - 1]} ${y}` : `${MON[m - 1]} ${y}`;
}
