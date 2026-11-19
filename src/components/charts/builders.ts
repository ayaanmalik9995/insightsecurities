import type { EChartsOption } from './echarts';
import type { Palette } from '../../lib/theme';
import type { Status, Unit } from '../../lib/types';
import { fmt, fmtChange, STATUS_HELP, STATUS_TEXT } from '../../lib/format';
import { periodAxis, periodLabel } from '../../lib/periods';
import { axisCommon, categoryAxisCommon, clippedRange, tipHTML, tone, tooltipBase, type TipRow } from './style';

const axisFmt = (unit: Unit) => (v: number) => {
  if (unit === 'pkr_mn') return Math.abs(v) < 10 && v !== 0 ? `${fmt(v, 'number', { digits: 1 })} mn` : fmt(v, unit, { compact: true });
  if (unit === 'pct') return fmt(v, unit, { digits: 0 });
  if (unit === 'x') return fmt(v, unit, { digits: 0 });
  return fmt(v, unit, { digits: 0, currency: false });
};

export interface TimePoint {
  p: string;
  v: number | null;
  s?: Status;
  /** Change vs a year earlier, shown in the tooltip. */
  yoy?: number | null;
  yoyKind?: 'pct' | 'pp';
  /** Extra context rows for the tooltip. */
  extra?: TipRow[];
  subtitle?: string;
}

/** Columns over time: flows (revenue, profit). Bars start at zero; losses fall below it in the negative colour. */
export function columnsOverTime(p: Palette, o: { name: string; unit: Unit; points: TimePoint[]; source: string; compactNarrow?: boolean; highlightLast?: boolean }): EChartsOption {
  const data = o.points.map((pt, i) => ({
    value: pt.v,
    itemStyle: {
      color: pt.v !== null && pt.v < 0 ? p.neg : o.highlightLast && i === o.points.length - 1 ? p.brand : p.data,
      borderRadius: pt.v !== null && pt.v < 0 ? [0, 0, 2, 2] : [2, 2, 0, 0],
    },
  }));
  return {
    grid: { left: 8, right: 8, top: 16, bottom: 4, containLabel: true },
    xAxis: { type: 'category', data: o.points.map((pt) => periodAxis(pt.p)), ...categoryAxisCommon(p), axisLabel: { ...categoryAxisCommon(p).axisLabel, interval: 'auto' } },
    yAxis: { type: 'value', ...axisCommon(p), axisLabel: { ...axisCommon(p).axisLabel, formatter: axisFmt(o.unit) }, splitNumber: 4 },
    tooltip: {
      ...tooltipBase(p),
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: p.theme === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(16,26,21,0.04)' } },
      formatter: (params: unknown) => {
        const i = (params as { dataIndex: number }[])[0].dataIndex;
        const pt = o.points[i];
        const rows: TipRow[] = [{ label: o.name, value: pt.v === null ? (pt.s ? STATUS_TEXT[pt.s] : '—') : fmt(pt.v, o.unit, { currency: o.unit === 'pkr_mn', compact: false }), bold: true }];
        if (pt.yoy !== undefined) rows.push({ label: 'vs a year earlier', value: fmtChange(pt.yoy, pt.yoyKind ?? 'pct'), changeTone: tone(pt.yoy) });
        if (pt.extra) rows.push(...pt.extra);
        return tipHTML(p, periodLabel(pt.p), pt.subtitle ?? null, rows, o.source);
      },
    },
    series: [{ type: 'bar', name: o.name, data, barMaxWidth: 22, barCategoryGap: '28%', universalTransition: true }],
  };
}

export interface LineSeries {
  name: string;
  color: string;
  points: TimePoint[];
  dashed?: boolean;
  width?: number;
  /** Faint context line (e.g. sector median). */
  ghost?: boolean;
}

/** Lines over time with end labels instead of a legend. Gaps stay gaps. */
export function linesOverTime(p: Palette, o: { unit: Unit; periods: string[]; series: LineSeries[]; source: string; endLabels?: boolean; zeroLine?: boolean; yMin?: number; yMax?: number; narrow?: boolean }): EChartsOption {
  const idx = new Map(o.periods.map((pp, i) => [pp, i]));
  return {
    grid: { left: 8, right: o.endLabels && !o.narrow ? 118 : 12, top: 16, bottom: 4, containLabel: true },
    xAxis: { type: 'category', data: o.periods.map(periodAxis), boundaryGap: false, ...categoryAxisCommon(p) },
    yAxis: { type: 'value', ...axisCommon(p), min: o.yMin, max: o.yMax, axisLabel: { ...axisCommon(p).axisLabel, formatter: axisFmt(o.unit) }, splitNumber: 4, scale: o.yMin === undefined },
    tooltip: {
      ...tooltipBase(p),
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: p.lineStrong, width: 1 } },
      formatter: (params: unknown) => {
        const i = (params as { dataIndex: number }[])[0].dataIndex;
        const period = o.periods[i];
        const rows: TipRow[] = o.series.map((s) => {
          const pt = s.points.find((x) => x.p === period);
          return {
            label: s.name,
            color: s.color,
            value: !pt ? '—' : pt.v === null ? (pt.s ? STATUS_TEXT[pt.s] : '—') : fmt(pt.v, o.unit),
            change: pt?.yoy !== undefined && pt?.yoy !== null ? fmtChange(pt.yoy, pt.yoyKind ?? 'pct') : null,
            changeTone: tone(pt?.yoy ?? null),
          };
        });
        return tipHTML(p, periodLabel(period), null, rows, o.source);
      },
    },
    series: o.series.map((s) => {
      const data: (number | null)[] = o.periods.map(() => null);
      for (const pt of s.points) { const i = idx.get(pt.p); if (i !== undefined) data[i] = pt.v; }
      let last = data.length - 1;
      while (last >= 0 && data[last] === null) last--;
      return {
        type: 'line' as const,
        name: s.name,
        data,
        connectNulls: false,
        showSymbol: false,
        symbolSize: 6,
        smooth: false,
        lineStyle: { color: s.color, width: s.width ?? (s.ghost ? 1.5 : 2), type: s.dashed ? ('dashed' as const) : ('solid' as const), opacity: s.ghost ? 0.8 : 1 },
        itemStyle: { color: s.color },
        emphasis: { focus: 'series' as const, lineStyle: { width: (s.width ?? 2) + 0.5 } },
        endLabel: o.endLabels && !o.narrow ? {
          show: true,
          formatter: () => `${s.name}\n${last >= 0 ? fmt(data[last], o.unit) : ''}`,
          color: s.ghost ? p.muted : s.color,
          fontSize: 11,
          fontWeight: 600,
          lineHeight: 14,
          distance: 8,
        } : undefined,
        labelLayout: { moveOverlap: 'shiftY' as const },
        markLine: o.zeroLine ? { silent: true, symbol: 'none', label: { show: false }, lineStyle: { color: p.lineStrong, width: 1, type: 'solid' as const }, data: [{ yAxis: 0 }] } : undefined,
        universalTransition: true,
      };
    }),
  };
}

export interface RankRow {
  ticker: string;
  name: string;
  v: number | null;
  s: Status;
}

/** Ranked horizontal bars. Negative values go left in the negative colour; the selected company is amber. */
export function rankedBars(p: Palette, o: { rows: RankRow[]; unit: Unit; direction: 'higher' | 'lower' | 'neutral'; median?: number | null; highlight?: string | null; source: string; periodText: string; metricName: string; limit?: number }): EChartsOption {
  const ok = o.rows.filter((r) => r.v !== null).sort((a, b) => (o.direction === 'lower' ? a.v! - b.v! : b.v! - a.v!));
  const shown = o.limit ? ok.slice(0, o.limit) : ok;
  const ordered = [...shown].reverse(); // ECharts draws category axis bottom-up
  const range = clippedRange(ok.map((r) => r.v!), { includeZero: true, q: 0.92, pad: 1.12 });
  return {
    grid: { left: 4, right: 52, top: 6, bottom: 4, containLabel: true },
    xAxis: { type: 'value', ...axisCommon(p), min: range.min, max: range.max, axisLabel: { ...axisCommon(p).axisLabel, formatter: axisFmt(o.unit) }, splitNumber: 3 },
    yAxis: {
      type: 'category',
      data: ordered.map((r) => r.ticker),
      ...categoryAxisCommon(p),
      axisLine: { show: false },
      axisLabel: {
        color: p.ink2,
        fontSize: 11.5,
        fontWeight: 500,
        fontFamily: p.font,
        formatter: (t: string) => (t === o.highlight ? `{hl|${t}}` : t),
        rich: { hl: { color: p.accentInk, fontWeight: 700, fontSize: 11.5 } },
      },
    },
    tooltip: {
      ...tooltipBase(p),
      trigger: 'item',
      formatter: (params: unknown) => {
        const r = ordered[(params as { dataIndex: number }).dataIndex];
        const rank = ok.findIndex((x) => x.ticker === r.ticker) + 1;
        const rows: TipRow[] = [
          { label: o.metricName, value: fmt(r.v, o.unit), bold: true },
          { label: 'Rank in sector', value: `${rank} of ${ok.length}` },
        ];
        if (o.median !== undefined && o.median !== null) rows.push({ label: 'Sector median', value: fmt(o.median, o.unit) });
        return tipHTML(p, `${r.ticker} · ${r.name}`, o.periodText, rows, o.source);
      },
    },
    series: [{
      type: 'bar',
      data: ordered.map((r) => {
        const clippedHi = r.v! > range.max, clippedLo = r.v! < range.min;
        return {
          value: Math.max(range.min, Math.min(range.max, r.v!)),
          itemStyle: {
            color: r.ticker === o.highlight ? p.accent : r.v! < 0 ? p.neg : p.data,
            borderRadius: r.v! < 0 ? [2, 0, 0, 2] : [0, 2, 2, 0],
            decal: clippedHi || clippedLo ? { symbol: 'rect', dashArrayX: [1, 0], dashArrayY: [2, 3], rotation: -Math.PI / 4, color: 'rgba(255,255,255,0.35)' } : undefined,
          },
          label: {
            show: true,
            position: 'right' as const,
            formatter: () => `${fmt(r.v, o.unit)}`,
            color: r.ticker === o.highlight ? p.accentInk : p.ink2,
            fontSize: 11,
            fontWeight: 600,
            fontFamily: p.font,
          },
        };
      }),
      barMaxWidth: 14,
      barCategoryGap: '34%',
      cursor: 'pointer',
      markLine: o.median !== undefined && o.median !== null ? {
        silent: true,
        symbol: 'none',
        lineStyle: { color: p.muted, type: 'dashed', width: 1 },
        label: { show: true, position: 'end', formatter: 'median', color: p.muted, fontSize: 10, fontFamily: p.font },
        data: [{ xAxis: Math.max(range.min, Math.min(range.max, o.median)) }],
      } : undefined,
      universalTransition: true,
    }],
  };
}

/** Tiny trend line for KPI cards: no axes, last point marked. */
export function sparkline(_p: Palette, values: (number | null)[], color: string): EChartsOption {
  const last = values.length - 1;
  return {
    animationDuration: 700,
    grid: { left: 2, right: 4, top: 4, bottom: 4 },
    xAxis: { type: 'category', show: false, boundaryGap: false, data: values.map((_, i) => i) },
    yAxis: { type: 'value', show: false, scale: true },
    tooltip: { show: false },
    series: [{
      type: 'line',
      data: values.map((v, i) => (i === last ? { value: v, symbol: 'circle', symbolSize: 5, itemStyle: { color } } : v)),
      showSymbol: false,
      smooth: false,
      lineStyle: { width: 1.5, color },
      areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: `${color}33` }, { offset: 1, color: `${color}00` }] } },
      silent: true,
    }],
  };
}

export const statusNote = (s: Status) => STATUS_HELP[s];

export interface BubbleRow {
  ticker: string;
  name: string;
  x: number;
  y: number;
  size: number | null;
}

/**
 * Valuation map: x = quality (e.g. ROE), y = price (e.g. P/E), bubble = market cap.
 * Dashed lines at the sector medians split it into four quadrants; the
 * "cheap and strong" corner (low y, high x) is tinted. Off-scale points are
 * pinned to the edge with an arrow so outliers never flatten everyone else.
 */
export function valuationBubbles(p: Palette, o: {
  rows: BubbleRow[]; xUnit: Unit; yUnit: Unit; sizeUnit: Unit; xName: string; yName: string; sizeName: string;
  periodText: string; source: string; highlight?: string | null; narrow?: boolean;
}): EChartsOption {
  const xs = o.rows.map((r) => r.x), ys = o.rows.map((r) => r.y);
  const mx = medianOf(xs), my = medianOf(ys);
  const yr0 = clippedRange(ys, { includeZero: true, q: 0.85, pad: 1.18 });
  const yr = { ...yr0, max: niceCeil(yr0.max) };
  const xr = clippedRange(xs, { includeZero: false, q: 0.95, pad: 1.2 });
  const xMin = Math.min(xr.min, 0), xMax = niceCeil(xr.max);
  const sizes = o.rows.map((r) => r.size ?? 0);
  const sMax = Math.max(...sizes, 1);
  const radius = (s: number | null) => 10 + Math.sqrt(Math.max(0, s ?? 0) / sMax) * (o.narrow ? 30 : 44);
  const quadrant = (r: BubbleRow) => (r.y <= my ? (r.x >= mx ? 'Cheap and strong' : 'Cheap and weak') : r.x >= mx ? 'Expensive and strong' : 'Expensive and weak');
  const corner = (text: string, left: string | number, top: string | number, align: 'left' | 'right', tint: string) => ({
    type: 'text' as const, left, top, z: 0, silent: true,
    style: { text, fill: tint, font: `600 11px ${p.font}`, align },
  });
  return {
    grid: { left: 12, right: 24, top: 28, bottom: 28, containLabel: true },
    xAxis: {
      type: 'value', name: o.xName, nameLocation: 'middle', nameGap: 28, min: xMin, max: xMax,
      ...axisCommon(p), axisLabel: { ...axisCommon(p).axisLabel, formatter: axisFmt(o.xUnit) },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value', name: o.yName, nameLocation: 'middle', nameGap: 40, min: 0, max: yr.max,
      ...axisCommon(p), axisLabel: { ...axisCommon(p).axisLabel, formatter: axisFmt(o.yUnit) },
    },
    graphic: o.narrow ? [] : [
      corner('Expensive and weak', 70, 52, 'left', p.faint),
      corner('Expensive and strong', '86%', 52, 'right', p.faint),
      corner('Cheap and weak', 70, '84%', 'left', p.faint),
      corner('Cheap and strong', '86%', '84%', 'right', p.brandInk),
    ],
    tooltip: {
      ...tooltipBase(p),
      trigger: 'item',
      formatter: (params: unknown) => {
        const r = o.rows[(params as { dataIndex: number }).dataIndex];
        const off = r.y > yr.max;
        return tipHTML(p, `${r.ticker} · ${r.name}`, `${o.periodText} · ${quadrant(r)}`, [
          { label: o.yName, value: `${fmt(r.y, o.yUnit)}${off ? ' (off scale)' : ''}`, bold: true },
          { label: o.xName, value: fmt(r.x, o.xUnit), bold: true },
          { label: o.sizeName, value: fmt(r.size, o.sizeUnit, { compact: true, currency: true }) },
          { label: 'Sector medians', value: `${fmt(my, o.yUnit)} · ${fmt(mx, o.xUnit)}` },
        ], o.source);
      },
    },
    series: [{
      type: 'scatter',
      cursor: 'pointer',
      data: o.rows.map((r) => {
        const off = r.y > yr.max;
        const strong = quadrant(r) === 'Cheap and strong';
        const hl = r.ticker === o.highlight;
        const color = hl ? p.accent : strong ? p.brand : p.data;
        return {
          name: r.ticker,
          value: [Math.min(Math.max(r.x, xMin), xMax), off ? yr.max * 0.985 : r.y],
          symbol: off ? 'triangle' : 'circle',
          symbolSize: off ? 14 : radius(r.size),
          itemStyle: { color, opacity: off ? 0.9 : hl ? 0.95 : 0.62, borderColor: p.surface, borderWidth: 1.5 },
          label: {
            show: true,
            formatter: off ? `${r.ticker} ${fmt(r.y, o.yUnit)}, off scale` : r.ticker,
            position: off ? ('right' as const) : ('top' as const),
            color: hl ? p.accentInk : strong ? p.brandInk : p.ink2,
            fontSize: 11, fontWeight: 600, fontFamily: p.font, distance: 4,
          },
          emphasis: { scale: 1.08, itemStyle: { opacity: 0.95 } },
        };
      }),
      labelLayout: { hideOverlap: false, moveOverlap: 'shiftY' },
      markLine: {
        silent: true, symbol: 'none',
        lineStyle: { color: p.lineStrong, type: 'dashed', width: 1 },
        label: { show: true, color: p.muted, fontSize: 10, fontFamily: p.font },
        data: [
          { xAxis: mx, label: { formatter: `median ${fmt(mx, o.xUnit)}`, position: 'end' } },
          { yAxis: my, label: { formatter: `median ${fmt(my, o.yUnit)}`, position: 'insideEndTop' } },
        ],
      },
      markArea: {
        silent: true,
        itemStyle: { color: p.brandSoft, opacity: p.theme === 'dark' ? 0.6 : 0.8 },
        data: [[{ xAxis: mx, yAxis: 0 }, { xAxis: xMax, yAxis: my }]],
      },
      universalTransition: true,
    }],
  };
}

/** Round an axis maximum up to a readable step (5, 10, 25, 50…). */
export function niceCeil(v: number) {
  if (v <= 0) return v;
  const mag = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * mag >= v) return m * mag;
  return 10 * mag;
}

function medianOf(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  if (!s.length) return 0;
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
