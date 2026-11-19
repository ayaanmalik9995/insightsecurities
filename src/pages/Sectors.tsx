import { use, useEffect } from 'react';
import { Link } from 'react-router';
import { ArrowRight, Clock3 } from 'lucide-react';
import { useSector } from '../lib/sector-context';
import { useTheme } from '../lib/theme';
import { loadSector, type SectorBundle } from '../lib/data';
import { fmt, fmtChange, fmtDate } from '../lib/format';
import { periodMonth } from '../lib/periods';
import { tone } from '../components/charts/style';
import { EChart } from '../components/charts/EChart';
import { sparkline } from '../components/charts/builders';
import { Delta } from '../components/ui/controls';
import { Disclaimer, PageIntro, Panel, SectionHeading } from '../components/ui/Panel';
import type { SectorEntry } from '../lib/types';

/** Cross-sector overview: one card per sector, and a comparison table that fills in as sectors go live. */
export default function Sectors() {
  const { registry } = useSector();
  useEffect(() => { document.title = 'All sectors | Insight Securities Insights'; }, []);
  const live = registry.sectors.filter((s) => s.status === 'live');
  const bundles = live.map((s) => use(loadSector(s.slug)));
  const soon = registry.sectors.filter((s) => s.status === 'coming_soon');

  return (
    <div>
      <PageIntro
        title="PSX sectors"
        lead={`${live.length} sector${live.length === 1 ? ' is' : 's are'} live, with ${soon.length} more on the way. Each sector page is built from the research team's own workbook.`}
      />
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {bundles.map((b) => <LiveCard key={b.meta.slug} b={b} />)}
          {soon.map((s) => <SoonCard key={s.slug} s={s} />)}
        </div>

        <SectionHeading title="Sectors compared" lead="Twelve-month figures for every live sector. New sectors appear here automatically when their workbook is published." />
        <Panel
          title={live.length > 1 ? 'How the live sectors compare' : `${live[0]?.name ?? 'Sector'} is the first sector live; others join this table as they launch`}
          titleText="Sectors compared"
          subtitle="Latest complete quarter for each sector · trailing 12 months"
          downloadName="sectors_compared"
          tableFirst
          table={{
            rows: bundles,
            rowKey: (b) => b.meta.slug,
            columns: [
              { key: 's', header: 'Sector', align: 'left', sticky: true, render: (b) => <Link to={`/${b.meta.slug}`} className="font-semibold text-ink hover:text-brand-ink">{b.meta.name}</Link>, exportValue: (b) => b.meta.name, sortValue: (b) => b.meta.name },
              { key: 'n', header: 'Companies', render: (b) => b.companies.length, exportValue: (b) => b.companies.length, sortValue: (b) => b.companies.length },
              ...b0cols(bundles[0]),
              { key: 'asof', header: 'Results to', align: 'left', render: (b) => fmtDate(b.meta.asOf.financials), exportValue: (b) => b.meta.asOf.financials },
            ],
          }}
        />
        <Disclaimer />
      </div>
    </div>
  );
}

function aggLatest(b: SectorBundle, id: string) {
  const a = b.aggregate(id);
  return a ? a.points.find((p) => p.p === a.latest) ?? null : null;
}

function b0cols(first: SectorBundle | undefined) {
  if (!first) return [];
  return first.meta.config.kpis.map((id) => {
    const a = first.aggregate(id)!;
    return {
      key: id,
      header: a.label,
      render: (b: SectorBundle) => fmt(aggLatest(b, id)?.v ?? null, a.unit, { compact: true, currency: a.unit === 'pkr_mn' }),
      exportValue: (b: SectorBundle) => { const v = aggLatest(b, id)?.v ?? null; return v === null ? null : a.unit === 'pct' ? +(v * 100).toFixed(2) : +v.toFixed(2); },
      sortValue: (b: SectorBundle) => aggLatest(b, id)?.v ?? null,
    };
  });
}

function LiveCard({ b }: { b: SectorBundle }) {
  const { palette } = useTheme();
  const kpis = b.meta.config.kpis.slice(0, 4);
  const prof = b.aggregate(b.meta.config.headline?.profit ?? '');
  const pp = prof ? prof.points.find((x) => x.p === prof.latest) : null;
  const idx = prof && pp ? prof.points.indexOf(pp) : -1;
  return (
    <Link to={`/${b.meta.slug}`} className="group flex flex-col rounded-xl border border-line bg-surface p-5 transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-line-strong">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-[17px] font-semibold text-ink"><span aria-hidden className="size-2 rounded-full bg-brand" />{b.meta.name}</h2>
          <p className="mt-1 text-[12.5px] text-muted">{b.companies.length} companies · results to {fmtDate(b.meta.asOf.financials)}</p>
        </div>
        <ArrowRight aria-hidden className="mt-1 size-4 text-faint transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-brand-ink" />
      </div>
      {prof && pp && (
        <div className="mt-4 h-14">
          <EChart option={sparkline(palette, prof.points.slice(Math.max(0, idx - 11), idx + 1).map((x) => x.v), palette.brand)} height={56} ariaLabel={`${prof.label} trend`} />
        </div>
      )}
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-4">
        {kpis.map((id) => {
          const a = b.aggregate(id)!;
          const pt = a.points.find((x) => x.p === a.latest);
          return (
            <div key={id}>
              <dt className="text-[11.5px] text-muted">{a.label}</dt>
              <dd className="num mt-0.5 flex items-baseline gap-1.5 text-[15px] font-semibold text-ink">
                {fmt(pt?.v ?? null, a.unit, { compact: true, currency: a.unit === 'pkr_mn' })}
                <Delta size="xs" text={fmtChange(pt?.yoy ?? null, a.yoyKind)} tone={a.direction === 'neutral' ? 'neutral' : tone(pt?.yoy ?? null, a.direction)} />
              </dd>
            </div>
          );
        })}
      </dl>
      {pp && <p className="mt-4 text-[11px] text-faint">Twelve months to {periodMonth(pp.p)}</p>}
    </Link>
  );
}

function SoonCard({ s }: { s: SectorEntry }) {
  return (
    <div className="flex flex-col rounded-xl border border-dashed border-line-strong bg-surface-2 p-5">
      <h2 className="flex items-center gap-2 text-[17px] font-semibold text-muted"><span aria-hidden className="size-2 rounded-full bg-line-strong" />{s.name}</h2>
      <p className="mt-2 text-[13px] leading-relaxed text-muted">{s.description}</p>
      <p className="mt-auto inline-flex items-center gap-1.5 pt-6 text-[12px] font-semibold text-faint"><Clock3 aria-hidden className="size-3.5" /> Coming soon</p>
    </div>
  );
}
