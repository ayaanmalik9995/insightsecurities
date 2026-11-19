import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, Download, FileSpreadsheet, FileText, Image as ImageIcon, MoveDown, MoveUp } from 'lucide-react';
import { useTheme } from '../../lib/theme';

/** Segmented control with a sliding selection indicator. */
export function Segmented<T extends string>({ value, onChange, options, label, size = 'md', tone = 'default' }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode; title?: string; disabled?: boolean }[];
  label: string; size?: 'sm' | 'md'; tone?: 'default' | 'deep';
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [ind, setInd] = useState<{ left: number; width: number } | null>(null);
  const { reducedMotion } = useTheme();
  useLayoutEffect(() => {
    const btn = wrap.current?.querySelector<HTMLButtonElement>(`[data-value="${CSS.escape(value)}"]`);
    if (btn) setInd({ left: btn.offsetLeft, width: btn.offsetWidth });
  }, [value, options.length]);
  const deep = tone === 'deep';
  return (
    <div
      ref={wrap}
      role="radiogroup"
      aria-label={label}
      className={`relative inline-flex shrink-0 items-center rounded-lg p-0.5 ${deep ? 'bg-white/10' : 'bg-surface-3'}`}
      onKeyDown={(e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        const enabled = options.filter((o) => !o.disabled);
        const i = enabled.findIndex((o) => o.value === value);
        const next = enabled[(i + (e.key === 'ArrowRight' ? 1 : -1) + enabled.length) % enabled.length];
        onChange(next.value);
        e.preventDefault();
        requestAnimationFrame(() => wrap.current?.querySelector<HTMLButtonElement>(`[data-value="${CSS.escape(next.value)}"]`)?.focus());
      }}
    >
      {ind && (
        <span
          aria-hidden
          className={`absolute top-0.5 bottom-0.5 rounded-md ${deep ? 'bg-white/90' : 'bg-surface shadow-[0_1px_2px_rgba(16,26,21,0.08),0_0_0_1px_var(--line)]'}`}
          style={{ left: 0, width: ind.width, transform: `translateX(${ind.left}px)`, transition: reducedMotion ? 'none' : 'transform 220ms var(--ease-snappy)' }}
        />
      )}
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            data-value={o.value}
            title={o.title}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={`relative z-[1] inline-flex items-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-colors duration-150 disabled:opacity-40 ${
              size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-[13px]'
            } ${deep ? (active ? 'text-brand-deep' : 'text-on-deep-muted hover:text-on-deep') : active ? 'text-ink' : 'text-muted hover:text-ink'}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Native select (accessible, mobile-friendly) dressed in the system style. */
export function Select({ value, onChange, options, label, hideLabel, className = '' }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; label: string; hideLabel?: boolean; className?: string;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className={`inline-flex items-center gap-2 text-xs text-muted ${className}`}>
      <span className={hideLabel ? 'sr-only' : ''}>{label}</span>
      <span className="relative inline-flex">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="num h-8 appearance-none rounded-lg border border-line bg-surface pl-3 pr-8 text-[13px] font-medium text-ink transition-colors hover:border-line-strong focus-visible:outline-2"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <ChevronDown aria-hidden className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
      </span>
    </label>
  );
}

/** ▲ +7.8% / ▼ −2.1 pp, coloured by whether the move is good. Never colour alone. */
export function Delta({ text, tone, size = 'sm', className = '' }: { text: string; tone: 'pos' | 'neg' | 'neutral'; size?: 'sm' | 'xs'; className?: string }) {
  if (text === '—') return <span className={`text-faint ${className}`}>—</span>;
  const Icon = tone === 'pos' ? MoveUp : tone === 'neg' ? MoveDown : null;
  const color = tone === 'pos' ? 'text-pos' : tone === 'neg' ? 'text-neg' : 'text-muted';
  return (
    <span className={`num inline-flex items-center gap-0.5 font-semibold ${color} ${size === 'xs' ? 'text-[11px]' : 'text-xs'} ${className}`}>
      {Icon && <Icon aria-hidden className={size === 'xs' ? 'size-3' : 'size-3.5'} strokeWidth={2.5} />}
      {text}
      <span className="sr-only">{tone === 'pos' ? ' (favourable)' : tone === 'neg' ? ' (unfavourable)' : ''}</span>
    </span>
  );
}

export function Skeleton({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return <div aria-hidden className={`skeleton ${className}`} style={style} />;
}

export interface DownloadAction {
  kind: 'png' | 'csv' | 'xlsx';
  run: () => void | Promise<void>;
}

const DL_META = {
  png: { label: 'Chart image', ext: 'PNG', Icon: ImageIcon },
  csv: { label: 'Table data', ext: 'CSV', Icon: FileText },
  xlsx: { label: 'Table data', ext: 'Excel', Icon: FileSpreadsheet },
};

export function DownloadMenu({ actions }: { actions: DownloadAction[] }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [open]);
  if (!actions.length) return null;
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 text-[13px] font-medium text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
      >
        <Download aria-hidden className="size-3.5" />
        <span className="hidden sm:inline">Download</span>
      </button>
      <div
        id={id}
        role="menu"
        className={`absolute right-0 top-full z-30 mt-1.5 w-52 origin-top-right rounded-xl border border-line bg-surface p-1 shadow-pop transition-[opacity,transform] duration-150 ease-[var(--ease-snappy)] ${
          open ? 'visible scale-100 opacity-100' : 'invisible scale-[0.97] opacity-0'
        }`}
      >
        {actions.map((a) => {
          const m = DL_META[a.kind];
          return (
            <button
              key={a.kind}
              type="button"
              role="menuitem"
              tabIndex={open ? 0 : -1}
              disabled={busy !== null}
              onClick={async () => {
                setBusy(a.kind);
                try { await a.run(); } finally { setBusy(null); setOpen(false); }
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] text-ink-2 transition-colors hover:bg-surface-3 hover:text-ink"
            >
              <m.Icon aria-hidden className="size-4 text-muted" />
              <span className="flex-1">{m.label}</span>
              <span className="text-[11px] font-semibold text-faint">{busy === a.kind ? '…' : m.ext}</span>
            </button>
          );
        })}
        <p className="px-2.5 pb-1.5 pt-1 text-[10.5px] leading-snug text-faint">Downloads include the source and as-of date.</p>
      </div>
    </div>
  );
}

export function Chip({ children, tone = 'default', title }: { children: ReactNode; tone?: 'default' | 'brand' | 'accent' | 'warn' | 'deep'; title?: string }) {
  const cls = {
    default: 'bg-surface-3 text-ink-2',
    brand: 'bg-brand-soft text-brand-ink',
    accent: 'bg-accent-soft text-accent-ink',
    warn: 'bg-neg-soft text-neg',
    deep: 'bg-white/10 text-on-deep',
  }[tone];
  return <span title={title} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>{children}</span>;
}
