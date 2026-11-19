import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router';
import { Check, ChevronDown, LayoutGrid, Search } from 'lucide-react';
import { useSector } from '../../lib/sector-context';
import { useTheme } from '../../lib/theme';
import { track } from '../../lib/analytics';
import { CompanySearch } from './CompanySearch';

const TABS = [
  { to: '', label: 'Overview', end: true },
  { to: 'valuation', label: 'Valuation' },
  { to: 'companies', label: 'Companies' },
  { to: 'compare', label: 'Compare' },
  { to: 'methodology', label: 'Methodology' },
];

function SectorSwitcher() {
  const { registry, slug } = useSector();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const nav = useNavigate();
  const current = registry.sectors.find((s) => s.slug === slug);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [open]);
  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-surface pl-2.5 pr-2 text-[13.5px] font-semibold text-ink transition-colors hover:border-line-strong"
      >
        <span aria-hidden className="size-2 rounded-full bg-brand" />
        <span className="max-w-[9rem] truncate" title={current?.name}>{current?.name ?? slug}</span>
        <ChevronDown aria-hidden className={`size-4 text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      <div
        role="menu"
        aria-label="Sectors"
        className={`absolute left-0 top-full z-40 mt-1.5 w-72 origin-top-left rounded-xl border border-line bg-surface p-1.5 shadow-pop transition-[opacity,transform] duration-150 ease-[var(--ease-snappy)] ${
          open ? 'visible scale-100 opacity-100' : 'invisible scale-[0.97] opacity-0'
        }`}
      >
        <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold text-faint">PSX sectors</p>
        {registry.sectors.filter((s) => s.status !== 'dev' || s.slug === slug).map((s) => {
          const live = s.status === 'live' || s.status === 'dev';
          const active = s.slug === slug;
          return (
            <button
              key={s.slug}
              type="button"
              role="menuitem"
              tabIndex={open ? 0 : -1}
              disabled={!live}
              onClick={() => {
                if (!live) return;
                setOpen(false);
                if (!active) { track('insights_sector_switch', { sector: s.slug, from_sector: slug }); nav(`/${s.slug}`); }
              }}
              className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors enabled:hover:bg-surface-3 disabled:cursor-default"
            >
              <span aria-hidden className={`mt-1.5 size-2 shrink-0 rounded-full ${live ? 'bg-brand' : 'bg-line-strong'}`} />
              <span className="min-w-0 flex-1">
                <span className={`flex items-center gap-2 text-[13.5px] font-semibold ${live ? 'text-ink' : 'text-muted'}`}>
                  {s.name}
                  {!live && <span className="rounded-full bg-surface-3 px-1.5 py-px text-[10px] font-semibold text-muted">Coming soon</span>}
                </span>
                <span className="mt-0.5 block text-[11.5px] leading-snug text-muted">{live ? `${s.companies} companies` : s.description}</span>
              </span>
              {active && <Check aria-hidden className="mt-1 size-4 text-brand-ink" />}
            </button>
          );
        })}
        <div className="mt-1 border-t border-line pt-1">
          <button
            type="button"
            role="menuitem"
            tabIndex={open ? 0 : -1}
            onClick={() => { setOpen(false); nav('/sectors'); }}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-ink-2 transition-colors hover:bg-surface-3 hover:text-ink"
          >
            <LayoutGrid aria-hidden className="size-4 text-muted" /> All sectors
          </button>
        </div>
      </div>
    </div>
  );
}

export function SectorNav() {
  const { slug } = useSector();
  const loc = useLocation();
  const list = useRef<HTMLDivElement>(null);
  const [ind, setInd] = useState<{ left: number; width: number } | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const { reducedMotion } = useTheme();

  useLayoutEffect(() => {
    const a = list.current?.querySelector<HTMLAnchorElement>('a[aria-current="page"]');
    if (a) {
      setInd({ left: a.offsetLeft, width: a.offsetWidth });
      a.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    } else setInd(null);
  }, [loc.pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearchOpen(true); }
      if (e.key === '/' && !(e.target as HTMLElement)?.closest('input,textarea,select')) { e.preventDefault(); setSearchOpen(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

  return (
    <div className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur-md supports-[backdrop-filter]:bg-surface/80">
      <div className="mx-auto flex h-14 max-w-[1280px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <SectorSwitcher />
        <nav aria-label="Sector sections" className="relative -mb-px min-w-0 flex-1 self-stretch">
          <div ref={list} className="relative flex h-full items-stretch gap-1 overflow-x-auto [scrollbar-width:none] max-md:[mask-image:linear-gradient(to_right,black_82%,transparent)] [&::-webkit-scrollbar]:hidden">
            {TABS.map((t) => (
              <NavLink
                key={t.to}
                to={`/${slug}${t.to ? `/${t.to}` : ''}`}
                end={t.end}
                className={({ isActive }) =>
                  `relative flex shrink-0 items-center px-3 text-[13.5px] font-medium transition-colors ${isActive || (t.to === 'companies' && loc.pathname.includes('/company/')) ? 'text-ink' : 'text-muted hover:text-ink'}`
                }
              >
                {t.label}
              </NavLink>
            ))}
            {ind && (
              <span
                aria-hidden
                className="absolute bottom-0 left-0 h-0.5 w-[100px] origin-left rounded-full bg-brand"
                style={{ transform: `translateX(${ind.left + 10}px) scaleX(${(ind.width - 20) / 100})`, transition: reducedMotion ? 'none' : 'transform 260ms var(--ease-snappy)' }}
              />
            )}
          </div>
        </nav>
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          aria-label="Search companies"
          className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-line bg-surface px-2.5 text-[13px] text-muted transition-colors hover:border-line-strong hover:text-ink sm:w-56"
        >
          <Search aria-hidden className="size-4" />
          <span className="hidden flex-1 text-left sm:inline">Search companies</span>
          <kbd className="hidden rounded border border-line bg-surface-2 px-1.5 font-sans text-[10.5px] font-medium text-faint sm:inline">{isMac ? '⌘K' : 'Ctrl K'}</kbd>
        </button>
      </div>
      <CompanySearch open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
