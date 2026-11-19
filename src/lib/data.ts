/**
 * Data access. Everything the dashboard shows comes through here, from the JSON
 * written by `npm run data`. To move to an API later, implement DataSource
 * against the API and swap `source` below; no component changes.
 */
import type { Cell, Company, MetricDef, PeriodType, PricePoints, Registry, SectorMeta, Status } from './types';

export interface DataSource {
  registry(): Promise<Registry>;
  sector(slug: string): Promise<SectorMeta>;
  companies(slug: string): Promise<Company[]>;
  metrics(slug: string): Promise<MetricDef[]>;
  facts(slug: string): Promise<{ fields: string[]; rows: [string, string, string, number | null, Status?][] }>;
  prices(slug: string, ticker: string): Promise<PricePoints>;
}

const BASE = `${import.meta.env.BASE_URL}data`;

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-cache' });
  const type = res.headers.get('content-type') ?? '';
  // Static hosts answer a missing file with the app's HTML page (status 200), so check the type too.
  if (!res.ok || !type.includes('json')) throw new Error(`Could not load ${url.replace(BASE, 'data')} (${res.ok ? 'file not found' : `HTTP ${res.status}`}).`);
  return res.json() as Promise<T>;
}

export const staticJsonSource: DataSource = {
  registry: () => getJSON(`${BASE}/sectors.json`),
  sector: (s) => getJSON(`${BASE}/${s}/sector.json`),
  companies: (s) => getJSON(`${BASE}/${s}/companies.json`),
  metrics: (s) => getJSON(`${BASE}/${s}/metrics.json`),
  facts: (s) => getJSON(`${BASE}/${s}/facts.json`),
  prices: (s, t) => getJSON(`${BASE}/${s}/prices/${t}.json`),
};

const source: DataSource = staticJsonSource;

/** Everything a sector page needs, indexed for fast lookups. */
export class SectorBundle {
  readonly metricsById: Map<string, MetricDef>;
  readonly companyByTicker: Map<string, Company>;
  /** company → period → metric → cell */
  private readonly idx = new Map<string, Map<string, Map<string, Cell>>>();
  private readonly seriesCache = new Map<string, { p: string; v: number | null; s: Status }[]>();

  constructor(
    readonly meta: SectorMeta,
    readonly companies: Company[],
    metrics: MetricDef[],
    rows: [string, string, string, number | null, Status?][],
  ) {
    this.metricsById = new Map(metrics.map((m) => [m.id, m]));
    this.companyByTicker = new Map(companies.map((c) => [c.ticker, c]));
    for (const [c, p, m, v, s] of rows) {
      let byP = this.idx.get(c);
      if (!byP) this.idx.set(c, (byP = new Map()));
      let byM = byP.get(p);
      if (!byM) byP.set(p, (byM = new Map()));
      byM.set(m, { v, s: s ?? 'ok' });
    }
  }

  metric(id: string): MetricDef {
    return this.metricsById.get(id) ?? { id, header: id, label: id, unit: 'number', direction: 'neutral', group: 'other', basis: ['Q'] };
  }

  has(id: string) {
    return this.metricsById.has(id);
  }

  cell(company: string, period: string, metric: string): Cell {
    const byP = this.idx.get(company);
    if (!byP) return { v: null, s: 'blank' };
    const byM = byP.get(period);
    if (!byM) return { v: null, s: 'blank' };
    return byM.get(metric) ?? { v: null, s: 'blank' };
  }

  value(company: string, period: string, metric: string): number | null {
    const c = this.cell(company, period, metric);
    return c.s === 'ok' ? c.v : null;
  }

  periodsFor(company: string, type: PeriodType): string[] {
    const byP = this.idx.get(company);
    if (!byP) return [];
    return [...byP.keys()].filter((p) => (type === 'FY' ? p.startsWith('FY') : !p.startsWith('FY'))).sort(comparePeriods);
  }

  /** Time series for one company and metric, oldest first. */
  series(company: string, metric: string, type: PeriodType) {
    const key = `${company}|${metric}|${type}`;
    let s = this.seriesCache.get(key);
    if (!s) {
      s = this.periodsFor(company, type).map((p) => ({ p, ...toPS(this.cell(company, p, metric)) }));
      this.seriesCache.set(key, s);
    }
    return s;
  }

  /** One metric for every company in one period. */
  cross(period: string, metric: string) {
    return this.companies.map((c) => ({ ticker: c.ticker, name: c.name, ...this.cell(c.ticker, period, metric) }));
  }

  /** Sector median of a metric per period (companies with a number only). */
  medianSeries(metric: string, periods: string[], positiveOnly = false) {
    return periods.map((p) => {
      const xs = this.companies.map((c) => this.value(c.ticker, p, metric)).filter((v): v is number => v !== null && (!positiveOnly || v > 0));
      return { p, v: median(xs), n: xs.length };
    });
  }

  /** Latest period (of a type) where at least `share` of companies have a number for every metric given. */
  latestCovered(type: PeriodType, metrics: string[], share = 0.75): string | null {
    const periods = type === 'Q' ? [...this.meta.quarters] : [...this.meta.fiscalYears];
    for (const p of periods.reverse()) {
      const n = this.companies.filter((c) => metrics.every((m) => this.value(c.ticker, p, m) !== null)).length;
      if (n / Math.max(1, this.companies.length) >= share) return p;
    }
    return null;
  }

  aggregate(id: string) {
    return this.meta.aggregates[id] ?? null;
  }
}

const toPS = (c: Cell) => ({ v: c.s === 'ok' ? c.v : null, s: c.s });

export function comparePeriods(a: string, b: string) {
  const ka = a.startsWith('FY') ? Number(a.slice(2)) * 4 + 3.5 : Number(a.slice(0, 4)) * 4 + Number(a.slice(5)) - 1;
  const kb = b.startsWith('FY') ? Number(b.slice(2)) * 4 + 3.5 : Number(b.slice(0, 4)) * 4 + Number(b.slice(5)) - 1;
  return ka - kb;
}

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// ------------------------------------------------------------ caching loaders (for React `use`)
const cache = new Map<string, Promise<unknown>>();
function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  let p = cache.get(key) as Promise<T> | undefined;
  if (!p) {
    p = fn();
    cache.set(key, p);
    // A failed load stays failed until the user retries (clearDataCache): retrying
    // automatically on every render would hammer the server in a loop.
    p.catch(() => undefined);
  }
  return p;
}

/** Production builds drop development-only sectors from the registry entirely. */
export const loadRegistry = () =>
  cached('registry', async () => {
    const r = await source.registry();
    return import.meta.env.DEV ? r : { ...r, sectors: r.sectors.filter((s) => s.status !== 'dev') };
  });

/** Sectors that appear in menus, footers and the sectors page. */
export const listedSectors = (r: Registry) => r.sectors.filter((s) => s.status !== 'dev');
export const isLive = (status: string) => status === 'live' || status === 'dev';

export const loadSector = (slug: string) =>
  cached(`sector:${slug}`, async () => {
    const [meta, companies, metrics, facts] = await Promise.all([
      source.sector(slug), source.companies(slug), source.metrics(slug), source.facts(slug),
    ]);
    return new SectorBundle(meta, companies, metrics, facts.rows);
  });

export const loadPrices = (slug: string, ticker: string) => cached(`prices:${slug}:${ticker}`, () => source.prices(slug, ticker));

export function clearDataCache() {
  cache.clear();
}
