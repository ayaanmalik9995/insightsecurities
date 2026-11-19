import { Command } from 'cmdk';
import { useNavigate } from 'react-router';
import { ArrowRight, GitCompareArrows, Search } from 'lucide-react';
import { useSector } from '../../lib/sector-context';
import { fmt, fmtChange } from '../../lib/format';
import { Delta } from '../ui/controls';

/** ⌘K company search across the current sector. */
export function CompanySearch({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { bundle, slug } = useSector();
  const nav = useNavigate();
  const go = (path: string) => { onOpenChange(false); nav(path); };
  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Search companies"
      overlayClassName="fixed inset-0 z-50 bg-[rgba(10,16,13,0.38)] backdrop-blur-[2px]"
      contentClassName="fixed left-1/2 top-[12vh] z-50 w-[min(560px,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-2xl border border-line bg-surface shadow-pop rise"
    >
      <div className="flex items-center gap-2.5 border-b border-line px-4">
        <Search aria-hidden className="size-4 text-muted" />
        <Command.Input
          autoFocus
          placeholder={`Search ${bundle.meta.name.toLowerCase()} by ticker or name…`}
          className="h-12 w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-faint"
        />
        <kbd className="rounded border border-line px-1.5 text-[10.5px] text-faint">Esc</kbd>
      </div>
      <Command.List className="max-h-[min(420px,60vh)] overflow-y-auto p-1.5">
        <Command.Empty className="px-3 py-8 text-center text-[13px] text-muted">No company matches. Try a ticker such as {bundle.companies[0]?.ticker}.</Command.Empty>
        <Command.Group heading="Companies" className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-faint">
          {bundle.companies.map((c) => {
            const ch = c.price?.prev ? c.price.last / c.price.prev - 1 : null;
            return (
              <Command.Item
                key={c.ticker}
                value={`${c.ticker} ${c.name}`}
                onSelect={() => go(`/${slug}/company/${c.ticker}`)}
                className="group flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-[13.5px] data-[selected=true]:bg-surface-3"
              >
                <span className="w-16 font-semibold text-ink">{c.ticker}</span>
                <span className="min-w-0 flex-1 truncate text-ink-2">{c.name}</span>
                {c.price && (
                  <span className="num text-[12px] text-muted">
                    {fmt(c.price.last, 'rs')}
                    {ch !== null && <Delta className="ml-1.5" size="xs" text={fmtChange(ch, 'pct')} tone={ch > 0 ? 'pos' : ch < 0 ? 'neg' : 'neutral'} />}
                  </span>
                )}
                <ArrowRight aria-hidden className="size-3.5 text-faint opacity-0 group-data-[selected=true]:opacity-100" />
              </Command.Item>
            );
          })}
        </Command.Group>
        <Command.Group heading="Go to" className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-faint">
          <Command.Item value="compare head to head" onSelect={() => go(`/${slug}/compare`)} className="flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-[13.5px] text-ink-2 data-[selected=true]:bg-surface-3">
            <GitCompareArrows aria-hidden className="size-4 text-muted" /> Compare companies head-to-head
          </Command.Item>
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}
