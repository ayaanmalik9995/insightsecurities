import type { EChartsOption } from './echarts';
import type { Palette } from '../../lib/theme';
import type { Unit } from '../../lib/types';
import { fmt, fmtChange } from '../../lib/format';
import { periodAxis, periodLabel } from '../../lib/periods';
import { axisCommon, categoryAxisCommon, tipHTML, tone, tooltipBase, type TipRow } from './style';

const MONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayLabelMs = (ms: number) => {
  const d = new Date(ms);
  return `${d.getUTCDate()} ${MONS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};
const pkrAxis = (v: number) => fmt(v, 'pkr_mn', { compact: true });

/** Daily price line (adjusted closes). LTTB downsampling keeps long ranges smooth; optional log scale. */
export function priceChart(p: Palette, o: { points: [number, number][]; ticker: string; up: boolean; log?: boolean; source: string }): EChartsOption {
  const color = o.up ? p.pos : p.neg;
  const first = o.points[0]?.[1] ?? null;
  return {
    grid: { left: 8, right: 8, top: 12, bottom: 4, containLabel: true },
    xAxis: { type: 'time', minInterval: 86400000, ...categoryAxisCommon(p), splitLine: { show: false } },
    yAxis: {
      type: o.log ? 'log' : 'value',
      scale: true,
      ...axisCommon(p),
      axisLabel: { ...axisCommon(p).axisLabel, formatter: (v: number) => fmt(v, 'rs', { currency: false, digits: v >= 100 ? 0 : 1 }) },
      position: 'right',
      splitNumber: 4,
    },
    tooltip: {
      ...tooltipBase(p),
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
        lineStyle: { color: p.lineStrong },
        crossStyle: { color: p.lineStrong },
        label: {
          backgroundColor: p.ink, color: p.surface, fontFamily: p.font, fontSize: 11,
          formatter: (x: { axisDimension: string; value: number }) => (x.axisDimension === 'x' ? dayLabelMs(x.value) : fmt(x.value, 'rs', { currency: false })),
        },
      },
      formatter: (params: unknown) => {
        const [ms, v] = (params as { value: [number, number] }[])[0].value;
        const ch = first ? v / first - 1 : null;
        return tipHTML(p, `${o.ticker} · ${dayLabelMs(ms)}`, 'Adjusted closing price', [
          { label: 'Close', value: fmt(v, 'rs'), bold: true },
          { label: 'Change over range', value: fmtChange(ch, 'pct'), changeTone: tone(ch) },
        ], o.source);
      },
    },
    series: [{
      type: 'line',
      data: o.points.map(([d, v]) => [d * 86400000, v]),
      showSymbol: false,
      sampling: 'lttb',
      smooth: false,
      lineStyle: { width: 1.6, color },
      itemStyle: { color },
      areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: `${color}29` }, { offset: 1, color: `${color}00` }] } },
      markLine: first ? { silent: true, symbol: 'none', lineStyle: { color: p.lineStrong, type: 'dashed', width: 1 }, label: { show: false }, data: [{ yAxis: first }] } : undefined,
    }],
  };
}

/** Rebased prices (start of range = 100) for head-to-head, with end labels instead of a legend. */
export function rebasedPrices(p: Palette, o: { series: { ticker: string; color: string; points: [number, number][] }[]; source: string; narrow?: boolean }): EChartsOption {
  return {
    grid: { left: 8, right: o.narrow ? 12 : 118, top: 12, bottom: 4, containLabel: true },
    xAxis: { type: 'time', ...categoryAxisCommon(p), splitLine: { show: false } },
    yAxis: { type: 'value', scale: true, ...axisCommon(p), axisLabel: { ...axisCommon(p).axisLabel, formatter: (v: number) => String(Math.round(v)) }, splitNumber: 4 },
    tooltip: {
      ...tooltipBase(p),
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: p.lineStrong } },
      formatter: (params: unknown) => {
        const ps = params as { seriesIndex: number; value: [number, number] }[];
        const ms = ps[0].value[0];
        const rows: TipRow[] = ps.map((x) => ({ label: o.series[x.seriesIndex].ticker, color: o.series[x.seriesIndex].color, value: x.value[1].toFixed(1), change: fmtChange(x.value[1] / 100 - 1, 'pct'), changeTone: tone(x.value[1] - 100) }));
        return tipHTML(p, dayLabelMs(ms), 'Rebased: start of range = 100', rows, o.source);
      },
    },
    series: o.series.map((s) => {
      const base = s.points[0]?.[1] || 1;
      const data = s.points.map(([d, v]) => [d * 86400000, (v / base) * 100]);
      const last = data.at(-1)?.[1] ?? 100;
      return {
        type: 'line' as const,
        name: s.ticker,
        data,
        showSymbol: false,
        sampling: 'lttb' as const,
        lineStyle: { width: 1.8, color: s.color },
        itemStyle: { color: s.color },
        emphasis: { focus: 'series' as const },
        endLabel: o.narrow ? undefined : { show: true, formatter: `${s.ticker} ${fmtChange(last / 100 - 1, 'pct')}`, color: s.color, fontSize: 11, fontWeight: 600, fontFamily: p.font },
        labelLayout: { moveOverlap: 'shiftY' as const },
        markLine: { silent: true, symbol: 'none', lineStyle: { color: p.lineStrong, type: 'dashed' as const, width: 1 }, label: { show: false }, data: [{ yAxis: 100 }] },
      };
    }),
  };
}

/** Cash up, debt down, net cash as a line: balance-sheet strength at a glance. */
export function mirroredBalance(p: Palette, o: { periods: string[]; up: { name: string; values: (number | null)[] }[]; down: { name: string; values: (number | null)[] }[]; net: (number | null)[]; netName: string; source: string }): EChartsOption {
  const upColors = [p.data, p.data2];
  const downColors = [p.neg, `${p.neg}b3`, `${p.neg}66`];
  const all = [
    ...o.up.map((s, i) => ({ s, sign: 1, color: upColors[i] ?? p.data2 })),
    ...o.down.map((s, i) => ({ s, sign: -1, color: downColors[i] ?? p.neg })),
  ];
  return {
    grid: { left: 8, right: 12, top: 36, bottom: 4, containLabel: true },
    legend: { show: true, top: 0, left: 0, icon: 'roundRect', itemWidth: 10, itemHeight: 10, itemGap: 14, textStyle: { color: p.muted, fontSize: 11, fontFamily: p.font } },
    xAxis: { type: 'category', data: o.periods.map(periodAxis), ...categoryAxisCommon(p) },
    yAxis: { type: 'value', ...axisCommon(p), axisLabel: { ...axisCommon(p).axisLabel, formatter: pkrAxis }, splitNumber: 4 },
    tooltip: {
      ...tooltipBase(p),
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: p.theme === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(16,26,21,0.04)' } },
      formatter: (params: unknown) => {
        const i = (params as { dataIndex: number }[])[0].dataIndex;
        const rows: TipRow[] = [
          ...all.map(({ s, color }) => ({ label: s.name, value: fmt(s.values[i], 'pkr_mn', { currency: true }), color })),
          { label: o.netName, value: fmt(o.net[i], 'pkr_mn', { currency: true }), bold: true, color: p.ink },
        ];
        return tipHTML(p, periodLabel(o.periods[i]), (o.net[i] ?? 0) >= 0 ? 'Net cash position' : 'Net debt position', rows, o.source);
      },
    },
    series: [
      ...all.map(({ s, sign, color }) => ({
        type: 'bar' as const,
        name: s.name,
        stack: sign > 0 ? 'up' : 'down',
        data: s.values.map((v) => (v === null ? null : sign * Math.abs(v))),
        itemStyle: { color },
        barMaxWidth: 18,
        emphasis: { focus: 'series' as const },
      })),
      { type: 'line' as const, name: o.netName, data: o.net, symbol: 'circle', symbolSize: 5, lineStyle: { color: p.ink, width: 1.8 }, itemStyle: { color: p.ink }, z: 5 },
    ],
  };
}

/** Dot plot: one row per metric, one dot per company. Each row is scaled to the companies shown so units can share the axis. */
export function dotPlot(p: Palette, o: { metrics: { id: string; label: string; unit: Unit }[]; companies: { ticker: string; color: string; values: Record<string, number | null> }[]; periodText: string; source: string }): EChartsOption {
  const norm = (id: string, v: number | null) => {
    const xs = o.companies.map((c) => c.values[id]).filter((x): x is number => x !== null);
    if (v === null || !xs.length) return null;
    const lo = Math.min(...xs), hi = Math.max(...xs);
    return hi === lo ? 0.5 : (v - lo) / (hi - lo);
  };
  const rows = [...o.metrics].reverse();
  return {
    grid: { left: 8, right: 28, top: 20, bottom: 8, containLabel: true },
    xAxis: { type: 'value', min: -0.08, max: 1.08, show: false },
    yAxis: {
      type: 'category', data: rows.map((m) => m.label), ...categoryAxisCommon(p),
      axisLine: { show: false }, splitLine: { show: true, lineStyle: { color: p.grid } },
      axisLabel: { color: p.ink2, fontSize: 12, fontFamily: p.font, fontWeight: 500 },
    },
    tooltip: {
      ...tooltipBase(p),
      trigger: 'item',
      formatter: (params: unknown) => {
        const { seriesIndex, dataIndex } = params as { seriesIndex: number; dataIndex: number };
        const metric = rows[dataIndex];
        return tipHTML(p, metric.label, o.periodText, o.companies.map((c, i) => ({ label: c.ticker, value: fmt(c.values[metric.id], metric.unit), color: c.color, bold: i === seriesIndex })), o.source);
      },
    },
    series: o.companies.map((c, ci) => ({
      type: 'scatter' as const,
      name: c.ticker,
      symbolSize: 14,
      itemStyle: { color: c.color, borderColor: p.surface, borderWidth: 2 },
      label: { show: true, position: (ci % 2 ? 'bottom' : 'top') as 'top' | 'bottom', formatter: (x: unknown) => (x as { data: { label: string } }).data.label, color: c.color, fontSize: 10.5, fontWeight: 600, fontFamily: p.font, distance: 5 },
      labelLayout: { hideOverlap: true },
      data: rows.map((m, row) => {
        const v = c.values[m.id];
        const n = norm(m.id, v);
        return n === null ? { value: [null, row], label: '' } : { value: [n, row], label: fmt(v, m.unit) };
      }),
    })),
  };
}
