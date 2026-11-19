import { Link } from 'react-router';
import { MoveDown, MoveUp } from 'lucide-react';
import { useSector } from '../../lib/sector-context';
import { fmt, fmtChange, fmtDate } from '../../lib/format';

/**
 * Bottom ticker in the style of insightsec.com.pk. Shows the LAST CLOSE from the
 * research workbook (not a live feed: live prices are outside this project's scope).
 */
export function TickerBar() {
  const { bundle, slug } = useSector();
  const items = bundle.companies.filter((c) => c.price);
  if (!items.length) return null;
  const asOf = bundle.meta.asOf.prices;
  const chip = (c: (typeof items)[number], dup: boolean) => {
    const ch = c.price!.prev ? c.price!.last / c.price!.prev - 1 : 0;
    const up = ch > 0, down = ch < 0;
    return (
      <Link
        key={dup ? `${c.ticker}-dup` : c.ticker}
        to={`/${slug}/company/${c.ticker}`}
        tabIndex={dup ? -1 : undefined}
        className={`group mx-1 flex h-9 min-w-[172px] shrink-0 items-center gap-3 rounded-md border border-white/[0.07] bg-ticker-chip px-3 transition-colors hover:border-white/20 ${up ? 'shadow-[inset_0_-2px_0_var(--ticker-up)]' : down ? 'shadow-[inset_0_-2px_0_var(--ticker-down)]' : ''}`}
      >
        <span className="text-[12.5px] font-bold tracking-[0.01em] text-ticker-ink">{c.ticker}</span>
        <span className="num text-[12.5px] text-ticker-muted">{fmt(c.price!.last, 'rs', { currency: false })}</span>
        <span
          className={`num ml-auto inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] font-semibold ${
            up ? 'bg-[rgba(39,217,150,0.12)] text-ticker-up' : down ? 'bg-[rgba(255,88,103,0.12)] text-ticker-down' : 'bg-white/5 text-ticker-muted'
          }`}
        >
          {up ? <MoveUp aria-hidden className="size-3" strokeWidth={2.5} /> : down ? <MoveDown aria-hidden className="size-3" strokeWidth={2.5} /> : null}
          {fmtChange(ch, 'pct')}
        </span>
      </Link>
    );
  };
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 drop-shadow-[0_-3px_10px_rgba(0,0,0,0.18)]" role="region" aria-label={`Last close prices, ${fmtDate(asOf)}`}>
      <div className="flex h-4 items-end">
        <div className="flex h-full items-center gap-1.5 rounded-tl-[5px] border border-b-0 border-white/10 bg-[#1b1e21] px-2.5 text-[8.5px] font-semibold uppercase tracking-[0.04em] text-[#d2d8d5]">
          <span aria-hidden className="size-[5px] rounded-full bg-[#00a34a]" />
          Last close: <span className="text-white">{fmtDate(asOf)}</span>
        </div>
        <div className="flex h-full items-center border border-b-0 border-l-0 border-white/10 bg-[#23272a] px-2.5 text-[8.5px] font-semibold uppercase tracking-[0.04em] text-[#aeb8b3]">
          Source: <span className="ml-1 text-[#00a34a]">research workbook</span>
        </div>
      </div>
      <div className="relative h-12 overflow-hidden border-t border-white/[0.07] bg-ticker-bg">
        <div className="ticker-track flex h-full w-max items-center motion-reduce:overflow-x-auto">
          {items.map((c) => chip(c, false))}
          <div aria-hidden className="flex">{items.map((c) => chip(c, true))}</div>
        </div>
      </div>
    </div>
  );
}
