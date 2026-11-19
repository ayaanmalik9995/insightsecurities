import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type ThemeName = 'light' | 'dark';

/** Resolved colour tokens for canvas charts (ECharts cannot read CSS variables itself). */
export interface Palette {
  theme: ThemeName;
  ink: string; ink2: string; muted: string; faint: string;
  line: string; lineStrong: string; grid: string;
  surface: string; surface2: string; bg: string;
  brand: string; brandInk: string; brandSoft: string; brandDeep: string;
  accent: string; accentInk: string; accentSoft: string;
  pos: string; neg: string; posSoft: string; negSoft: string;
  data: string; data2: string; data3: string;
  series: string[];
  font: string;
}

function readPalette(theme: ThemeName): Palette {
  const cs = getComputedStyle(document.documentElement);
  const v = (name: string) => cs.getPropertyValue(name).trim();
  return {
    theme,
    ink: v('--ink'), ink2: v('--ink-2'), muted: v('--muted'), faint: v('--faint'),
    line: v('--line'), lineStrong: v('--line-strong'), grid: v('--grid'),
    surface: v('--surface'), surface2: v('--surface-2'), bg: v('--bg'),
    brand: v('--brand'), brandInk: v('--brand-ink'), brandSoft: v('--brand-soft'), brandDeep: v('--brand-deep'),
    accent: v('--accent'), accentInk: v('--accent-ink'), accentSoft: v('--accent-soft'),
    pos: v('--pos'), neg: v('--neg'), posSoft: v('--pos-soft'), negSoft: v('--neg-soft'),
    data: v('--data'), data2: v('--data-2'), data3: v('--data-3'),
    series: [v('--s1'), v('--s2'), v('--s3'), v('--s4')],
    font: "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
  };
}

interface ThemeCtx {
  theme: ThemeName;
  palette: Palette;
  toggle: () => void;
  reducedMotion: boolean;
}

const Ctx = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeName>(() => (document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'));
  const [palette, setPalette] = useState<Palette>(() => readPalette(theme));
  const [reducedMotion, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('theme-transition');
    root.setAttribute('data-theme', theme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0a100d' : '#00321A');
    setPalette(readPalette(theme));
    try { localStorage.setItem('insights-theme', theme); } catch { /* storage unavailable */ }
    const t = window.setTimeout(() => root.classList.remove('theme-transition'), 260);
    return () => window.clearTimeout(t);
  }, [theme]);

  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);
  const value = useMemo(() => ({ theme, palette, toggle, reducedMotion }), [theme, palette, toggle, reducedMotion]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useTheme outside ThemeProvider');
  return c;
}
