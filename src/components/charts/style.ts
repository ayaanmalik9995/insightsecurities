import type { Palette } from '../../lib/theme';

/** Shared ECharts styling so every chart reads as one system. */
export function axisCommon(p: Palette) {
  return {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: p.muted, fontSize: 11, fontFamily: p.font, hideOverlap: true },
    splitLine: { show: true, lineStyle: { color: p.grid, width: 1 } },
    nameTextStyle: { color: p.faint, fontSize: 11, fontFamily: p.font },
  };
}

export function categoryAxisCommon(p: Palette) {
  return {
    axisLine: { show: true, lineStyle: { color: p.lineStrong } },
    axisTick: { show: false },
    axisLabel: { color: p.muted, fontSize: 11, fontFamily: p.font, hideOverlap: true },
    splitLine: { show: false },
  };
}

export function tooltipBase(p: Palette) {
  return {
    backgroundColor: p.surface,
    borderColor: p.line,
    borderWidth: 1,
    padding: 0,
    className: 'ins-tooltip',
    textStyle: { color: p.ink, fontFamily: p.font, fontSize: 12 },
    extraCssText: 'max-width: 300px; white-space: normal;',
    confine: true,
    transitionDuration: 0.12,
  };
}

/** Small drawn up/down marker for canvas tooltips (HTML strings cannot host React icons). */
const tri = (color: string, up: boolean) =>
  `<svg width="8" height="8" viewBox="0 0 8 8" style="display:inline-block;margin-right:3px;vertical-align:0"><path d="${up ? 'M4 1 L7.5 7 L0.5 7 Z' : 'M4 7 L7.5 1 L0.5 1 Z'}" fill="${color}"/></svg>`;

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export interface TipRow {
  label: string;
  value: string;
  color?: string;
  /** Change text with sign; coloured by the sign. */
  change?: string | null;
  changeTone?: 'pos' | 'neg' | 'neutral';
  bold?: boolean;
}

/** Tooltip body: heading, rows (value + change), and a source/as-of line. */
export function tipHTML(p: Palette, title: string, subtitle: string | null, rows: TipRow[], source?: string) {
  const r = rows
    .map((row) => {
      const dot = row.color ? `<span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${row.color};margin-right:7px;flex:none"></span>` : '';
      const tone = row.changeTone === 'pos' ? p.pos : row.changeTone === 'neg' ? p.neg : p.muted;
      const arrow = row.changeTone === 'pos' ? tri(tone, true) : row.changeTone === 'neg' ? tri(tone, false) : '';
      const ch = row.change ? `<span style="color:${tone};font-size:11px;margin-left:8px;white-space:nowrap">${arrow}${esc(row.change)}</span>` : '';
      return `<div style="display:flex;align-items:center;justify-content:space-between;gap:14px;padding:2px 0">
        <span style="display:flex;align-items:center;color:${p.ink2};min-width:0">${dot}<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(row.label)}</span></span>
        <span class="num" style="font-weight:${row.bold ? 600 : 500};color:${p.ink};white-space:nowrap">${esc(row.value)}${ch}</span></div>`;
    })
    .join('');
  return `<div style="padding:10px 12px;min-width:180px">
    <div style="font-weight:600;color:${p.ink};font-size:12.5px;margin-bottom:${subtitle ? 1 : 6}px">${esc(title)}</div>
    ${subtitle ? `<div style="color:${p.muted};font-size:11px;margin-bottom:6px">${esc(subtitle)}</div>` : ''}
    ${r}
    ${source ? `<div style="border-top:1px solid ${p.line};margin-top:8px;padding-top:6px;color:${p.faint};font-size:10.5px">${esc(source)}</div>` : ''}
  </div>`;
}

export const tone = (v: number | null | undefined, direction: 'higher' | 'lower' | 'neutral' = 'higher'): 'pos' | 'neg' | 'neutral' => {
  if (v === null || v === undefined || v === 0 || direction === 'neutral') return 'neutral';
  const good = direction === 'higher' ? v > 0 : v < 0;
  return good ? 'pos' : 'neg';
};

/** Nice axis bounds that clip outliers: returns [min, max] covering ~95% of values with headroom. */
export function clippedRange(values: number[], { includeZero = true, q = 0.9, pad = 1.25 } = {}): { min: number; max: number; clipped: boolean } {
  const xs = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!xs.length) return { min: 0, max: 1, clipped: false };
  const pick = (f: number) => xs[Math.min(xs.length - 1, Math.max(0, Math.round(f * (xs.length - 1))))];
  let lo = xs[0], hi = xs[xs.length - 1];
  const qlo = pick(1 - q), qhi = pick(q);
  const spread = Math.max(Math.abs(qhi - qlo), 1e-9);
  let clipped = false;
  if (hi > qhi + spread * 1.5) { hi = qhi + spread * 0.6; clipped = true; }
  if (lo < qlo - spread * 1.5) { lo = qlo - spread * 0.6; clipped = true; }
  if (includeZero) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
  const span = hi - lo || 1;
  return { min: lo < 0 ? lo - span * (pad - 1) * 0.5 : lo, max: hi + span * (pad - 1) * 0.5, clipped };
}
