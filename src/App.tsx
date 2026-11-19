import { Component, Suspense, lazy, use, useEffect, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation, useParams } from 'react-router';
import { AlertTriangle, RotateCw } from 'lucide-react';
import { ThemeProvider } from './lib/theme';
import { clearDataCache, loadRegistry, loadSector } from './lib/data';
import { SectorProvider } from './lib/sector-context';
import { track } from './lib/analytics';
import { SiteHeader } from './components/layout/SiteHeader';
import { SectorNav } from './components/layout/SectorNav';
import { SiteFooter } from './components/layout/SiteFooter';
import { TickerBar } from './components/layout/TickerBar';
import { DevDataToggle } from './components/layout/DevDataToggle';
import { PageSkeleton } from './components/ui/PageSkeleton';
import { ComingSoon, NotFound } from './pages/Empty';

const Overview = lazy(() => import('./pages/Overview'));
const Valuation = lazy(() => import('./pages/Valuation'));
const Companies = lazy(() => import('./pages/Companies'));
const CompanyPage = lazy(() => import('./pages/Company'));
const Compare = lazy(() => import('./pages/Compare'));
const Methodology = lazy(() => import('./pages/Methodology'));
const Sectors = lazy(() => import('./pages/Sectors'));

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <AlertTriangle aria-hidden className="mx-auto size-8 text-accent" />
        <h1 className="mt-4 text-xl font-semibold text-ink">The insights data could not be loaded</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-muted">{this.state.error.message} Check your connection and try again. If this keeps happening, the data files may be updating.</p>
        <button
          type="button"
          onClick={() => { clearDataCache(); this.setState({ error: null }); }}
          className="mt-6 inline-flex h-10 items-center gap-2 rounded-full bg-brand px-5 text-[14px] font-semibold text-white hover:opacity-90"
        >
          <RotateCw aria-hidden className="size-4" /> Try again
        </button>
      </div>
    );
  }
}

function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      document.getElementById(hash.slice(1))?.scrollIntoView();
      return;
    }
    window.scrollTo({ top: 0 });
  }, [pathname, hash]);
  return null;
}

function RootRedirect() {
  const reg = use(loadRegistry());
  return <Navigate to={`/${reg.defaultSector}`} replace />;
}

/** Loads the sector bundle and renders the page chrome around the active route. */
function SectorShell() {
  const { sector = '' } = useParams();
  const registry = use(loadRegistry());
  const entry = registry.sectors.find((s) => s.slug === sector);
  if (!entry) return <Chrome registry={registry}><NotFound /></Chrome>;
  if (entry.status === 'coming_soon') return <Chrome registry={registry}><ComingSoon entry={entry} /></Chrome>;
  return <LiveSector slug={sector} registry={registry} />;
}

function LiveSector({ slug, registry }: { slug: string; registry: Awaited<ReturnType<typeof loadRegistry>> }) {
  const bundle = use(loadSector(slug));
  return (
    <SectorProvider value={{ registry, bundle, slug }}>
      <SiteHeader />
      <SectorNav />
      <main id="main">
        <Suspense fallback={<PageSkeleton inner />}>
          <Outlet />
        </Suspense>
      </main>
      <SiteFooter registry={registry} />
      <TickerBar />
      {import.meta.env.DEV && <DevDataToggle />}
    </SectorProvider>
  );
}

function Chrome({ registry, children }: { registry: Awaited<ReturnType<typeof loadRegistry>>; children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main id="main">{children}</main>
      <SiteFooter registry={registry} />
    </>
  );
}

function SectorsRoute() {
  const registry = use(loadRegistry());
  const def = registry.defaultSector;
  const bundle = use(loadSector(def));
  return (
    <SectorProvider value={{ registry, bundle, slug: def }}>
      <SiteHeader />
      <main id="main">
        <Sectors />
      </main>
      <SiteFooter registry={registry} />
      <TickerBar />
    </SectorProvider>
  );
}

function SectionView({ name }: { name: string }) {
  const { sector } = useParams();
  useEffect(() => { track('insights_section_view', { sector, section: name }); }, [sector, name]);
  return null;
}

export function App() {
  return (
    <ThemeProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <ScrollToTop />
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 focus:text-ink focus:shadow-pop">
          Skip to content
        </a>
        <ErrorBoundary>
          <Suspense fallback={<PageSkeleton />}>
            <Routes>
              <Route path="/" element={<RootRedirect />} />
              <Route path="/sectors" element={<SectorsRoute />} />
              <Route path="/:sector" element={<SectorShell />}>
                <Route index element={<><SectionView name="overview" /><Overview /></>} />
                <Route path="valuation" element={<><SectionView name="valuation" /><Valuation /></>} />
                <Route path="companies" element={<><SectionView name="companies" /><Companies /></>} />
                <Route path="company/:ticker" element={<CompanyPage />} />
                <Route path="compare" element={<><SectionView name="compare" /><Compare /></>} />
                <Route path="methodology" element={<><SectionView name="methodology" /><Methodology /></>} />
                <Route path="*" element={<NotFound />} />
              </Route>
              <Route path="*" element={<NotFound standalone />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </BrowserRouter>
    </ThemeProvider>
  );
}
