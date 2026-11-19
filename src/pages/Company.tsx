import { Suspense, use, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { GitCompareArrows, Plus } from 'lucide-react';
import { useSector } from '../lib/sector-context';
import { useTheme } from '../lib/theme';
import { loadPrices } from '../lib/data';
import { fmt, fmtCell, fmtChange, fmtDate, STATUS_HELP, UNIT_LABEL } from '../lib/format';
import { fiscalQuarter, fyMonthName, periodLabel, qShift } from '../lib/periods';
import { track } from '../lib/analytics';
import type { Cell, Unit } from '../lib/types';
import { EChart } from '../components/charts/EChart';
import { columnsOverTime, linesOverTime } from '../components/charts/builders';
import { mirroredBalance, priceChart } from '../components/charts/builders-company';
import { tone } from '../components/charts/style';
import { Delta, Segmented, Skeleton } from '../components/ui/controls';
import { Disclaimer, Panel, SectionHeading } from '../components/ui/Panel';
import { NotFound } from './Empty';
import { Boundary, Unavailable } from '../components/ui/Boundary';
import { useNarrow } from '../lib/useNarrow';

type Range = '12q' | '20q' | 'all';
const RANGE_N: Record<Range, number> = { '12q': 12, '20q': 20, all: Infinity };

export default function CompanyPage() {
  const { ticker = '' } = useParams();
  const { bundle, slug } = useSector();
  const co = bundle.companyByTicker.get(ticker.toUpperCase());
  useEffect(() => {
    if (co) { document.title = `${co.ticker}: ${co.name} | Insight Securities Insights`; track('insights_company_view', { sector: slug, ticker: co.ticker }); }
  }, [co, slug]);
  if (!co) return <NotFound />;
  return <CompanyView key={co.ticker} ticker={co.ticker} />;
}

function CompanyView({ ticker }: { ticker: string }) {
  const { bundle, slug } = useSector();
  const { palette } = useTheme();
  const narrow = useNarrow();
  const nav = useNavigate();
  const co = bundle.companyByTicker.get(ticker)!;
  const cc = bundle.meta.config.companyCharts!;
  const [range, setRange] = useState<Range>('12q');
  const quarters = bundle.periodsFor(ticker, 'Q');
  const years = bundle.periodsFor(ticker, 'FY');
  const last = co.lastQuarter ?? quarters.at(-1)!;
  const src = `Financials to ${fmtDate(bundle.meta.asOf.financials)}`;

  const latestOk = (metric: string) => {
    for (let i = quarters.length - 1; i >= 0; i--) {
      const c = bundle.cell(ticker, quarters[i], metric);
      if (c.s === 'ok') return { p: quarters[i], v: c.v! };
    }
    return null;
  };

  // Peers: closest market caps.
  const peers = useMemo(() => {
    const mc = (t: string) => {
      const qs = bundle.periodsFor(t, 'Q');
      for (let i = qs.length - 1; i >= 0; i--) { const v = bundle.value(t, qs[i], 'market_cap'); if (v !== null) return v; }
      return null;
    };
    const mine = mc(ticker) ?? 0;
    return bundle.companies.filter((c) => c.ticker !== ticker).map((c) => ({ c, d: Math.abs(Math.log(((mc(c.ticker) ?? 1) + 1) / (mine + 1))) })).sort((a, b) => a.d - b.d).slice(0, 3).map((x) => x.c);
  }, [bundle, ticker]);

  const shown = quarters.slice(Math.max(0, quarters.length - RANGE_N[range]));
  const ser = (metric: string, ps = shown) => ps.map((p) => ({ p, ...bundle.cell(ticker, p, metric) }));

  // ---------------------------------------------- flows
  const flow = (metric: string) => {
    const def = bundle.metric(metric);
    const pts = ser(metric).map((x) => {
      const prev = bundle.value(ticker, qShift(x.p, -4), metric);
      const yoy = x.v !== null && prev !== null && prev > 0 ? x.v / prev - 1 : null;
      return { p: x.p, v: x.v, s: x.s, yoy, yoyKind: 'pct' as const, subtitle: fiscalQuarter(x.p, co.fyEndMonth) };
    });
    const lastPt = [...pts].reverse().find((x) => x.v !== null);
    const name = def.short ?? def.label;
    const title = lastPt
      ? lastPt.yoy !== null && lastPt.yoy !== undefined
        ? `${name} ${lastPt.v! < 0 ? 'was a loss of' : 'of'} ${fmt(Math.abs(lastPt.v!), 'pkr_mn', { compact: true, currency: true })} in ${periodLabel(lastPt.p)}, ${fmtChange(lastPt.yoy, 'pct')} on a year earlier`
        : `${name} of ${fmt(lastPt.v, 'pkr_mn', { compact: true, currency: true })} in ${periodLabel(lastPt.p)}${lastPt.v! < 0 ? ' (loss)' : ''}`
      : `${name} by quarter`;
    return { def, pts, title };
  };
  const flows = cc.flows.filter((m) => bundle.has(m)).map(flow);

  // ---------------------------------------------- margin + returns lines with sector median
  const lineBlock = (metrics: string[], ghostMetric: string, colors: string[]) => {
    const series = metrics.filter((m) => bundle.has(m)).map((m, i) => ({
      name: bundle.metric(m).short && bundle.metric(m).short!.length > 3 ? bundle.metric(m).short! : bundle.metric(m).label.replace(' (TTM)', ''),
      color: colors[i] ?? palette.data2,
      points: ser(m).map((x) => ({ p: x.p, v: x.v, s: x.s })),
    }));
    const med = bundle.medianSeries(ghostMetric, shown);
    series.push({ name: `Sector median ${bundle.metric(ghostMetric).label.replace(' (TTM)', '').toLowerCase()}`, color: palette.faint, points: med.map((x) => ({ p: x.p, v: x.v, s: 'ok' as const })), ghost: true, dashed: true } as never);
    return series;
  };
  const marginSeries = lineBlock(cc.margins, cc.margins.at(-1)!, [palette.data, palette.brand, palette.accent]);
  const returnSeries = lineBlock(cc.returns, cc.returns[0], [palette.brand, palette.data]);
  const nm = latestOk(cc.margins.at(-1)!);
  const nmMed = nm ? bundle.medianSeries(cc.margins.at(-1)!, [nm.p])[0].v : null;
  const marginTitle = nm && nmMed !== null
    ? `${bundle.metric(cc.margins.at(-1)!).label} of ${fmt(nm.v, 'pct')} in ${periodLabel(nm.p)}, ${Math.abs(nm.v - nmMed) < 0.002 ? 'in line with' : nm.v > nmMed ? 'above' : 'below'} the sector median${Math.abs(nm.v - nmMed) < 0.002 ? '' : ` of ${fmt(nmMed, 'pct')}`}`
    : 'Margins by quarter';
  const roe = latestOk(cc.returns[0]);
  const roeMed = roe ? bundle.medianSeries(cc.returns[0], [roe.p])[0].v : null;
  const roeTitle = roe && roeMed !== null
    ? `Return on equity ${roe.v >= roeMed ? 'beats' : 'trails'} the sector: ${fmt(roe.v, 'pct')} vs a median of ${fmt(roeMed, 'pct')}`
    : 'Returns over time';

  // ---------------------------------------------- valuation history
  const valBlocks = cc.valuation.filter((m) => bundle.has(m)).map((m) => {
    const def = bundle.metric(m);
    const all = ser(m, quarters);
    const ok = all.filter((x) => x.s === 'ok').map((x) => x.v!);
    const histMed = ok.length ? [...ok].sort((a, b) => a - b)[Math.floor(ok.length / 2)] : null;
    const cur = latestOk(m);
    const sectorMed = bundle.medianSeries(m, shown, true);
    const nmCount = ser(m).filter((x) => x.s === 'nm').length;
    const title = cur && histMed
      ? `Trades at ${fmt(cur.v, 'x')} ${def.label.replace(' (TTM)', '')}, ${cur.v < histMed ? 'below' : 'above'} its own long-run median of ${fmt(histMed, 'x')}`
      : `${def.label} history`;
    return { def, m, title, nmCount, series: [
      { name: ticker, color: palette.accent, points: ser(m).map((x) => ({ p: x.p, v: x.v, s: x.s })), width: 2.2 },
      { name: 'Sector median', color: palette.faint, points: sectorMed.map((x) => ({ p: x.p, v: x.v, s: 'ok' as const })), ghost: true, dashed: true },
    ] };
  });

  // ---------------------------------------------- balance sheet
  const bsPeriods = shown.filter((p) => bundle.cell(ticker, p, cc.netCash).s === 'ok');
  const bsVals = (m: string) => bsPeriods.map((p) => bundle.value(ticker, p, m));
  const netNow = latestOk(cc.netCash);
  const dte = latestOk('debt_to_equity');
  const bsTitle = netNow
    ? netNow.v >= 0
      ? `Net cash of ${fmt(netNow.v, 'pkr_mn', { compact: true, currency: true })} at ${periodLabel(netNow.p)}${dte ? `; debt is ${fmt(dte.v, 'x')} equity` : ''}`
      : `Net debt of ${fmt(-netNow.v, 'pkr_mn', { compact: true, currency: true })} at ${periodLabel(netNow.p)}${dte ? `; debt is ${fmt(dte.v, 'x')} equity` : ''}`
    : 'Balance-sheet strength';

  const stats = cc.stats.filter((m) => bundle.has(m)).map((m) => {
    const def = bundle.metric(m);
    const v = latestOk(m);
    const med = v ? bundle.medianSeries(m, [v.p], def.unit === 'x')[0].v : null;
    return { m, def, v, med };
  });

  const dayCh = co.price?.prev ? co.price.last / co.price.prev - 1 : null;
  const lastFY = [...years].reverse().find((y) => bundle.cell(ticker, y, 'net_sales').s === 'ok');

  const rangeControl = (
    <Segmented<Range> label="Range" size="sm" value={range} onChange={setRange} options={[{ value: '12q', label: '3Y' }, { value: '20q', label: '5Y' }, { value: 'all', label: 'All' }]} />
  );

  return (
    <div>
      {/* ------------------------------------------------ header */}
      <div className="border-b border-line bg-surface">
        <div className="mx-auto max-w-[1280px] px-4 pb-8 pt-8 sm:px-6 sm:pt-10 lg:px-8">
          <nav aria-label="Breadcrumb" className="text-[12.5px] text-muted">
            <Link to={`/${slug}`} className="hover:text-ink">{bundle.meta.name}</Link>
            <span aria-hidden className="mx-1.5 text-faint">/</span>
            <Link to={`/${slug}/companies`} className="hover:text-ink">Companies</Link>
          </nav>
          <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="rise min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h1 className="text-[30px] font-semibold tracking-[-0.03em] text-ink sm:text-[38px]">{co.ticker}</h1>
                <p className="min-w-0 text-[16px] text-ink-2 sm:text-[18px]">{co.name}</p>
              </div>
              <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-muted">
                <span>Fiscal year ends {fyMonthName(co.fyEndMonth)}</span>
                <span className="num">{fmt(co.sharesOutstandingMn, 'number', { digits: 1 })} mn shares</span>
                <span>Results to {periodLabel(last)} ({fiscalQuarter(last, co.fyEndMonth)})</span>
                {co.lastBalanceSheet !== last && co.lastBalanceSheet && <span className="text-accent-ink">Balance sheet to {periodLabel(co.lastBalanceSheet)}</span>}
              </p>
            </div>
            {co.price && (
              <div className="flex items-end gap-4">
                <div>
                  <p className="num text-[30px] font-semibold leading-none tracking-[-0.02em] text-ink">{fmt(co.price.last, 'rs')}</p>
                  <p className="mt-1.5 flex items-center gap-2 text-[12px] text-muted">
                    <Delta text={fmtChange(dayCh, 'pct')} tone={tone(dayCh)} size="xs" />
                    <span>last close, {fmtDate(co.price.to)}</span>
                  </p>
                </div>
              </div>
            )}
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span className="text-[12.5px] text-muted">Compare with</span>
            {peers.map((p) => (
              <Link key={p.ticker} to={`/${slug}/compare?t=${ticker},${p.ticker}`} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[12.5px] font-semibold text-ink-2 transition-colors hover:border-line-strong hover:text-ink">
                <Plus aria-hidden className="size-3.5 text-muted" />{p.ticker}
              </Link>
            ))}
            <Link to={`/${slug}/compare?t=${ticker}`} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-brand-soft px-3 text-[12.5px] font-semibold text-brand-ink transition-colors hover:brightness-95">
              <GitCompareArrows aria-hidden className="size-3.5" />Head-to-head
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        {/* ------------------------------------------------ key stats */}
        <section aria-label="Key statistics" className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3 lg:grid-cols-6">
          {stats.map(({ m, def, v, med }) => (
            <div key={m} className="bg-surface p-4">
              <p className="text-[12px] font-medium text-muted">{def.label}</p>
              <p className="num mt-1.5 text-[20px] font-semibold tracking-[-0.01em] text-ink">{v ? fmt(v.v, def.unit, { compact: true, currency: def.unit === 'pkr_mn' }) : '—'}</p>
              <p className="num mt-1 text-[11px] text-faint">{v ? `${periodLabel(v.p)} · sector ${fmt(med, def.unit, { compact: true })}` : 'Not available'}</p>
            </div>
          ))}
        </section>

        {/* ------------------------------------------------ price */}
        <div className="mt-5">
          {co.price ? (
            <Boundary fallback={() => <Unavailable title="Price history could not be loaded" detail="The rest of this page is unaffected. Reload the page to try again." />}>
              <Suspense fallback={<div className="rounded-xl border border-line bg-surface p-6"><Skeleton className="h-5 w-1/2" /><Skeleton className="mt-6 h-[300px] w-full" /></div>}>
                <PricePanel ticker={ticker} />
              </Suspense>
            </Boundary>
          ) : (
            <Unavailable title={`No share prices for ${ticker} in this data`} detail="The research workbook has no daily prices for this company, so its price chart and price-based ratios (P/E, P/B, market cap) are not shown." />
          )}
        </div>

        {/* ------------------------------------------------ income */}
        <SectionHeading title="Results" lead={`Quarterly figures by calendar quarter. ${co.ticker} reports on a ${fyMonthName(co.fyEndMonth)} year-end, so each quarter also carries its own fiscal label (for example ${fiscalQuarter(last, co.fyEndMonth)}).`} action={rangeControl} />
        <div className="grid gap-5 lg:grid-cols-2">
          {flows.map((f) => (
            <Panel
              key={f.def.id}
              title={f.title}
              titleText={f.title}
              subtitle={`${f.def.label}, PKR, by quarter${f.def.id === 'net_profit' ? ' · losses below zero' : ''}`}
              downloadName={`${ticker}_${f.def.id}_quarterly`}
              chart={(ref) => <EChart ref={ref} option={columnsOverTime(palette, { name: f.def.label, unit: 'pkr_mn', points: f.pts, source: src, highlightLast: true })} height={narrow ? 230 : 270} ariaLabel={f.title} />}
              table={{
                rows: [...f.pts].reverse(),
                rowKey: (r) => r.p,
                columns: [
                  { key: 'p', header: 'Quarter', align: 'left', sticky: true, render: (r) => <span>{periodLabel(r.p)} <span className="text-faint">{r.subtitle}</span></span>, exportValue: (r) => periodLabel(r.p), sortValue: (r) => r.p },
                  { key: 'v', header: f.def.label, sub: 'PKR mn', render: (r) => fmtCell({ v: r.v, s: r.s }, 'pkr_mn'), exportValue: (r) => r.v, sortValue: (r) => r.v },
                  { key: 'y', header: 'YoY', sub: '%', render: (r) => <Delta text={fmtChange(r.yoy, 'pct')} tone={tone(r.yoy)} />, exportValue: (r) => (r.yoy === null ? null : +(r.yoy * 100).toFixed(2)), sortValue: (r) => r.yoy },
                ],
              }}
              notes={f.pts.some((x) => x.v !== null && x.v < 0) ? 'Year-on-year change is not shown when the earlier quarter was a loss.' : undefined}
            />
          ))}
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <Panel
            title={marginTitle}
            titleText={marginTitle}
            subtitle="Gross, operating and net margin for each quarter · dashed: sector median net margin"
            downloadName={`${ticker}_margins`}
            chart={(ref) => <EChart ref={ref} option={linesOverTime(palette, { unit: 'pct', periods: shown, series: marginSeries, source: src, endLabels: !narrow, zeroLine: true })} height={narrow ? 250 : 300} ariaLabel={marginTitle} />}
            table={ratioTable(bundle, ticker, cc.margins, shown)}
          />
          <Panel
            title={roeTitle}
            titleText={roeTitle}
            subtitle="Return on equity and assets, trailing 12 months · dashed: sector median ROE"
            downloadName={`${ticker}_returns`}
            chart={(ref) => <EChart ref={ref} option={linesOverTime(palette, { unit: 'pct', periods: shown, series: returnSeries, source: src, endLabels: !narrow, zeroLine: true })} height={narrow ? 250 : 300} ariaLabel={roeTitle} />}
            table={ratioTable(bundle, ticker, cc.returns, shown)}
            notes="Needs four consecutive quarters and a balance sheet; gaps mean one of those is missing."
          />
        </div>

        <SectionHeading title="Valuation and balance sheet" lead="Price multiples use the average share price over each quarter against trailing 12-month profit and sales, and quarter-end equity." />
        <div className="grid gap-5 lg:grid-cols-2">
          {valBlocks.map((b) => (
            <Panel
              key={b.m}
              title={b.title}
              titleText={b.title}
              subtitle={`${b.def.label} by quarter · amber: ${ticker} · dashed: sector median`}
              usesPrices
              downloadName={`${ticker}_${b.m}_history`}
              chart={(ref) => <EChart ref={ref} option={linesOverTime(palette, { unit: 'x', periods: shown, series: b.series, source: src, endLabels: !narrow, yMin: 0 })} height={narrow ? 230 : 270} ariaLabel={b.title} />}
              table={ratioTable(bundle, ticker, [b.m], shown)}
              notes={b.nmCount ? `${b.nmCount} quarter${b.nmCount > 1 ? 's' : ''} in this range show a gap because trailing profit was a loss (P/E not meaningful).` : undefined}
            />
          ))}
        </div>

        <div className="mt-5">
          <Panel
            title={bsTitle}
            titleText={bsTitle}
            subtitle="Cash and short-term investments (up) against borrowings (down), PKR · line: net cash"
            downloadName={`${ticker}_balance_sheet`}
            chart={(ref) =>
              bsPeriods.length ? (
                <EChart
                  ref={ref}
                  option={mirroredBalance(palette, {
                    periods: bsPeriods,
                    up: cc.cash.filter((m) => bundle.has(m)).map((m) => ({ name: bundle.metric(m).label, values: bsVals(m) })),
                    down: cc.debt.filter((m) => bundle.has(m)).map((m) => ({ name: bundle.metric(m).label, values: bsVals(m) })),
                    net: bsVals(cc.netCash),
                    netName: bundle.metric(cc.netCash).label,
                    source: src,
                  })}
                  height={narrow ? 280 : 320}
                  ariaLabel={bsTitle}
                />
              ) : <p className="px-4 py-16 text-center text-[13px] text-muted">No balance sheets in this range.</p>
            }
            table={ratioTable(bundle, ticker, [...cc.cash, ...cc.debt, cc.netCash, 'debt_to_equity', 'net_cash_per_share'].filter((m) => bundle.has(m)), shown)}
            notes={co.lastBalanceSheet !== co.lastQuarter ? `The ${periodLabel(co.lastQuarter ?? '')} balance sheet has not been filed yet, so the latest point is ${periodLabel(co.lastBalanceSheet ?? '')}.` : undefined}
          />
        </div>

        <RatioTables ticker={ticker} quarters={quarters} years={years} lastFY={lastFY ?? null} onCompare={() => nav(`/${slug}/compare?t=${ticker}`)} />
        <Disclaimer />
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ price panel (lazy data)
type PriceRange = '1M' | '6M' | '1Y' | '5Y' | 'Max';
const DAYS: Record<PriceRange, number> = { '1M': 31, '6M': 183, '1Y': 366, '5Y': 1827, Max: Infinity };

function PricePanel({ ticker }: { ticker: string }) {
  const { bundle, slug } = useSector();
  const { palette } = useTheme();
  const narrow = useNarrow();
  const prices = use(loadPrices(slug, ticker));
  const pts = prices.points;
  const lastDay = pts.at(-1)?.[0] ?? 0;
  const covers = (rg: PriceRange) => DAYS[rg] === Infinity || (pts[0] && pts[0][0] <= lastDay - DAYS[rg] * 0.9);
  // Default to one year, or the longest range a short history (a new listing) actually covers.
  const [range, setRange] = useState<PriceRange>(() => (['1Y', '6M', '1M'] as PriceRange[]).find(covers) ?? 'Max');
  const [log, setLog] = useState(false);
  const slice = (r: PriceRange) => (DAYS[r] === Infinity ? pts : pts.filter(([d]) => d >= lastDay - DAYS[r]));
  const ret = (r: PriceRange) => { const s = slice(r); return s.length > 1 ? s.at(-1)![1] / s[0][1] - 1 : null; };
  const cur = slice(range);
  const r = ret(range);
  const available = covers;
  const title = r !== null
    ? `${ticker} is ${r >= 0 ? 'up' : 'down'} ${fmt(Math.abs(r), 'pct')} ${range === 'Max' ? (pts.length < 60 ? `since listing (${pts.length} trading days)` : `over the full history since ${new Date(pts[0][0] * 86400000).getUTCFullYear()}`) : 'over '}${range === 'Max' ? '' : range === '1M' ? 'the past month' : range === '6M' ? 'six months' : range === '1Y' ? 'the past year' : 'five years'}`
    : `${ticker} share price`;
  const option = useMemo(() => priceChart(palette, { points: cur, ticker, up: (r ?? 0) >= 0, log, source: `Adjusted for bonus issues · prices to ${fmtDate(bundle.meta.asOf.prices)}` }), [palette, cur, ticker, r, log, bundle.meta.asOf.prices]);
  return (
    <Panel
      title={title}
      titleText={title}
      subtitle={`Daily closing price, Rs, adjusted for bonus issues · ${cur.length.toLocaleString('en-US')} trading days`}
      usesPrices
      allowData={false}
      downloadName={`${ticker}_price_${range}`}
      controls={
        <>
          <div role="radiogroup" aria-label="Price range" className="flex flex-wrap gap-1">
            {(Object.keys(DAYS) as PriceRange[]).map((rg) => {
              const rr = ret(rg);
              const ok = available(rg);
              return (
                <button
                  key={rg}
                  type="button"
                  role="radio"
                  aria-checked={range === rg}
                  disabled={!ok}
                  onClick={() => { setRange(rg); track('insights_period_change', { sector: slug, view: 'price', period: rg }); }}
                  className={`flex min-w-[52px] flex-col items-center rounded-lg border px-2 py-1 transition-colors disabled:opacity-40 ${range === rg ? 'border-ink bg-ink text-surface' : 'border-line bg-surface text-ink-2 hover:border-line-strong'}`}
                >
                  <span className="text-[12px] font-semibold">{rg}</span>
                  <span className={`num text-[10.5px] font-medium ${range === rg ? 'text-surface/80' : rr === null ? 'text-faint' : rr >= 0 ? 'text-pos' : 'text-neg'}`}>{ok ? fmtChange(rr, 'pct') : '—'}</span>
                </button>
              );
            })}
          </div>
          {(range === 'Max' || range === '5Y') && (
            <Segmented label="Scale" size="sm" value={log ? 'log' : 'linear'} onChange={(v) => setLog(v === 'log')} options={[{ value: 'linear', label: 'Linear' }, { value: 'log', label: 'Log' }]} />
          )}
        </>
      }
      chart={(ref) => <EChart ref={ref} option={option} height={narrow ? 260 : 340} ariaLabel={title} />}
      notes="Price data is view-only: it can be saved as an image but not downloaded as data."
    />
  );
}

// ------------------------------------------------------------------ helpers: ratio tables
interface RatioRow { id: string; label: string; unit: Unit; cells: Record<string, Cell> }

function ratioTable(bundle: ReturnType<typeof useSector>['bundle'], ticker: string, metrics: string[], periods: string[]) {
  const rows = [...periods].reverse();
  return {
    rows,
    rowKey: (p: string) => p,
    columns: [
      { key: 'p', header: 'Quarter', align: 'left' as const, sticky: true, render: (p: string) => periodLabel(p), exportValue: (p: string) => periodLabel(p), sortValue: (p: string) => p },
      ...metrics.map((m) => {
        const def = bundle.metric(m);
        return {
          key: m,
          header: def.label,
          sub: UNIT_LABEL[def.unit],
          render: (p: string) => fmtCell(bundle.cell(ticker, p, m), def.unit),
          title: (p: string) => STATUS_HELP[bundle.cell(ticker, p, m).s] || undefined,
          exportValue: (p: string) => { const c = bundle.cell(ticker, p, m); return c.s === 'ok' ? (def.unit === 'pct' ? +(c.v! * 100).toFixed(2) : +c.v!.toFixed(2)) : null; },
          sortValue: (p: string) => bundle.value(ticker, p, m),
        };
      }),
    ],
  };
}

function RatioTables({ ticker, quarters, years, lastFY, onCompare }: { ticker: string; quarters: string[]; years: string[]; lastFY: string | null; onCompare: () => void }) {
  const { bundle } = useSector();
  const [basis, setBasis] = useState<'annual' | 'quarterly'>('annual');
  const co = bundle.companyByTicker.get(ticker)!;
  const cfg = bundle.meta.config;
  const cc = cfg.companyCharts!;
  const statement = [...cc.flows, 'gross_profit', 'operating_profit', 'total_assets', 'total_equity', cc.netCash].filter((m, i, a) => bundle.has(m) && a.indexOf(m) === i);
  const ratioIds = (basis === 'annual' ? cfg.compare?.annual : cfg.compare?.quarterly) ?? [];
  const ratios = ratioIds.filter((e) => !e.startsWith('rank:') && bundle.has(e));
  const periods = basis === 'annual' ? [...years].reverse() : [...quarters].reverse().slice(0, 12);
  const ids = [...statement, ...ratios];
  const rows: RatioRow[] = ids.map((id) => {
    const def = bundle.metric(id);
    return { id, label: def.label, unit: def.unit, cells: Object.fromEntries(periods.map((p) => [p, bundle.cell(ticker, p, id)])) };
  });
  const status = co.annualStatus;
  return (
    <>
      <SectionHeading
        title="Full ratio history"
        lead={basis === 'annual' ? `Each fiscal year ends in ${fyMonthName(co.fyEndMonth)}. Years still in progress are marked and left blank until the fourth quarter is in.` : 'The last 12 quarters. Margins and growth are for the quarter; ROE, ROA, P/E and P/S use trailing 12 months.'}
        action={<Segmented label="Basis" value={basis} onChange={setBasis} options={[{ value: 'annual', label: 'Annual' }, { value: 'quarterly', label: 'Quarterly' }]} />}
      />
      <Panel<RatioRow>
        title={basis === 'annual' && lastFY ? `${ticker} in figures, ${years[0]} to ${lastFY}` : `${ticker} in figures, last ${periods.length} quarters`}
        titleText={`${ticker} ratio history (${basis})`}
        subtitle="PKR millions unless stated · n/a: not enough history · n/m: loss in this or the comparison period · —: balance sheet not yet filed"
        downloadName={`${ticker}_${basis}_ratios`}
        tableFirst
        table={{
          rows,
          rowKey: (r) => r.id,
          columns: [
            { key: 'metric', header: basis === 'annual' ? 'Fiscal year' : 'Quarter', align: 'left', sticky: true, minWidth: 190, render: (r) => <span className={statement.includes(r.id) ? 'font-medium text-ink' : 'text-ink-2'}>{r.label}</span>, exportValue: (r) => `${r.label}${r.unit === 'pct' ? ' (%)' : r.unit === 'x' ? ' (x)' : r.unit === 'rs' ? ' (Rs)' : ' (PKR mn)'}` },
            ...periods.map((p) => ({
              key: p,
              header: basis === 'annual' ? p : periodLabel(p),
              exportHeader: basis === 'annual' ? p : periodLabel(p),
              sub: basis === 'annual' ? (status[p] && status[p] !== 'Complete' ? 'in progress' : undefined) : fiscalQuarter(p, co.fyEndMonth),
              render: (r: RatioRow) => <span className={r.cells[p]?.s !== 'ok' ? 'text-faint' : r.cells[p].v! < 0 ? 'text-neg' : ''}>{fmtCell(r.cells[p] ?? { v: null, s: 'blank' }, r.unit)}</span>,
              title: (r: RatioRow) => STATUS_HELP[r.cells[p]?.s ?? 'blank'] || undefined,
              exportValue: (r: RatioRow) => { const c = r.cells[p]; return c?.s === 'ok' ? (r.unit === 'pct' ? +(c.v! * 100).toFixed(2) : +c.v!.toFixed(2)) : null; },
            })),
          ],
          rowClass: (r) => (r.id === statement.at(-1) ? '[&>td]:border-b-2 [&>td]:border-b-line-strong' : ''),
        }}
        notes={<button type="button" onClick={onCompare} className="font-medium text-brand-ink underline decoration-line-strong underline-offset-2 hover:decoration-brand">Compare {ticker} with up to three peers</button>}
      />
    </>
  );
}
