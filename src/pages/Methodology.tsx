import { useEffect } from 'react';
import { useSector } from '../lib/sector-context';
import { fmtDate } from '../lib/format';
import { fyMonthName, periodLabel } from '../lib/periods';
import { Disclaimer, PageIntro, Panel, SectionHeading } from '../components/ui/Panel';

const DASHBOARD_RULES: { term: string; text: string }[] = [
  { term: 'Calendar quarters', text: 'Every company is placed in the calendar quarter its results cover (Mar, Jun, Sep, Dec), whatever its own fiscal year. Tooltips and tables also show the company’s own fiscal label, e.g. 1QFY27 for a June year-end company’s September quarter.' },
  { term: 'Sector totals', text: 'Sector revenue and profit are the sum of every company that reported for that quarter. Twelve-month (TTM) totals add each company’s last four quarters. When a company joins the data later (e.g. a new listing), totals step up; year-on-year changes therefore compare only companies present in both periods.' },
  { term: 'Sector margins and ROE', text: 'Calculated from sums, not averages of ratios: sector net margin = total TTM profit ÷ total TTM sales; sector ROE = total TTM profit ÷ the average of total equity now and a year earlier. Companies without the needed figures are left out of both numerator and denominator.' },
  { term: 'Sector medians', text: 'Median P/E and P/B use companies with a positive value only. Loss-making companies (P/E not meaningful) are excluded rather than counted as zero.' },
  { term: 'Latest complete period', text: 'Views default to the latest quarter (or fiscal year) for which at least three quarters of the companies have the figures shown. A more recent, partial period can still be selected.' },
  { term: 'Missing balance sheets', text: 'Some quarterly results are published before the balance sheet. Until it is filed, balance-sheet figures and ratios that use them (net cash, debt to equity, ROE, ROA, P/B) show “—” instead of zero.' },
  { term: 'Outliers', text: 'Charts clip extreme values (for example a P/E above 100x or growth from a very small base) so the rest of the sector stays readable. Clipped points are pinned to the chart edge and labelled with their true value; tables always show the exact figure.' },
  { term: 'Hover values and downloads', text: 'Hover values, tables and CSV/Excel downloads show the workbook figures unrounded except for display. Chart images carry the title, source and as-of date. Daily price series are view-only.' },
];

export default function Methodology() {
  const { bundle } = useSector();
  const m = bundle.meta;
  useEffect(() => { document.title = `Methodology: ${m.name} | Insight Securities Insights`; }, [m.name]);
  const defs = m.notes.definitions;
  return (
    <div>
      <PageIntro
        title="Methodology"
        lead="How every figure on these pages is calculated, where it comes from, and what n/a, n/m and the gaps mean."
        meta={<><span>Source workbook: {m.source.file}</span><span>Converted {fmtDate(m.generatedAt.slice(0, 10))}</span></>}
      />
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        <div className="grid gap-x-16 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div>
            <SectionHeading title="Ratio definitions" lead="Taken word for word from the research team's workbook, so the dashboard and the spreadsheet always agree." />
            <dl className="divide-y divide-line rounded-xl border border-line bg-surface">
              {defs.map((d) => (
                <div key={d.term} className="grid gap-1 px-5 py-4 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-6">
                  <dt className="text-[13.5px] font-semibold text-ink">{d.term}</dt>
                  <dd className="prose-measure text-[13.5px] leading-relaxed text-ink-2">{d.text}</dd>
                </div>
              ))}
            </dl>

            <SectionHeading title="How the dashboard uses the data" lead="Rules applied on top of the workbook when combining companies into a sector view." />
            <dl className="divide-y divide-line rounded-xl border border-line bg-surface">
              {DASHBOARD_RULES.map((d) => (
                <div key={d.term} className="grid gap-1 px-5 py-4 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-6">
                  <dt className="text-[13.5px] font-semibold text-ink">{d.term}</dt>
                  <dd className="prose-measure text-[13.5px] leading-relaxed text-ink-2">{d.text}</dd>
                </div>
              ))}
            </dl>

            {m.notes.sheetNotes.length > 0 && (
              <>
                <SectionHeading title="Notes from the workbook" />
                <ul className="space-y-3">
                  {m.notes.sheetNotes.map((n) => (
                    <li key={n.sheet + n.text.slice(0, 20)} className="rounded-xl border border-line bg-surface px-5 py-4 text-[13.5px] leading-relaxed text-ink-2">
                      <span className="mr-2 font-semibold text-ink">{n.sheet.replace('_', ' ')}.</span>{n.text}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          <aside className="lg:pt-[7.5rem]">
            <div className="space-y-5 lg:sticky lg:top-20">
              <div className="rounded-xl border border-line bg-surface p-5">
                <h2 className="text-[15px] font-semibold text-ink">Data as of</h2>
                <dl className="mt-3 space-y-2.5 text-[13px]">
                  {[
                    ['Results', `${periodLabel(m.asOf.financialsPeriod)}, quarter to ${fmtDate(m.asOf.financials)}`],
                    ['Balance sheets', fmtDate(m.asOf.balanceSheet)],
                    ['Share prices', fmtDate(m.asOf.prices)],
                    ['Workbook', m.source.file],
                    ['Fingerprint', m.source.sha256.slice(0, 12)],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4">
                      <dt className="text-muted">{k}</dt>
                      <dd className="num text-right font-medium text-ink">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div className="rounded-xl border border-line bg-surface p-5">
                <h2 className="text-[15px] font-semibold text-ink">Markers</h2>
                <dl className="mt-3 space-y-3 text-[13px] leading-snug">
                  <div><dt className="num inline font-semibold text-ink">n/a </dt><dd className="inline text-ink-2">Not enough data yet, e.g. trailing figures need four quarters, growth needs a prior period.</dd></div>
                  <div><dt className="num inline font-semibold text-ink">n/m </dt><dd className="inline text-ink-2">Not meaningful: a loss in this or the comparison period (e.g. P/E of a loss-maker).</dd></div>
                  <div><dt className="num inline font-semibold text-ink">— </dt><dd className="inline text-ink-2">Not reported for this period, or the balance sheet is not yet filed.</dd></div>
                </dl>
              </div>
            </div>
          </aside>
        </div>

        <SectionHeading title="Coverage by company" lead="Each company is compiled on its own fiscal year. Shorter histories reflect later listings or data availability." />
        <Panel
          title={`${bundle.companies.length} companies, ${bundle.companies.filter((c) => c.fyEndMonth === 6).length} with June year-ends`}
          titleText="Coverage by company"
          subtitle="Quarterly history, fiscal year-end and latest data loaded"
          downloadName={`${m.slug}_coverage`}
          tableFirst
          table={{
            rows: bundle.companies,
            rowKey: (c) => c.ticker,
            columns: [
              { key: 'c', header: 'Company', align: 'left', sticky: true, render: (c) => <span><b className="font-semibold">{c.ticker}</b> <span className="text-muted">{c.name}</span></span>, exportValue: (c) => `${c.ticker} · ${c.name}`, sortValue: (c) => c.ticker },
              { key: 'fy', header: 'FY ends', align: 'left', render: (c) => fyMonthName(c.fyEndMonth), exportValue: (c) => fyMonthName(c.fyEndMonth), sortValue: (c) => c.fyEndMonth },
              { key: 'from', header: 'First quarter', align: 'left', render: (c) => (c.firstQuarter ? periodLabel(c.firstQuarter) : '—'), exportValue: (c) => (c.firstQuarter ? periodLabel(c.firstQuarter) : ''), sortValue: (c) => c.firstQuarter },
              { key: 'to', header: 'Latest quarter', align: 'left', render: (c) => (c.lastQuarter ? periodLabel(c.lastQuarter) : '—'), exportValue: (c) => (c.lastQuarter ? periodLabel(c.lastQuarter) : ''), sortValue: (c) => c.lastQuarter },
              { key: 'n', header: 'Quarters', render: (c) => c.quarters, exportValue: (c) => c.quarters, sortValue: (c) => c.quarters },
              { key: 'sh', header: 'Shares', sub: 'mn', render: (c) => c.sharesOutstandingMn.toLocaleString('en-US'), exportValue: (c) => c.sharesOutstandingMn, sortValue: (c) => c.sharesOutstandingMn },
              { key: 'px', header: 'Price history', align: 'left', render: (c) => (c.price ? `${fmtDate(c.price.from, 'short')} – ${fmtDate(c.price.to, 'short')}` : '—'), exportValue: (c) => (c.price ? `${c.price.from} to ${c.price.to}` : '') },
            ],
          }}
        />
        <Disclaimer />
      </div>
    </div>
  );
}
