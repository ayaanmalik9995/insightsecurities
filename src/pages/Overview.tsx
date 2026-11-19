import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowRight } from 'lucide-react';
import { useSector } from '../lib/sector-context';
import { useTheme } from '../lib/theme';
import { fmt, fmtChange, fmtDate } from '../lib/format';
import { fiscalQuarter, periodLabel, periodMonth, qShift } from '../lib/periods';
import { track } from '../lib/analytics';
import type { Aggregate } from '../lib/types';
import { EChart } from '../components/charts/EChart';
import { columnsOverTime, linesOverTime, rankedBars, sparkline } from '../components/charts/builders';
import { tone } from '../components/charts/style';
import { Delta, Segmented, Select } from '../components/ui/controls';
import { Disclaimer, Panel, SectionHeading } from '../components/ui/Panel';
import { useNarrow } from '../lib/useNarrow';

type Range = '12q' | '20q' | 'all';
const RANGE_N: Record<Range, number> = { '12q': 12, '20q': 20, all: Infinity };

/** Lower-case a label for mid-sentence use, keeping acronyms such as ROE and P/E. */
const lowerLabel = (l: string) => l.split(' ').map((w) => (/[A-Z].*[A-Z/]/.test(w) ? w : w.toLowerCase())).join(' ');

const pointAt = (a: Aggregate | null, p: string | null) => (a && p ? a.points.find((x) => x.p === p) ?? null : null);
const latestPoint = (a: Aggregate | null) => pointAt(a, a?.latest ?? null);

function basisText(a: Aggregate, p: string) {
  if (a.basis === 'ttm') return `12 months to ${periodMonth(p)}`;
  if (a.basis === 'point') return `At ${periodMonth(p)}`;
  return periodLabel(p);
}

export default function Overview() {
  const { bundle, slug } = useSector();
  const { palette } = useTheme();
  const narrow = useNarrow();
  const nav = useNavigate();
  const m = bundle.meta;
  const cfg = m.config;
  const [range, setRange] = useState<Range>('12q');

  useEffect(() => { document.title = `${m.name} sector insights | Insight Securities`; }, [m.name]);

  // ---------- headline written from the data
  const head = useMemo(() => {
    const prof = bundle.aggregate(cfg.headline?.profit ?? '');
    const val = bundle.aggregate(cfg.headline?.valuation ?? '');
    const rev = bundle.aggregate(cfg.kpis.find((k) => k.startsWith('revenue') && bundle.aggregate(k)?.unit === 'pkr_mn') ?? 'revenue_ttm');
    const pp = latestPoint(prof), rp = latestPoint(rev), vp = latestPoint(val);
    const vPrev = val && vp ? pointAt(val, qShift(vp.p, -4)) : null;
    const name = m.shortName;
    let title = `${name}: sector insights`;
    if (pp?.yoy !== null && pp?.yoy !== undefined && pp) {
      const verb = pp.yoy >= 0 ? 'rose' : 'fell';
      title = `${name} profits ${verb} ${fmt(Math.abs(pp.yoy), 'pct', { digits: 0 })} in the 12 months to ${periodMonth(pp.p)}`;
      if (rp?.yoy !== null && rp?.yoy !== undefined) {
        const faster = Math.abs(pp.yoy) > Math.abs(rp.yoy);
        title += pp.yoy >= 0 && rp.yoy >= 0 ? `, ${faster ? 'faster' : 'slower'} than revenue (${fmtChange(rp.yoy, 'pct')})` : `; revenue ${fmtChange(rp.yoy, 'pct')}`;
      }
    }
    let deck = '';
    if (vp && vp.v !== null && val) {
      const metricName = bundle.metric(val.metric ?? '').label.replace(' (TTM)', '');
      deck = vPrev?.v
        ? `The sector's median ${metricName} ${vp.v < vPrev.v ? 'fell' : vp.v > vPrev.v ? 'rose' : 'held'} from ${fmt(vPrev.v, val.unit)} to ${fmt(vp.v, val.unit)} over the same year`
        : `The sector's median ${metricName} is ${fmt(vp.v, val.unit)}`;
      const roe = bundle.aggregate('roe_ttm');
      const rr = latestPoint(roe);
      deck += rr?.v ? `, while return on equity across the sector stood at ${fmt(rr.v, 'pct')}.` : '.';
    }
    return { title, deck };
  }, [bundle, cfg, m.shortName]);

  const fyMix = useMemo(() => {
    const counts = new Map<number, number>();
    for (const c of bundle.companies) counts.set(c.fyEndMonth, (counts.get(c.fyEndMonth) ?? 0) + 1);
    const names: Record<number, string> = { 3: 'March', 6: 'June', 9: 'September', 12: 'December' };
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([mo, n]) => `${n} ${names[mo] ?? mo}`).join(' · ');
  }, [bundle.companies]);

  // ---------- trend series
  const trendPoints = (id: string) => {
    const a = bundle.aggregate(id);
    if (!a) return [];
    const last = a.latest ? a.points.findIndex((x) => x.p === a.latest) : a.points.length - 1;
    const pts = a.points.slice(0, last + 1).filter((x) => x.v !== null);
    return pts.slice(Math.max(0, pts.length - RANGE_N[range]));
  };
  const revAgg = bundle.aggregate(cfg.trend?.revenue ?? '');
  const proAgg = bundle.aggregate(cfg.trend?.profit ?? '');
  const revPts = trendPoints(cfg.trend?.revenue ?? '');
  const proPts = trendPoints(cfg.trend?.profit ?? '');
  const maxCos = Math.max(...m.coverage.map((c) => c.companies));
  const fullFrom = m.coverage.find((c) => c.companies === maxCos)?.period;
  const coverageNote = fullFrom && revPts.length && revPts[0].p < fullFrom
    ? `Totals before ${periodLabel(fullFrom)} cover fewer companies (${m.coverage.find((c) => c.period === revPts[0].p)?.companies ?? '–'} at the start of this range) because some listed later. Year-on-year changes compare the same companies in both periods.`
    : 'Year-on-year changes compare the same companies in both periods.';

  const makeCols = (a: Aggregate | null, pts: typeof revPts, name: string) =>
    columnsOverTime(palette, {
      name,
      unit: 'pkr_mn',
      highlightLast: true,
      source: `${pts.at(-1)?.n ?? ''} companies · financials to ${fmtDate(m.asOf.financials)}`,
      points: pts.map((x) => ({ p: x.p, v: x.v, yoy: x.yoy, yoyKind: a?.yoyKind, subtitle: `${x.n} of ${x.of} companies reporting` })),
    });

  const lastRev = revPts.at(-1), lastPro = proPts.at(-1);
  const revTitle = lastRev && lastRev.yoy !== null
    ? `Quarterly revenue reached ${fmt(lastRev.v, 'pkr_mn', { compact: true, currency: true })} in ${periodLabel(lastRev.p)}, ${fmtChange(lastRev.yoy, 'pct')} on a year earlier`
    : 'Sector revenue by quarter';
  const proTitle = lastPro && lastPro.yoy !== null
    ? `Net profit ${lastPro.yoy >= 0 ? 'grew' : 'fell'} ${fmt(Math.abs(lastPro.yoy), 'pct')} to ${fmt(lastPro.v, 'pkr_mn', { compact: true, currency: true })} in the quarter`
    : 'Sector net profit by quarter';

  // ---------- margins
  const marginIds = cfg.trend?.margins ?? [];
  const marginSeries = marginIds.map((id, i) => {
    const a = bundle.aggregate(id)!;
    const last = a.latest ? a.points.findIndex((x) => x.p === a.latest) : a.points.length - 1;
    const pts = a.points.slice(0, last + 1).filter((x) => x.v !== null);
    return {
      a,
      name: a.label.replace(' (TTM)', ''),
      color: [palette.data, palette.brand, palette.accent][i] ?? palette.data2,
      points: pts.slice(Math.max(0, pts.length - RANGE_N[range])).map((x) => ({ p: x.p, v: x.v, yoy: x.yoy, yoyKind: a.yoyKind })),
    };
  });
  const marginPeriods = [...new Set(marginSeries.flatMap((s) => s.points.map((x) => x.p)))].sort();
  const net = marginSeries.find((s) => /net/i.test(s.name)) ?? marginSeries.at(-1);
  const netLast = net?.points.at(-1);
  const marginTitle = net && netLast && netLast.yoy !== null && netLast.yoy !== undefined
    ? `${net.name} ${netLast.yoy >= 0 ? 'widened' : 'narrowed'} ${(Math.abs(netLast.yoy) * 100).toFixed(1)} percentage points in a year, to ${fmt(netLast.v, 'pct')}`
    : 'Sector margins over time';

  return (
    <div>
      {/* ------------------------------------------------ research note band */}
      <section className="bg-brand-deep text-on-deep">
        <div className="mx-auto grid max-w-[1280px] gap-10 px-4 pb-24 pt-10 sm:px-6 sm:pt-14 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-16 lg:px-8 lg:pb-28">
          <div className="rise">
            <h1 className="serif max-w-[22ch] text-[30px] font-semibold leading-[1.12] sm:text-[40px] lg:text-[44px]">{head.title}.</h1>
            {head.deck && <p className="mt-5 max-w-[62ch] text-[15.5px] leading-relaxed text-on-deep-muted sm:text-[17px]">{head.deck}</p>}
            <div className="mt-7 flex flex-wrap gap-2">
              <Link to={`/${slug}/valuation`} className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-5 text-[14px] font-semibold text-brand-deep transition-transform duration-150 hover:bg-white/90 active:scale-[0.97]">
                Who looks cheap? <ArrowRight aria-hidden className="size-4" />
              </Link>
              <Link to={`/${slug}/companies`} className="inline-flex h-10 items-center rounded-full border border-on-deep-line px-5 text-[14px] font-semibold text-on-deep transition-colors hover:bg-white/5">
                Browse {bundle.companies.length} companies
              </Link>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 self-end border-t border-on-deep-line pt-5 text-[13px] lg:grid-cols-1 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
            {[
              ['Companies covered', `${bundle.companies.length} PSX-listed`],
              ['Results to', `${periodLabel(m.asOf.financialsPeriod)} (${fmtDate(m.asOf.financials)})`],
              ['Balance sheets to', fmtDate(m.asOf.balanceSheet)],
              ['Prices to', fmtDate(m.asOf.prices)],
              ['Fiscal year-ends', fyMix],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-on-deep-muted">{k}</dt>
                <dd className="num mt-0.5 font-semibold text-on-deep">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        {/* ------------------------------------------------ KPI strip */}
        <section aria-label="Key sector figures" className="relative -mt-14 grid grid-cols-2 overflow-hidden rounded-xl border border-line bg-surface shadow-[0_1px_2px_rgba(16,26,21,0.04)] md:grid-cols-3 lg:grid-cols-5">
          {cfg.kpis.map((id, i) => {
            const a = bundle.aggregate(id);
            const pt = latestPoint(a);
            if (!a || !pt) return null;
            const idx = a.points.findIndex((x) => x.p === pt.p);
            const spark = a.points.slice(Math.max(0, idx - 11), idx + 1).map((x) => x.v);
            const t = a.direction === 'neutral' ? 'neutral' : tone(pt.yoy, a.direction);
            return (
              <div key={id} className={`flex flex-col border-line p-4 sm:p-5 ${i > 0 ? 'border-l' : ''} ${i >= 2 ? 'max-md:border-t' : ''} ${i === 4 ? 'max-md:col-span-2 max-lg:border-t' : ''} ${i === 2 ? 'max-md:border-l-0' : ''} ${i === 3 ? 'md:max-lg:border-l-0 md:max-lg:border-t' : ''}`}>
                <h2 className="text-[12.5px] font-medium text-muted">{a.label}</h2>
                <p className="num mt-2 whitespace-nowrap text-[21px] font-semibold leading-none tracking-[-0.02em] text-ink sm:text-[26px] xl:text-[28px]">
                  {fmt(pt.v, a.unit, { compact: true, currency: a.unit === 'pkr_mn' })}
                </p>
                <p className="mt-2 flex flex-wrap items-center gap-x-1.5 text-[11.5px] text-muted">
                  <Delta text={fmtChange(pt.yoy, a.yoyKind)} tone={t} size="xs" />
                  <span>vs a year earlier</span>
                </p>
                <div className="mt-3 h-9" aria-hidden>
                  <EChart option={sparkline(palette, spark, t === 'neg' ? palette.neg : palette.brand)} height={36} ariaLabel={`${a.label} trend, last 12 quarters`} />
                </div>
                <p className="mt-1.5 text-[11px] text-faint">{basisText(a, pt.p)}{pt.n < pt.of ? ` · ${pt.n} of ${pt.of} cos.` : ''}</p>
              </div>
            );
          })}
        </section>

        {/* ------------------------------------------------ revenue & profit */}
        <SectionHeading
          id="trend"
          title="Revenue and profit"
          lead="Quarterly totals across the sector. Each company is counted in the calendar quarter its results cover, so June and December year-ends line up."
          action={
            <Segmented<Range>
              label="Range"
              value={range}
              onChange={(v) => { setRange(v); track('insights_period_change', { sector: slug, view: 'trend', period: v }); }}
              options={[{ value: '12q', label: '3 years' }, { value: '20q', label: '5 years' }, { value: 'all', label: 'All' }]}
            />
          }
        />
        <div className="grid gap-5 lg:grid-cols-2">
          <Panel
            id="sector-revenue"
            title={revTitle}
            titleText={revTitle}
            subtitle={`Net sales, PKR, by calendar quarter · ${revPts.length} quarters`}
            downloadName={`${slug}_sector_revenue_by_quarter`}
            chart={(ref) => <EChart ref={ref} option={makeCols(revAgg, revPts, 'Sector revenue')} height={narrow ? 240 : 290} ariaLabel={revTitle} />}
            table={{
              rows: [...revPts].reverse(),
              rowKey: (r) => r.p,
              columns: [
                { key: 'p', header: 'Quarter', align: 'left', sticky: true, render: (r) => periodLabel(r.p), exportValue: (r) => periodLabel(r.p), sortValue: (r) => r.p },
                { key: 'v', header: 'Revenue', sub: 'PKR mn', render: (r) => fmt(r.v, 'pkr_mn'), exportValue: (r) => r.v, sortValue: (r) => r.v },
                { key: 'yoy', header: 'vs year earlier', sub: '%', render: (r) => <Delta text={fmtChange(r.yoy, 'pct')} tone={tone(r.yoy)} />, exportValue: (r) => (r.yoy === null ? null : +(r.yoy * 100).toFixed(2)), sortValue: (r) => r.yoy },
                { key: 'n', header: 'Companies', render: (r) => `${r.n} of ${r.of}`, exportValue: (r) => r.n, sortValue: (r) => r.n },
              ],
            }}
            notes={coverageNote}
          />
          <Panel
            id="sector-profit"
            title={proTitle}
            titleText={proTitle}
            subtitle={`Net profit attributable to owners, PKR, by calendar quarter · losses shown below zero`}
            downloadName={`${slug}_sector_profit_by_quarter`}
            chart={(ref) => <EChart ref={ref} option={makeCols(proAgg, proPts, 'Sector net profit')} height={narrow ? 240 : 290} ariaLabel={proTitle} />}
            table={{
              rows: [...proPts].reverse(),
              rowKey: (r) => r.p,
              columns: [
                { key: 'p', header: 'Quarter', align: 'left', sticky: true, render: (r) => periodLabel(r.p), exportValue: (r) => periodLabel(r.p), sortValue: (r) => r.p },
                { key: 'v', header: 'Net profit', sub: 'PKR mn', render: (r) => fmt(r.v, 'pkr_mn'), exportValue: (r) => r.v, sortValue: (r) => r.v },
                { key: 'yoy', header: 'vs year earlier', sub: '%', render: (r) => <Delta text={fmtChange(r.yoy, 'pct')} tone={tone(r.yoy)} />, exportValue: (r) => (r.yoy === null ? null : +(r.yoy * 100).toFixed(2)), sortValue: (r) => r.yoy },
                { key: 'n', header: 'Companies', render: (r) => `${r.n} of ${r.of}`, exportValue: (r) => r.n, sortValue: (r) => r.n },
              ],
            }}
            notes="A single large write-off can swing a quarter; the 12-month figures in the cards above smooth this out."
          />
        </div>

        <div className="mt-5">
          <Panel
            id="margins"
            title={marginTitle}
            titleText={marginTitle}
            subtitle="Sector gross, operating and net margin, trailing 12 months · sum of profits ÷ sum of sales"
            downloadName={`${slug}_sector_margins`}
            chart={(ref) => (
              <EChart
                ref={ref}
                option={linesOverTime(palette, { unit: 'pct', periods: marginPeriods, series: marginSeries, source: `Trailing 12 months · financials to ${fmtDate(m.asOf.financials)}`, endLabels: true, narrow })}
                height={narrow ? 260 : 320}
                ariaLabel={marginTitle}
              />
            )}
            table={{
              rows: [...marginPeriods].reverse(),
              rowKey: (r) => r,
              columns: [
                { key: 'p', header: 'Quarter', align: 'left' as const, sticky: true, render: (r: string) => periodLabel(r), exportValue: (r: string) => periodLabel(r), sortValue: (r: string) => r },
                ...marginSeries.map((s) => ({
                  key: s.a.id,
                  header: s.name,
                  sub: '%',
                  render: (r: string) => fmt(s.points.find((x) => x.p === r)?.v ?? null, 'pct'),
                  exportValue: (r: string) => { const v = s.points.find((x) => x.p === r)?.v; return v === null || v === undefined ? null : +(v * 100).toFixed(2); },
                  sortValue: (r: string) => s.points.find((x) => x.p === r)?.v ?? null,
                })),
              ],
            }}
            notes={narrow ? marginSeries.map((s) => `${s.name}: ${fmt(s.points.at(-1)?.v ?? null, 'pct')}`).join(' · ') : undefined}
          />
        </div>

        <LeagueTables onPick={(t) => nav(`/${slug}/company/${t}`)} />
        <LatestData />
        <Disclaimer />
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ league tables
function LeagueTables({ onPick }: { onPick: (ticker: string) => void }) {
  const { bundle, slug } = useSector();
  const { palette } = useTheme();
  const narrow = useNarrow();
  const ids = bundle.meta.config.leagueTables.filter((id) => bundle.has(id));
  const defaultP = bundle.latestCovered('Q', ids) ?? bundle.meta.quarters.at(-1)!;
  const [period, setPeriod] = useState(defaultP);
  const options = [...bundle.meta.quarters].reverse().slice(0, 16).map((q) => ({ value: q, label: `${periodLabel(q)}${q === defaultP ? ' (latest complete)' : ''}` }));
  const onEvents = useMemo(() => ({ click: (e: unknown) => { const name = (e as { name?: string }).name; if (name) onPick(name); } }), [onPick]);

  return (
    <>
      <SectionHeading
        id="league"
        title="League tables"
        lead="Who leads the sector on growth, profitability, returns and balance-sheet strength. Click a bar to open the company."
        action={<Select label="Quarter" value={period} onChange={(v) => { setPeriod(v); track('insights_period_change', { sector: slug, view: 'league', period: v }); }} options={options} />}
      />
      <div className="grid gap-5 md:grid-cols-2">
        {ids.map((id) => {
          const def = bundle.metric(id);
          const rows = bundle.cross(period, id).map((r) => ({ ticker: r.ticker, name: r.name, v: r.v, s: r.s }));
          const ok = rows.filter((r) => r.v !== null);
          const sorted = [...ok].sort((a, b) => (def.direction === 'lower' ? a.v! - b.v! : b.v! - a.v!));
          const med = bundle.medianSeries(id, [period])[0].v;
          const leader = sorted[0];
          const missing = rows.filter((r) => r.v === null);
          const title = leader
            ? `${leader.ticker} leads on ${lowerLabel(def.label.replace(' (TTM)', ''))} at ${fmt(leader.v, def.unit)}`
            : `${def.label}: no data for ${periodLabel(period)}`;
          const periodText = `${periodLabel(period)}${id.includes('ttm') ? ', trailing 12 months' : ''}`;
          return (
            <Panel
              key={id}
              id={`league-${id}`}
              title={title}
              titleText={title}
              subtitle={`${def.label} · ${periodText} · sector median ${fmt(med, def.unit)}`}
              downloadName={`${slug}_${id}_${period}`}
              chart={(ref) =>
                ok.length ? (
                  <EChart
                    ref={ref}
                    option={rankedBars(palette, { rows, unit: def.unit, direction: def.direction, median: med, source: `Financials to ${fmtDate(bundle.meta.asOf.financials)}`, periodText, metricName: def.label, limit: narrow ? 8 : undefined })}
                    height={Math.max(220, (narrow ? Math.min(8, ok.length) : ok.length) * 24 + 40)}
                    ariaLabel={title}
                    onEvents={onEvents}
                  />
                ) : (
                  <p className="px-4 py-16 text-center text-[13px] text-muted">No company has reported this figure for {periodLabel(period)} yet. Pick an earlier quarter.</p>
                )
              }
              table={{
                rows: sorted,
                rowKey: (r) => r.ticker,
                columns: [
                  { key: 'rank', header: '#', align: 'left', render: (r) => sorted.indexOf(r) + 1, exportValue: (r) => sorted.indexOf(r) + 1 },
                  { key: 'ticker', header: 'Company', align: 'left', sticky: true, render: (r) => <span><b className="font-semibold text-ink">{r.ticker}</b> <span className="text-muted">{r.name}</span></span>, exportValue: (r) => `${r.ticker} · ${r.name}`, sortValue: (r) => r.ticker },
                  { key: 'v', header: def.label, sub: def.unit === 'pkr_mn' ? 'PKR mn' : def.unit === 'pct' ? '%' : def.unit === 'rs' ? 'Rs' : 'x', render: (r) => fmt(r.v, def.unit), exportValue: (r) => (def.unit === 'pct' ? +(r.v! * 100).toFixed(2) : +r.v!.toFixed(2)), sortValue: (r) => r.v },
                ],
                onRowClick: (r) => onPick(r.ticker),
              }}
              notes={missing.length ? `Not shown: ${missing.map((r) => `${r.ticker} (${r.s === 'nobs' ? 'no balance sheet yet' : r.s === 'nm' ? 'not meaningful' : 'n/a'})`).join(', ')}.` : narrow && ok.length > 8 ? `Top 8 of ${ok.length} shown; switch to the table for all.` : undefined}
            />
          );
        })}
      </div>
    </>
  );
}

// ------------------------------------------------------------------ latest data
function LatestData() {
  const { bundle, slug } = useSector();
  const nav = useNavigate();
  const m = bundle.meta;
  const rows = [...bundle.companies].sort((a, b) => (b.lastQuarter ?? '').localeCompare(a.lastQuarter ?? '') || a.ticker.localeCompare(b.ticker));
  const latestQ = m.asOf.financialsPeriod;
  const reported = rows.filter((c) => c.lastQuarter === latestQ).length;
  const withBS = rows.filter((c) => c.lastBalanceSheet === latestQ).length;
  const title = `${reported} of ${rows.length} companies have reported ${periodLabel(latestQ)}; ${withBS} of them with a balance sheet`;
  const filings = m.filings;
  return (
    <>
      <SectionHeading
        id="latest"
        title={filings ? 'Latest filings' : 'Latest results loaded'}
        lead={filings ? 'Most recent company filings in this sector.' : 'What each company has filed so far, and how fresh its numbers are. Ratios that need a balance sheet show “—” until it is filed.'}
      />
      {filings ? (
        <Panel
          id="filings"
          title={`${filings.length} filings, latest on ${fmtDate(filings[0]?.date ?? m.asOf.financials)}`}
          titleText="Latest filings"
          subtitle="Company announcements and results"
          downloadName={`${slug}_latest_filings`}
          tableFirst
          table={{
            rows: filings.slice(0, 30),
            rowKey: (r) => `${r.ticker}${r.date}${r.title}`,
            columns: [
              { key: 'date', header: 'Date', align: 'left', render: (r) => fmtDate(r.date), exportValue: (r) => r.date, sortValue: (r) => r.date },
              { key: 't', header: 'Company', align: 'left', render: (r) => <b className="font-semibold">{r.ticker}</b>, exportValue: (r) => r.ticker, sortValue: (r) => r.ticker },
              { key: 'title', header: 'Filing', align: 'left', render: (r) => (r.url ? <a className="text-brand-ink underline decoration-line-strong underline-offset-2 hover:decoration-brand" href={r.url} target="_blank" rel="noreferrer">{r.title}</a> : r.title), exportValue: (r) => r.title },
            ],
            initialSort: { key: 'date', dir: 'desc' },
          }}
        />
      ) : (
        <Panel
          id="latest-data"
          title={title}
          titleText={title}
          subtitle={`Latest quarter loaded per company · financials to ${fmtDate(m.asOf.financials)}`}
          downloadName={`${slug}_latest_results_loaded`}
          tableFirst
          table={{
            rows,
            rowKey: (r) => r.ticker,
            onRowClick: (r) => nav(`/${slug}/company/${r.ticker}`),
            columns: [
              { key: 'c', header: 'Company', align: 'left', sticky: true, minWidth: 200, render: (r) => <span><b className="font-semibold text-ink">{r.ticker}</b> <span className="text-muted">{r.name}</span></span>, exportValue: (r) => `${r.ticker} · ${r.name}`, sortValue: (r) => r.ticker },
              { key: 'q', header: 'Latest results', align: 'left', render: (r) => (r.lastQuarter ? periodLabel(r.lastQuarter) : '—'), exportValue: (r) => (r.lastQuarter ? periodLabel(r.lastQuarter) : ''), sortValue: (r) => r.lastQuarter },
              { key: 'fq', header: 'Company’s own period', align: 'left', render: (r) => (r.lastQuarter ? fiscalQuarter(r.lastQuarter, r.fyEndMonth) : '—'), exportValue: (r) => (r.lastQuarter ? fiscalQuarter(r.lastQuarter, r.fyEndMonth) : '') },
              { key: 'bs', header: 'Balance sheet to', align: 'left', render: (r) => (r.lastBalanceSheet ? <span className={r.lastBalanceSheet === r.lastQuarter ? '' : 'text-accent-ink'}>{periodLabel(r.lastBalanceSheet)}</span> : '—'), exportValue: (r) => (r.lastBalanceSheet ? periodLabel(r.lastBalanceSheet) : ''), sortValue: (r) => r.lastBalanceSheet },
              { key: 'h', header: 'History', render: (r) => `${r.quarters} qtrs`, exportValue: (r) => r.quarters, sortValue: (r) => r.quarters },
              { key: 'px', header: 'Prices to', align: 'left', render: (r) => (r.price ? fmtDate(r.price.to) : '—'), exportValue: (r) => r.price?.to ?? '', sortValue: (r) => r.price?.to ?? null },
            ],
          }}
          notes="Company filing dates and links will appear here when the research workbook includes an optional “Filings” sheet."
        />
      )}
    </>
  );
}
