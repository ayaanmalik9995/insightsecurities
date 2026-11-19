import { useRef, useState, type ReactNode } from 'react';
import { BarChart3, Table2 } from 'lucide-react';
import { DownloadMenu, Segmented, type DownloadAction } from './controls';
import { DataTable, tableExport, type Column } from './DataTable';
import type { EChartHandle } from '../charts/EChart';
import { downloadChartPNG, downloadCSV, downloadXLSX } from '../../lib/download';
import { useSector, sourceLine } from '../../lib/sector-context';
import { useTheme } from '../../lib/theme';

export interface PanelTable<R> {
  columns: Column<R>[];
  rows: R[];
  rowKey: (r: R) => string;
  initialSort?: { key: string; dir: 'asc' | 'desc' };
  footerRows?: { key: string; cells: Record<string, ReactNode>; label: ReactNode }[];
  onRowClick?: (r: R) => void;
  rowClass?: (r: R) => string;
  maxHeight?: number;
}

interface Props<R> {
  id?: string;
  /** The finding, written as a sentence. */
  title: ReactNode;
  /** Plain-text title for downloads and screen readers. */
  titleText: string;
  /** Metric · unit · period. */
  subtitle: string;
  controls?: ReactNode;
  /** Chart body; receives a ref to wire up PNG export. */
  chart?: (ref: React.RefObject<EChartHandle | null>) => ReactNode;
  table?: PanelTable<R>;
  /** Show the table by default (table-first panels). */
  tableFirst?: boolean;
  /** Notes under the body (n/m explanations, clipped values, coverage). */
  notes?: ReactNode;
  /** Extra provenance, e.g. "prices" for valuation panels. */
  usesPrices?: boolean;
  downloadName: string;
  className?: string;
  /** Allow image download (price series are view-only). */
  allowPng?: boolean;
  allowData?: boolean;
}

/** A section card: insight title, controls, chart or table, notes, source line. */
export function Panel<R>({ id, title, titleText, subtitle, controls, chart, table, tableFirst, notes, usesPrices, downloadName, className = '', allowPng = true, allowData = true }: Props<R>) {
  const { bundle, slug } = useSector();
  const { palette } = useTheme();
  const ref = useRef<EChartHandle | null>(null);
  const [view, setView] = useState<'chart' | 'table'>(tableFirst || !chart ? 'table' : 'chart');
  const src = sourceLine(bundle, { prices: usesPrices, financials: true });

  const actions: DownloadAction[] = [];
  if (chart && allowPng && view === 'chart') {
    actions.push({
      kind: 'png',
      run: async () => {
        const inst = ref.current?.instance();
        if (inst) await downloadChartPNG(inst, { name: downloadName, title: titleText, subtitle, footer: src, background: palette.surface, ink: palette.ink, muted: palette.muted, sector: slug });
      },
    });
  }
  if (table && allowData) {
    const exp = () => ({ name: downloadName, title: `${titleText} (${subtitle})`, ...tableExport(table.columns, table.rows), footer: [src, 'For information only; not investment advice. See the disclaimer at insights.insightsec.com.pk.'] });
    actions.push({ kind: 'csv', run: () => downloadCSV(exp(), slug) }, { kind: 'xlsx', run: () => downloadXLSX(exp(), slug) });
  }

  return (
    <section id={id} aria-labelledby={id ? `${id}-title` : undefined} className={`flex min-w-0 flex-col rounded-xl border border-line bg-surface ${className}`}>
      <header className="flex flex-col gap-3 px-4 pt-4 sm:px-6 sm:pt-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 max-w-[62ch] flex-1">
          <h3 id={id ? `${id}-title` : undefined} className="serif text-[19px] font-semibold leading-snug text-ink sm:text-[21px]">{title}</h3>
          <p className="mt-1 text-[12.5px] text-muted">{subtitle}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
          {controls}
          {chart && table && (
            <Segmented
              label="Show as"
              size="sm"
              value={view}
              onChange={setView}
              options={[
                { value: 'chart', label: <><BarChart3 aria-hidden className="size-3.5" /><span className="sr-only sm:not-sr-only">Chart</span></>, title: 'Chart' },
                { value: 'table', label: <><Table2 aria-hidden className="size-3.5" /><span className="sr-only sm:not-sr-only">Table</span></>, title: 'Table' },
              ]}
            />
          )}
          <DownloadMenu actions={actions} />
        </div>
      </header>
      <div className="min-w-0 flex-1 px-2 pb-2 pt-3 sm:px-4">
        {view === 'chart' && chart ? chart(ref) : table ? (
          <div className="px-2 pb-2 sm:px-2">
            <DataTable caption={titleText} {...table} />
          </div>
        ) : null}
      </div>
      <footer className="mt-auto border-t border-line px-4 py-3 text-[11.5px] leading-relaxed text-muted sm:px-6">
        {notes && <div className="mb-1.5 text-ink-2">{notes}</div>}
        <p>{src}. For information only; not investment advice.</p>
      </footer>
    </section>
  );
}

/** Page section heading (between groups of panels). */
export function SectionHeading({ id, title, lead, action }: { id?: string; title: string; lead?: ReactNode; action?: ReactNode }) {
  return (
    <div id={id} className="mb-5 mt-14 flex flex-col gap-2 sm:mt-16 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-[70ch]">
        <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-ink sm:text-[26px]">{title}</h2>
        {lead && <p className="mt-1.5 text-[14px] leading-relaxed text-muted">{lead}</p>}
      </div>
      {action}
    </div>
  );
}

const DISCLAIMER =
  'This page is published by Insight Securities (Pvt.) Ltd for general information only. It is not investment advice, a recommendation, or an offer to buy or sell any security. Figures are compiled from company financial statements and Pakistan Stock Exchange prices by our research team and may contain errors or be revised. Valuation ratios use average prices and current share counts as described in the methodology. Past performance is not a reliable indicator of future results. Investors should seek independent advice before making investment decisions.';

/** Compliance block placed at the foot of every page section. Wording is a placeholder until supplied by Compliance. */
export function Disclaimer({ compact }: { compact?: boolean }) {
  return (
    <aside aria-label="Disclaimer" className={`rounded-xl border border-dashed border-line-strong bg-surface-2 text-muted ${compact ? 'px-4 py-3 text-[11.5px]' : 'mt-10 px-5 py-4 text-[12px] sm:px-6'}`}>
      <p className="leading-relaxed">
        <strong className="font-semibold text-ink-2">Disclaimer. </strong>
        {DISCLAIMER}
        <span className="ml-1.5 inline-flex rounded-full bg-accent-soft px-1.5 py-px align-middle text-[10px] font-semibold text-accent-ink" title="Final wording to be supplied by Insight Securities Compliance">
          Draft wording
        </span>
      </p>
    </aside>
  );
}

/** Top of a sub-page: title, the finding as a lead sentence, and page-level controls. */
export function PageIntro({ title, lead, meta, controls }: { title: string; lead?: ReactNode; meta?: ReactNode; controls?: ReactNode }) {
  return (
    <div className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-5 px-4 py-9 sm:px-6 sm:py-11 lg:flex-row lg:items-end lg:justify-between lg:px-8">
        <div className="rise max-w-[72ch]">
          <h1 className="text-[28px] font-semibold tracking-[-0.025em] text-ink sm:text-[34px]">{title}</h1>
          {lead && <p className="serif mt-3 text-[18px] leading-snug text-ink-2 sm:text-[21px]">{lead}</p>}
          {meta && <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-muted">{meta}</div>}
        </div>
        {controls && <div className="flex flex-wrap items-center gap-2">{controls}</div>}
      </div>
    </div>
  );
}
