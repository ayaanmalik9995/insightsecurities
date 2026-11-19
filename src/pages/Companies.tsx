import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useSector } from '../lib/sector-context';
import { fmt, fmtChange, fmtDate, STATUS_HELP, STATUS_TEXT, UNIT_LABEL } from '../lib/format';
import { fyMonthName, periodLabel } from '../lib/periods';
import { tone } from '../components/charts/style';
import { Delta } from '../components/ui/controls';
import { Disclaimer, PageIntro, Panel } from '../components/ui/Panel';
import type { Column } from '../components/ui/DataTable';
import type { Cell } from '../lib/types';

interface Row {
  ticker: string;
  name: string;
  fy: number;
  last: number | null;
  day: number | null;
  latest: string | null;
  cells: Record<string, Cell & { p?: string }>;
}

/** Directory of every company in the sector with its latest key figures. */
export default function Companies() {
  const { bundle, slug } = useSector();
  const nav = useNavigate();
  const m = bundle.meta;
  useEffect(() => { document.title = `Companies: ${m.name} | Insight Securities Insights`; }, [m.name]);
  const stats = m.config.companyCharts?.stats.filter((s) => bundle.has(s)) ?? [];
  const extra = ['ttm_revenue_growth'].filter((s) => bundle.has(s) && !stats.includes(s));
  const ids = [...stats, ...extra];

  const rows: Row[] = useMemo(() => bundle.companies.map((c) => {
    const qs = bundle.periodsFor(c.ticker, 'Q');
    const cells: Row['cells'] = {};
    for (const id of ids) {
      cells[id] = { v: null, s: 'blank' };
      for (let i = qs.length - 1; i >= Math.max(0, qs.length - 2); i--) {
        const cell = bundle.cell(c.ticker, qs[i], id);
        if (cell.s === 'ok' || i === Math.max(0, qs.length - 2)) { cells[id] = { ...cell, p: qs[i] }; if (cell.s === 'ok') break; }
      }
    }
    return { ticker: c.ticker, name: c.name, fy: c.fyEndMonth, last: c.price?.last ?? null, day: c.price?.prev ? c.price.last / c.price.prev - 1 : null, latest: c.lastQuarter, cells };
  }), [bundle, ids.join()]);

  const mcAgg = bundle.aggregate('market_cap');
  const mcPt = mcAgg?.points.find((p) => p.p === mcAgg.latest);
  const biggest = [...rows].sort((a, b) => (b.cells.market_cap?.v ?? 0) - (a.cells.market_cap?.v ?? 0))[0];

  const cols: Column<Row>[] = [
    { key: 'c', header: 'Company', align: 'left', sticky: true, minWidth: 220, render: (r) => <span><b className="font-semibold text-ink">{r.ticker}</b><span className="ml-2 text-muted">{r.name}</span></span>, exportValue: (r) => `${r.ticker} · ${r.name}`, sortValue: (r) => r.ticker },
    { key: 'fy', header: 'FY end', align: 'left', render: (r) => <span className="text-muted">{fyMonthName(r.fy).slice(0, 3)}</span>, exportValue: (r) => fyMonthName(r.fy), sortValue: (r) => r.fy },
    { key: 'px', header: 'Last close', sub: 'Rs', render: (r) => fmt(r.last, 'rs', { currency: false }), exportValue: (r) => r.last, sortValue: (r) => r.last },
    { key: 'd', header: 'Day', sub: '%', render: (r) => <Delta text={fmtChange(r.day, 'pct')} tone={tone(r.day)} size="xs" />, exportValue: (r) => (r.day === null ? null : +(r.day * 100).toFixed(2)), sortValue: (r) => r.day },
    ...ids.map((id): Column<Row> => {
      const def = bundle.metric(id);
      return {
        key: id,
        header: def.label.replace(' (TTM)', ''),
        exportHeader: def.label,
        sub: `${UNIT_LABEL[def.unit]}${def.label.includes('TTM') ? ' · TTM' : ''}`,
        render: (r) => {
          const c = r.cells[id];
          if (c.s !== 'ok') return <span className="text-faint">{STATUS_TEXT[c.s]}</span>;
          return <span className={c.v! < 0 && def.direction !== 'neutral' ? 'text-neg' : ''}>{fmt(c.v, def.unit, { compact: def.unit === 'pkr_mn' })}</span>;
        },
        title: (r) => (r.cells[id].s !== 'ok' ? STATUS_HELP[r.cells[id].s] : r.cells[id].p ? periodLabel(r.cells[id].p!) : undefined),
        exportValue: (r) => { const c = r.cells[id]; return c.s === 'ok' ? (def.unit === 'pct' ? +(c.v! * 100).toFixed(2) : +c.v!.toFixed(2)) : null; },
        sortValue: (r) => (r.cells[id].s === 'ok' ? r.cells[id].v : null),
      };
    }),
    { key: 'q', header: 'Results to', align: 'left', render: (r) => <span className="text-muted">{r.latest ? periodLabel(r.latest) : '—'}</span>, exportValue: (r) => (r.latest ? periodLabel(r.latest) : ''), sortValue: (r) => r.latest },
  ];

  return (
    <div>
      <PageIntro
        title="Companies"
        lead={mcPt?.v ? <>{bundle.companies.length} listed companies worth <b className="num font-semibold text-ink">{fmt(mcPt.v, 'pkr_mn', { compact: true, currency: true })}</b> together; {biggest?.ticker} is the largest at {fmt(biggest?.cells.market_cap?.v ?? null, 'pkr_mn', { compact: true, currency: true })}.</> : undefined}
        meta={<><span>Market cap uses the average price of the latest quarter</span><span>Prices to {fmtDate(m.asOf.prices)}</span></>}
      />
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        <div className="mt-8">
          <Panel
            id="directory"
            title="Every company at a glance"
            titleText={`${m.name} companies at a glance`}
            subtitle="Latest quarter for each company; hover a figure for its period. Click a row to open the company."
            usesPrices
            downloadName={`${slug}_companies`}
            tableFirst
            table={{ rows, rowKey: (r) => r.ticker, columns: cols, initialSort: { key: 'market_cap', dir: 'desc' }, onRowClick: (r) => nav(`/${slug}/company/${r.ticker}`) }}
            notes="Where a company has not yet filed its latest balance sheet, balance-sheet ratios fall back to the previous quarter (shown on hover)."
          />
        </div>
        <Disclaimer />
      </div>
    </div>
  );
}
