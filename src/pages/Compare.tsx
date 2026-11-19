import { Suspense, use, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Plus, X } from 'lucide-react';
import { useSector } from '../lib/sector-context';
import { useTheme } from '../lib/theme';
import { loadPrices } from '../lib/data';
import { fmt, fmtCell, fmtDate, UNIT_LABEL } from '../lib/format';
import { periodLabel } from '../lib/periods';
import { track } from '../lib/analytics';
import { EChart } from '../components/charts/EChart';
import { linesOverTime } from '../components/charts/builders';
import { dotPlot, rebasedPrices } from '../components/charts/builders-company';
import { axisCommon, categoryAxisCommon, tipHTML, tooltipBase } from '../components/charts/style';
import { Segmented, Skeleton } from '../components/ui/controls';
import { Disclaimer, PageIntro, Panel, SectionHeading } from '../components/ui/Panel';
import type { EChartsOption } from '../components/charts/echarts';
import { Boundary, Unavailable } from '../components/ui/Boundary';
import { useNarrow } from '../lib/useNarrow';

const MAX = 4;

export default function Compare() {
  const { bundle, slug } = useSector();
  const { palette } = useTheme();
  const narrow = useNarrow();
  const [params, setParams] = useSearchParams();
  const m = bundle.meta;
  const h2h = m.config.headToHead!;
  const all = bundle.companies.map((c) => c.ticker);

  // Default: the three largest companies by latest market cap.
  const defaults = useMemo(() => {
    const q = bundle.latestCovered('Q', ['market_cap']) ?? m.quarters.at(-1)!;
    return bundle.cross(q, 'market_cap').filter((r) => r.v !== null).sort((a, b) => b.v! - a.v!).slice(0, 3).map((r) => r.ticker);
  }, [bundle, m.quarters]);
  const fromUrl = (params.get('t') ?? '').split(',').map((t) => t.trim().toUpperCase()).filter((t) => all.includes(t));
  const picked = [...new Set(fromUrl.length ? fromUrl : defaults)].slice(0, MAX);
  const colors = palette.series;

  const setPicked = (next: string[]) => {
    const n = new URLSearchParams(params);
    n.set('t', next.join(','));
    setParams(n, { replace: true });
    track('insights_compare', { sector: slug, tickers: next.join(',') });
  };
  useEffect(() => { document.title = `Compare ${picked.join(' vs ')} | Insight Securities Insights`; }, [picked.join()]);

  const [adding, setAdding] = useState(false);
  const comps = picked.map((t, i) => ({ ticker: t, color: colors[i], co: bundle.companyByTicker.get(t)! }));
  const src = `Financials to ${fmtDate(m.asOf.financials)}`;

  // Annual flows: grouped columns over the last 5 complete fiscal years.
  const years = [...new Set(picked.flatMap((t) => bundle.periodsFor(t, 'FY').filter((y) => bundle.cell(t, y, 'net_sales').s === 'ok')))].sort().slice(-5);
  const groupedFlow = (metric: string): EChartsOption => ({
    grid: { left: 8, right: 8, top: 16, bottom: 4, containLabel: true },
    xAxis: { type: 'category', data: years, ...categoryAxisCommon(palette) },
    yAxis: { type: 'value', ...axisCommon(palette), axisLabel: { ...axisCommon(palette).axisLabel, formatter: (v: number) => fmt(v, 'pkr_mn', { compact: true }) }, splitNumber: 4 },
    tooltip: {
      ...tooltipBase(palette), trigger: 'axis', axisPointer: { type: 'shadow' },
      formatter: (ps: unknown) => {
        const i = (ps as { dataIndex: number }[])[0].dataIndex;
        return tipHTML(palette, years[i], `${bundle.metric(metric).label} · each company's own fiscal year`, comps.map((c) => ({ label: c.ticker, color: c.color, value: fmt(bundle.value(c.ticker, years[i], metric), 'pkr_mn', { currency: true }) })), src);
      },
    },
    series: comps.map((c) => ({
      type: 'bar' as const, name: c.ticker, barMaxWidth: 16,
      data: years.map((y) => { const v = bundle.value(c.ticker, y, metric); return v === null ? null : { value: v, itemStyle: { color: v < 0 ? palette.neg : c.color, borderRadius: v < 0 ? [0, 0, 2, 2] : [2, 2, 0, 0] } }; }),
      itemStyle: { color: c.color },
    })),
  });

  const lineMetrics = h2h.lines.filter((x) => bundle.has(x));
  const dotMetrics = h2h.dots.filter((x) => bundle.has(x)).map((id) => ({ id, label: bundle.metric(id).label, unit: bundle.metric(id).unit }));
  const dotPeriod = bundle.latestCovered('Q', h2h.dots.filter((x) => bundle.has(x))) ?? m.quarters.at(-1)!;
  const latestFY = years.at(-1);
  const revWinner = latestFY ? [...comps].sort((a, b) => (bundle.value(b.ticker, latestFY, 'net_sales') ?? -1) - (bundle.value(a.ticker, latestFY, 'net_sales') ?? -1))[0] : null;
  const roeId = dotMetrics.find((d) => d.id.startsWith('roe'))?.id;
  const roeWinner = roeId ? [...comps].sort((a, b) => (bundle.value(b.ticker, dotPeriod, roeId) ?? -9) - (bundle.value(a.ticker, dotPeriod, roeId) ?? -9))[0] : null;
  const peId = dotMetrics.find((d) => d.id.startsWith('pe'))?.id;
  const cheapest = peId ? [...comps].filter((c) => (bundle.value(c.ticker, dotPeriod, peId) ?? 0) > 0).sort((a, b) => bundle.value(a.ticker, dotPeriod, peId)! - bundle.value(b.ticker, dotPeriod, peId)!)[0] : null;

  return (
    <div>
      <PageIntro
        title="Head-to-head"
        lead={picked.length >= 2 && roeWinner && cheapest
          ? <>{roeWinner.ticker} earns the highest return on equity of the {picked.length}; {cheapest.ticker} is the cheapest on {bundle.metric(peId!).label.replace(' (TTM)', '')}{cheapest.ticker === roeWinner.ticker ? ', so it leads on both' : ''}.</>
          : 'Pick two to four companies to compare them on the same charts.'}
        meta={<><span>{periodLabel(dotPeriod)} for ratios</span><span>Fiscal years are each company’s own</span></>}
      />
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        {/* picker */}
        <div className="mt-8 flex flex-wrap items-center gap-2" role="group" aria-label="Companies being compared">
          {comps.map((c) => (
            <span key={c.ticker} className="inline-flex h-9 items-center gap-2 rounded-full border border-line bg-surface pl-3 pr-1 text-[13px] font-semibold text-ink">
              <span aria-hidden className="size-2.5 rounded-full" style={{ background: c.color }} />
              <Link to={`/${slug}/company/${c.ticker}`} className="hover:underline">{c.ticker}</Link>
              <button type="button" aria-label={`Remove ${c.ticker}`} disabled={picked.length <= 1} onClick={() => setPicked(picked.filter((t) => t !== c.ticker))} className="grid size-7 place-items-center rounded-full text-muted transition-colors hover:bg-surface-3 hover:text-ink disabled:opacity-30">
                <X aria-hidden className="size-3.5" />
              </button>
            </span>
          ))}
          {picked.length < MAX && (
            adding ? (
              <span className="inline-flex flex-wrap items-center gap-1.5 rounded-xl border border-dashed border-line-strong bg-surface-2 p-1.5">
                {all.filter((t) => !picked.includes(t)).map((t) => (
                  <button key={t} type="button" onClick={() => { setPicked([...picked, t]); setAdding(false); }} className="h-7 rounded-full bg-surface px-2.5 text-[12px] font-semibold text-ink-2 ring-1 ring-line transition-colors hover:text-ink hover:ring-line-strong">{t}</button>
                ))}
                <button type="button" onClick={() => setAdding(false)} className="h-7 px-2 text-[12px] text-muted hover:text-ink">Cancel</button>
              </span>
            ) : (
              <button type="button" onClick={() => setAdding(true)} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-dashed border-line-strong px-3.5 text-[13px] font-medium text-muted transition-colors hover:border-brand hover:text-brand-ink">
                <Plus aria-hidden className="size-4" /> Add company <span className="text-faint">({picked.length} of {MAX})</span>
              </button>
            )
          )}
        </div>

        <div className="mt-6">
          {comps.filter((c) => c.co.price && c.co.price.points > 1).length ? (
            <Boundary fallback={() => <Unavailable title="Price comparison could not be loaded" detail="The rest of this page is unaffected. Reload the page to try again." />}>
              <Suspense fallback={<div className="rounded-xl border border-line bg-surface p-6"><Skeleton className="h-5 w-1/2" /><Skeleton className="mt-6 h-[300px] w-full" /></div>}>
                <RebasedPanel comps={comps.filter((c) => c.co.price && c.co.price.points > 1)} missing={comps.filter((c) => !c.co.price || c.co.price.points <= 1).map((c) => c.ticker)} />
              </Suspense>
            </Boundary>
          ) : (
            <Unavailable title="No share prices for these companies" detail="Add a company with price history to compare share-price performance." />
          )}
        </div>

        <SectionHeading title="Results by fiscal year" lead={`Last ${years.length} complete fiscal years. June and December filers are shown on their own year-ends, labelled by the year in which the fiscal year ends.`} />
        <div className="grid gap-5 lg:grid-cols-2">
          {h2h.flows.filter((x) => bundle.has(x)).map((metric) => {
            const def = bundle.metric(metric);
            const lead = latestFY ? [...comps].sort((a, b) => (bundle.value(b.ticker, latestFY, metric) ?? -Infinity) - (bundle.value(a.ticker, latestFY, metric) ?? -Infinity))[0] : null;
            const title = lead && latestFY ? `${lead.ticker} has the largest ${def.label.toLowerCase()} in ${latestFY}: ${fmt(bundle.value(lead.ticker, latestFY, metric), 'pkr_mn', { compact: true, currency: true })}` : def.label;
            return (
              <Panel
                key={metric}
                title={metric === 'net_sales' && revWinner ? title : title}
                titleText={title}
                subtitle={`${def.label}, PKR, by fiscal year`}
                downloadName={`compare_${picked.join('_')}_${metric}`}
                chart={(ref) => <EChart ref={ref} option={groupedFlow(metric)} height={narrow ? 240 : 280} ariaLabel={title} />}
                table={{
                  rows: [...years].reverse(),
                  rowKey: (y) => y,
                  columns: [
                    { key: 'y', header: 'Fiscal year', align: 'left', sticky: true, render: (y) => y, exportValue: (y) => y, sortValue: (y) => y },
                    ...comps.map((c) => ({ key: c.ticker, header: c.ticker, sub: 'PKR mn', render: (y: string) => fmtCell(bundle.cell(c.ticker, y, metric), 'pkr_mn'), exportValue: (y: string) => bundle.value(c.ticker, y, metric), sortValue: (y: string) => bundle.value(c.ticker, y, metric) })),
                  ],
                }}
              />
            );
          })}
        </div>

        <SectionHeading title="Profitability and valuation over time" lead="One small chart per measure, companies as lines, so the shapes can be compared directly." />
        <div className="grid gap-5 md:grid-cols-2">
          {lineMetrics.map((metric) => {
            const def = bundle.metric(metric);
            const ys = [...new Set(picked.flatMap((t) => bundle.periodsFor(t, 'FY')))].sort().filter((y) => picked.some((t) => bundle.cell(t, y, metric).s === 'ok')).slice(-8);
            const title = `${def.label} by fiscal year`;
            return (
              <Panel
                key={metric}
                title={title}
                titleText={title}
                subtitle={`${def.label} · ${UNIT_LABEL[def.unit] || def.unit} · gaps are loss years (not meaningful) or missing data`}
                usesPrices={def.group === 'valuation'}
                downloadName={`compare_${picked.join('_')}_${metric}`}
                chart={(ref) => (
                  <EChart ref={ref} option={linesOverTime(palette, { unit: def.unit, periods: ys, series: comps.map((c) => ({ name: c.ticker, color: c.color, points: ys.map((y) => ({ p: y, ...bundle.cell(c.ticker, y, metric) })) })), source: src, endLabels: !narrow, yMin: def.unit === 'x' ? 0 : undefined })} height={narrow ? 220 : 250} ariaLabel={title} />
                )}
                table={{
                  rows: [...ys].reverse(),
                  rowKey: (y) => y,
                  columns: [
                    { key: 'y', header: 'Fiscal year', align: 'left', sticky: true, render: (y) => y, exportValue: (y) => y, sortValue: (y) => y },
                    ...comps.map((c) => ({ key: c.ticker, header: c.ticker, sub: UNIT_LABEL[def.unit], render: (y: string) => fmtCell(bundle.cell(c.ticker, y, metric), def.unit), exportValue: (y: string) => { const v = bundle.value(c.ticker, y, metric); return v === null ? null : def.unit === 'pct' ? +(v * 100).toFixed(2) : +v.toFixed(2); }, sortValue: (y: string) => bundle.value(c.ticker, y, metric) })),
                  ],
                }}
              />
            );
          })}
        </div>

        <SectionHeading title="Ratios side by side" lead={`Latest complete quarter (${periodLabel(dotPeriod)}). Each row is scaled to the companies shown, so read the labels for the actual values.`} />
        <Panel
          title={roeWinner ? `${roeWinner.ticker} leads on returns; ${cheapest?.ticker ?? '—'} is the cheapest` : 'Ratios side by side'}
          titleText="Ratios side by side"
          subtitle={`${periodLabel(dotPeriod)} · one dot per company, one row per ratio`}
          usesPrices
          downloadName={`compare_${picked.join('_')}_ratios_${dotPeriod}`}
          chart={(ref) => (
            <EChart ref={ref} option={dotPlot(palette, { metrics: dotMetrics, companies: comps.map((c) => ({ ticker: c.ticker, color: c.color, values: Object.fromEntries(dotMetrics.map((d) => [d.id, bundle.value(c.ticker, dotPeriod, d.id)])) })), periodText: periodLabel(dotPeriod), source: src })} height={dotMetrics.length * 54 + 40} ariaLabel="Ratios side by side" />
          )}
          table={{
            rows: dotMetrics,
            rowKey: (d) => d.id,
            columns: [
              { key: 'm', header: 'Ratio', align: 'left', sticky: true, render: (d) => d.label, exportValue: (d) => d.label },
              ...comps.map((c) => ({
                key: c.ticker, header: c.ticker,
                render: (d: (typeof dotMetrics)[number]) => {
                  const vals = comps.map((x) => bundle.value(x.ticker, dotPeriod, d.id)).filter((v): v is number => v !== null && (d.unit !== 'x' || v > 0));
                  const v = bundle.value(c.ticker, dotPeriod, d.id);
                  const dir = bundle.metric(d.id).direction;
                  const best = vals.length > 1 && v !== null && (dir === 'lower' ? v === Math.min(...vals) : dir === 'higher' ? v === Math.max(...vals) : false);
                  return <span className={best ? 'font-bold text-ink' : ''}>{fmtCell(bundle.cell(c.ticker, dotPeriod, d.id), d.unit)}</span>;
                },
                exportValue: (d: (typeof dotMetrics)[number]) => { const v = bundle.value(c.ticker, dotPeriod, d.id); return v === null ? null : d.unit === 'pct' ? +(v * 100).toFixed(2) : +v.toFixed(2); },
              })),
            ],
          }}
          notes="In the table, the best value in each row is bold (lowest for valuation and debt, highest otherwise)."
        />
        <Disclaimer />
      </div>
    </div>
  );
}

type PR = '1Y' | '3Y' | '5Y';
function RebasedPanel({ comps, missing }: { comps: { ticker: string; color: string }[]; missing: string[] }) {
  const { bundle, slug } = useSector();
  const { palette } = useTheme();
  const narrow = useNarrow();
  const all = comps.map((c) => use(loadPrices(slug, c.ticker)));
  const [range, setRange] = useState<PR>('1Y');
  const days = range === '1Y' ? 366 : range === '3Y' ? 1096 : 1827;
  const end = Math.min(...all.map((p) => p.points.at(-1)?.[0] ?? 0));
  const start = Math.max(end - days, ...all.map((p) => p.points[0]?.[0] ?? 0));
  const series = comps.map((c, i) => ({ ticker: c.ticker, color: c.color, points: all[i].points.filter(([d]) => d >= start && d <= end) }));
  const perf = series.map((s) => ({ t: s.ticker, r: s.points.length > 1 ? s.points.at(-1)![1] / s.points[0][1] - 1 : null })).filter((x) => x.r !== null).sort((a, b) => b.r! - a.r!);
  const title = perf.length >= 2 ? `${perf[0].t} has returned the most over ${range === '1Y' ? 'the past year' : range === '3Y' ? 'three years' : 'five years'}: ${fmt(perf[0].r, 'pct', { sign: true })}, against ${fmt(perf.at(-1)!.r, 'pct', { sign: true })} for ${perf.at(-1)!.t}` : 'Share price performance';
  return (
    <Panel
      title={title}
      titleText={title}
      subtitle={`Adjusted share price rebased to 100 at the start of the range · to ${fmtDate(bundle.meta.asOf.prices)}`}
      usesPrices
      allowData={false}
      downloadName={`compare_${comps.map((c) => c.ticker).join('_')}_price_${range}`}
      controls={<Segmented<PR> label="Range" size="sm" value={range} onChange={setRange} options={[{ value: '1Y', label: '1Y' }, { value: '3Y', label: '3Y' }, { value: '5Y', label: '5Y' }]} />}
      chart={(ref) => <EChart ref={ref} option={rebasedPrices(palette, { series, source: 'Adjusted closing prices', narrow })} height={narrow ? 260 : 320} ariaLabel={title} />}
      notes={[start > end - days ? 'The range starts later for at least one company because its price history is shorter.' : '', missing.length ? `No price history for ${missing.join(', ')}.` : ''].filter(Boolean).join(' ') || undefined}
    />
  );
}
