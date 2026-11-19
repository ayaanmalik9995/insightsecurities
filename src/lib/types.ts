export type Unit = 'pkr_mn' | 'pct' | 'x' | 'rs' | 'number';
export type Direction = 'higher' | 'lower' | 'neutral';
/** ok = number; na = not enough data; nm = not meaningful (loss); blank = not entered; nobs = no balance sheet filed. */
export type Status = 'ok' | 'na' | 'nm' | 'blank' | 'nobs' | 'err';
export type PeriodType = 'Q' | 'FY';

export interface MetricDef {
  id: string;
  header: string;
  label: string;
  short?: string;
  unit: Unit;
  direction: Direction;
  group: string;
  basis: PeriodType[];
  needsBalanceSheet?: boolean;
  input?: boolean;
  description?: string;
  inferred?: boolean;
}

export interface Company {
  ticker: string;
  name: string;
  sharesOutstandingMn: number;
  fyEndMonth: number;
  firstQuarter: string | null;
  lastQuarter: string | null;
  lastBalanceSheet: string | null;
  quarters: number;
  annualStatus: Record<string, string>;
  price: { from: string; to: string; last: number; prev: number | null; points: number } | null;
}

export interface AggregatePoint {
  p: string;
  v: number | null;
  n: number;
  of: number;
  yoy: number | null;
}

export interface Aggregate {
  id: string;
  label: string;
  unit: Unit;
  type: 'sum' | 'median' | 'ratio_of_sums';
  /** pct = relative change; pp = change in percentage points (for ratios). */
  yoyKind: 'pct' | 'pp';
  /** ttm = 12 months to the period; quarter = the quarter alone; point = at the period end. */
  basis: 'ttm' | 'quarter' | 'point';
  direction: Direction;
  metric?: string;
  points: AggregatePoint[];
  latest: string | null;
}

export interface SectorConfig {
  kpis: string[];
  trend: { revenue: string; profit: string; margins: string[] } | null;
  leagueTables: string[];
  valuationMap: { x: string; y: string; size: string } | null;
  compare: { annual: string[]; quarterly: string[] } | null;
  companyCharts: {
    flows: string[]; margins: string[]; returns: string[]; valuation: string[];
    cash: string[]; debt: string[]; netCash: string; stats: string[];
  } | null;
  headToHead: { flows: string[]; lines: string[]; dots: string[] } | null;
  headline: { profit: string; valuation: string } | null;
}

export interface SectorMeta {
  slug: string;
  name: string;
  shortName: string;
  description: string;
  generatedAt: string;
  source: { file: string; sha256: string; modified: string };
  asOf: { financials: string; financialsPeriod: string; balanceSheet: string; balanceSheetPeriod: string; prices: string };
  quarters: string[];
  fiscalYears: string[];
  coverage: { period: string; companies: number; pl: number; bs: number }[];
  aggregates: Record<string, Aggregate>;
  config: SectorConfig;
  notes: { definitions: { term: string; text: string }[]; sheetNotes: { sheet: string; text: string }[] };
  filings: { ticker: string; date: string; title: string; url?: string; type?: string }[] | null;
  warnings: number;
}

export interface SectorEntry {
  slug: string;
  name: string;
  shortName: string;
  /** dev = development-only test sector (never listed in production). */
  status: 'live' | 'coming_soon' | 'dev';
  description: string;
  asOf?: SectorMeta['asOf'] | null;
  companies?: number;
}

export interface Registry {
  generatedAt: string;
  defaultSector: string;
  sectors: SectorEntry[];
}

export interface Cell {
  v: number | null;
  s: Status;
}

export interface PricePoints {
  ticker: string;
  /** [days since 1970-01-01, adjusted close] */
  points: [number, number][];
}
