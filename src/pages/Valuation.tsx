import { useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useSector } from '../lib/sector-context';
import { useTheme } from '../lib/theme';
import { fmt, fmtDate } from '../lib/format';
import { periodLabel } from '../lib/periods';
import { track } from '../lib/analytics';
import { median } from '../lib/data';
import { EChart } from '../components/charts/EChart';
import { valuationBubbles, type BubbleRow } from '../components/charts/builders';
import { Segmented, Select } from '../components/ui/controls';
import { Disclaimer, PageIntro, Panel, SectionHeading } from '../components/ui/Panel';
import { compareColumns, compareMedians, compareRows, compareSpecs } from '../components/CompareTable';
import { useNarrow } from '../lib/useNarrow';

export default function Valuation() {
  const { bundle, slug } = useSector();
  const { palette } = useTheme();
  const narrow = useNarrow();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const vm = bundle.meta.config.valuationMap;
  const m = bundle.meta;

  useEffect(() => { document.title = `Valuation: ${m.name} | Insight Securities Insights`; }, [m.name]);

  // ---------------------------------------------------------------- valuation map
  const mapDefault = vm ? bundle.latestCovered('Q', [vm.x, vm.y]) ?? m.quarters.at(-1)! : m.quarters.at(-1)!;
  const mapPeriod = params.get('q') && m.quarters.includes(params.get('q')!) ? params.get('q')! : mapDefault;
  const setParam = (k: string, v: string) => { const n = new URLSearchParams(params); n.set(k, v); setParams(n, { replace: true }); };

  const map = useMemo(() => {
    if (!vm) return null;
    const xDef = bundle.metric(vm.x), yDef = bundle.metric(vm.y), sDef = bundle.metric(vm.size);
    const plotted: BubbleRow[] = [];
    const excluded: { ticker: string; why: string }[] = [];
    for (const c of bundle.companies) {
      const x = bundle.cell(c.ticker, mapPeriod, vm.x), y = bundle.cell(c.ticker, mapPeriod, vm.y);
      if (x.s === 'ok' && y.s === 'ok' && y.v! > 0) plotted.push({ ticker: c.ticker, name: c.name, x: x.v!, y: y.v!, size: bundle.value(c.ticker, mapPeriod, vm.size) });
      else excluded.push({ ticker: c.ticker, why: y.s === 'nm' ? 'loss-making, so P/E is not meaningful' : x.s === 'nobs' || y.s === 'nobs' ? 'no balance sheet for this quarter' : 'not enough history' });
    }
    const mx = median(plotted.map((r) => r.x)) ?? 0, my = median(plotted.map((r) => r.y)) ?? 0;
    const strong = plotted.filter((r) => r.y <= my && r.x >= mx).sort((a, b) => a.y / a.x - b.y / b.x);
    const weak = plotted.filter((r) => r.y > my && r.x < mx);
    return { xDef, yDef, sDef, plotted, excluded, mx, my, strong, weak };
  }, [bundle, vm, mapPeriod]);

  const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);
  const mapTitle = map
    ? map.strong.length
      ? `${map.strong.length === 1 ? 'One company sits' : `${map.strong.length} companies sit`} in the cheap-and-strong corner: ${list(map.strong.map((r) => r.ticker))}`
      : 'No company is both cheaper and more profitable than the sector median'
    : 'Valuation map';

  // ---------------------------------------------------------------- comparison table
  const mode = (params.get('basis') === 'annual' ? 'annual' : 'quarterly') as 'annual' | 'quarterly';
  const entries = mode === 'annual' ? m.config.compare?.annual ?? [] : m.config.compare?.quarterly ?? [];
  const specs = useMemo(() => compareSpecs(bundle, entries), [bundle, entries]);
  const valueSpec = specs.find((s) => !s.isRank && s.unit === 'x');
  const fyDefault = bundle.latestCovered('FY', specs.filter((s) => !s.isRank).slice(0, 2).map((s) => s.metric)) ?? m.fiscalYears.at(-1)!;
  const qDefault = bundle.latestCovered('Q', specs.filter((s) => !s.isRank && s.unit === 'x').map((s) => s.metric)) ?? m.quarters.at(-1)!;
  const tablePeriod = mode === 'annual'
    ? (params.get('fy') && m.fiscalYears.includes(params.get('fy')!) ? params.get('fy')! : fyDefault)
    : (params.get('cq') && m.quarters.includes(params.get('cq')!) ? params.get('cq')! : qDefault);
  const rows = useMemo(() => compareRows(bundle, specs, tablePeriod), [bundle, specs, tablePeriod]);
  const cols = useMemo(() => compareColumns(bundle, specs, rows, tablePeriod, (t) => nav(`/${slug}/company/${t}`)), [bundle, specs, rows, tablePeriod, nav, slug]);
  const meds = useMemo(() => compareMedians(specs, rows), [specs, rows]);
  const tableTitle = (() => {
    if (!valueSpec) return 'All companies side by side';
    const ok = rows.filter((r) => r.cells[valueSpec.id]?.s === 'ok' && r.cells[valueSpec.id].v! > 0).sort((a, b) => a.cells[valueSpec.id].v! - b.cells[valueSpec.id].v!);
    if (ok.length < 2) return 'All companies side by side';
    const lo = ok[0], hi = ok.at(-1)!;
    return `${lo.ticker} is the cheapest on ${valueSpec.label.replace(' (TTM)', '')} at ${fmt(lo.cells[valueSpec.id].v, 'x')}; ${hi.ticker} the most expensive at ${fmt(hi.cells[valueSpec.id].v, 'x')}`;
  })();
  const nmCount = valueSpec ? rows.filter((r) => r.cells[valueSpec.id]?.s === 'nm').length : 0;

  const qOptions = [...m.quarters].reverse().slice(0, 24).map((q) => ({ value: q, label: `${periodLabel(q)}${q === mapDefault ? ' (latest complete)' : ''}` }));

  return (
    <div>
      <PageIntro
        title="Valuation"
        lead={map && map.plotted.length ? <>Median {map.yDef.label.replace(' (TTM)', '')} of <b className="num font-semibold text-ink">{fmt(map.my, map.yDef.unit)}</b> against a median {map.xDef.label.replace(' (TTM)', '')} of <b className="num font-semibold text-ink">{fmt(map.mx, map.xDef.unit)}</b> in {periodLabel(mapPeriod)}. Below the dashed line is cheaper than the sector; to the right is more profitable.</> : undefined}
        meta={<><span>Prices are average closing prices for each period</span><span>Prices to {fmtDate(m.asOf.prices)}</span></>}
      />
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        <div className="mt-8">
          {map && vm && (
            <Panel
              id="valuation-map"
              title={mapTitle}
              titleText={mapTitle}
              subtitle={`${map.yDef.label} vs ${map.xDef.label} · bubble size = ${map.sDef.label.toLowerCase()} · ${periodLabel(mapPeriod)}`}
              usesPrices
              downloadName={`${slug}_valuation_map_${mapPeriod}`}
              controls={<Select label="Quarter" hideLabel value={mapPeriod} onChange={(v) => { setParam('q', v); track('insights_period_change', { sector: slug, view: 'valuation_map', period: v }); }} options={qOptions} />}
              chart={(ref) => (
                <EChart
                  ref={ref}
                  option={valuationBubbles(palette, {
                    rows: map.plotted, xUnit: map.xDef.unit, yUnit: map.yDef.unit, sizeUnit: map.sDef.unit,
                    xName: map.xDef.label, yName: map.yDef.label, sizeName: map.sDef.label,
                    periodText: periodLabel(mapPeriod), source: `Prices to ${fmtDate(m.asOf.prices)} · financials to ${fmtDate(m.asOf.financials)}`, narrow,
                  })}
                  height={narrow ? 380 : 520}
                  ariaLabel={mapTitle}
                  onEvents={{ click: (e) => { const n = (e as { name?: string }).name; if (n) nav(`/${slug}/company/${n}`); } }}
                />
              )}
              table={{
                rows: map.plotted,
                rowKey: (r) => r.ticker,
                onRowClick: (r) => nav(`/${slug}/company/${r.ticker}`),
                initialSort: { key: 'y', dir: 'asc' },
                columns: [
                  { key: 't', header: 'Company', align: 'left', sticky: true, render: (r) => <span><b className="font-semibold">{r.ticker}</b> <span className="text-muted">{r.name}</span></span>, exportValue: (r) => `${r.ticker} · ${r.name}`, sortValue: (r) => r.ticker },
                  { key: 'y', header: map.yDef.label, sub: 'x', render: (r) => fmt(r.y, map.yDef.unit), exportValue: (r) => +r.y.toFixed(2), sortValue: (r) => r.y },
                  { key: 'x', header: map.xDef.label, sub: '%', render: (r) => fmt(r.x, map.xDef.unit), exportValue: (r) => +(r.x * 100).toFixed(2), sortValue: (r) => r.x },
                  { key: 's', header: map.sDef.label, sub: 'PKR mn', render: (r) => fmt(r.size, map.sDef.unit), exportValue: (r) => (r.size === null ? null : Math.round(r.size)), sortValue: (r) => r.size },
                  { key: 'q', header: 'Quadrant', align: 'left', render: (r) => (r.y <= map.my ? (r.x >= map.mx ? <span className="font-semibold text-brand-ink">Cheap and strong</span> : 'Cheap and weak') : r.x >= map.mx ? 'Expensive and strong' : 'Expensive and weak'), exportValue: (r) => (r.y <= map.my ? (r.x >= map.mx ? 'Cheap and strong' : 'Cheap and weak') : r.x >= map.mx ? 'Expensive and strong' : 'Expensive and weak') },
                ],
              }}
              notes={
                <>
                  {map.excluded.length > 0 && <>Not plotted: {map.excluded.map((e) => `${e.ticker} (${e.why})`).join('; ')}. </>}
                  Quadrants split at the sector medians. Very high P/E values are pinned to the top edge and labelled with their true value.
                </>
              }
            />
          )}
        </div>

        <SectionHeading
          id="compare-table"
          title="All companies side by side"
          lead="The research team's comparison sheet. Colours compare companies within each column: for valuation and debt, green is cheaper or lower; for everything else, green is stronger. Rank 1 is the cheapest."
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Segmented
                label="Basis"
                value={mode}
                onChange={(v) => { const n = new URLSearchParams(params); n.set('basis', v); setParams(n, { replace: true }); track('insights_period_change', { sector: slug, view: 'compare_table', period: v }); }}
                options={[{ value: 'quarterly', label: 'Quarter (TTM)' }, { value: 'annual', label: 'Fiscal year' }]}
              />
              {mode === 'annual' ? (
                <Select label="Fiscal year" hideLabel value={tablePeriod} onChange={(v) => setParam('fy', v)} options={[...m.fiscalYears].reverse().map((f) => ({ value: f, label: `${f}${f === fyDefault ? ' (latest complete)' : ''}` }))} />
              ) : (
                <Select label="Quarter" hideLabel value={tablePeriod} onChange={(v) => setParam('cq', v)} options={[...m.quarters].reverse().slice(0, 24).map((q) => ({ value: q, label: `${periodLabel(q)}${q === qDefault ? ' (latest complete)' : ''}` }))} />
              )}
            </div>
          }
        />
        <Panel
          id="compare"
          title={tableTitle}
          titleText={tableTitle}
          subtitle={mode === 'annual' ? `${tablePeriod}: each company's own fiscal year (June or December) · P/E, P/S, P/B on the average price for the year` : `${periodLabel(tablePeriod)} · P/E, P/S, ROE and ROA on trailing 12 months; margins and growth for the quarter`}
          usesPrices
          downloadName={`${slug}_comparison_${tablePeriod}`}
          tableFirst
          table={{
            rows,
            rowKey: (r) => r.ticker,
            columns: cols,
            initialSort: valueSpec ? { key: valueSpec.id, dir: 'asc' } : undefined,
            footerRows: [{ key: 'median', label: 'Median', cells: meds }],
          }}
          notes={
            <>
              <span className="mr-3 inline-flex items-center gap-1.5"><span aria-hidden className="inline-block size-2.5 rounded-sm" style={{ background: 'color-mix(in oklab, var(--pos) 26%, transparent)' }} /> cheaper / stronger</span>
              <span className="mr-3 inline-flex items-center gap-1.5"><span aria-hidden className="inline-block size-2.5 rounded-sm" style={{ background: 'color-mix(in oklab, var(--neg) 26%, transparent)' }} /> more expensive / weaker</span>
              n/a: not enough history · n/m: not meaningful because of a loss · —: balance sheet not yet filed.
              {nmCount > 0 && ` ${nmCount} compan${nmCount === 1 ? 'y has' : 'ies have'} a loss-making year, so ${valueSpec?.label} is n/m and excluded from ranks.`}
            </>
          }
        />
        <Disclaimer />
      </div>
    </div>
  );
}
