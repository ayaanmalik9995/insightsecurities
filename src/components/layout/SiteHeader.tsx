import { ArrowUpRight, Moon, Sun } from 'lucide-react';
import { Link } from 'react-router';
import { useTheme } from '../../lib/theme';
import { track } from '../../lib/analytics';

const MAIN_SITE = 'https://insightsec.com.pk/';
const asset = (p: string) => `${import.meta.env.BASE_URL}${p}`;

export function Logo({ inverse }: { inverse?: boolean }) {
  return (
    <>
      <img src={asset('brand/insight-logo.png')} alt="Insight Securities" width={124} height={40} className={`h-9 w-auto sm:h-10 ${inverse ? 'hidden' : 'block'} [[data-theme=dark]_&]:hidden`} />
      <img src={asset('brand/footer-logo.png')} alt="Insight Securities" width={127} height={40} className={`h-9 w-auto sm:h-10 ${inverse ? 'block' : 'hidden'} [[data-theme=dark]_&]:block`} />
    </>
  );
}

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const dark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={() => { toggle(); track('insights_theme_toggle', { theme: dark ? 'light' : 'dark' }); }}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Light mode' : 'Dark mode'}
      className="relative grid size-9 place-items-center rounded-full border border-line text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
    >
      <Sun aria-hidden className={`absolute size-4 transition-[opacity,transform] duration-200 ${dark ? 'rotate-0 opacity-100' : '-rotate-45 opacity-0'}`} />
      <Moon aria-hidden className={`absolute size-4 transition-[opacity,transform] duration-200 ${dark ? 'rotate-45 opacity-0' : 'rotate-0 opacity-100'}`} />
    </button>
  );
}

export function SiteHeader() {
  return (
    <header className="border-b border-line bg-surface/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-4 px-4 sm:h-[72px] sm:px-6 lg:px-8">
        <a href={MAIN_SITE} className="shrink-0" aria-label="Insight Securities home">
          <Logo />
        </a>
        <span aria-hidden className="hidden h-7 w-px bg-line-strong sm:block" />
        <Link to="/" className="hidden text-[15px] font-semibold tracking-[-0.01em] text-ink sm:block">
          Insights
        </Link>
        <nav aria-label="Insight Securities" className="ml-auto flex items-center gap-1 sm:gap-2">
          <a href={MAIN_SITE} className="hidden items-center gap-1 rounded-full px-3 py-2 text-[14px] text-muted transition-colors hover:text-ink md:inline-flex">
            insightsec.com.pk <ArrowUpRight aria-hidden className="size-3.5" />
          </a>
          <ThemeToggle />
          <a
            href={MAIN_SITE}
            className="ml-1 inline-flex h-9 items-center rounded-full bg-[#008f3c] px-4 text-[13px] font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-[#007a33] active:scale-[0.97] sm:h-10 sm:px-5 sm:text-[14px]"
          >
            Open an account
          </a>
        </nav>
      </div>
    </header>
  );
}
