/**
 * Default metric catalogue for the PSX standard sector workbook template.
 *
 * Every column in Qtr_Input / Annual becomes a metric whose id is the header in
 * snake_case. This catalogue gives known metrics a human label, unit, format and
 * "direction" (is higher better?). Columns that are not listed here are still
 * converted: they get an inferred unit and a converter warning, and can be
 * described per sector through `metricOverrides` in sectors.config.json.
 */

export type Unit = 'pkr_mn' | 'pct' | 'x' | 'rs' | 'number';
export type Direction = 'higher' | 'lower' | 'neutral';

export interface MetricDef {
  label: string;
  short?: string;
  unit: Unit;
  direction: Direction;
  group: 'income' | 'balance' | 'market' | 'growth' | 'profitability' | 'returns' | 'leverage' | 'valuation';
  /** Value is meaningless when the period has no balance sheet. */
  needsBalanceSheet?: boolean;
  /** Raw analyst input (blue cells) vs formula (black cells). */
  input?: boolean;
  description?: string;
}

export const TEMPLATE_SHEETS = {
  companies: 'Companies',
  quarterly: 'Qtr_Input',
  annual: 'Annual',
  prices: 'Prices',
  start: 'Start',
  filings: 'Filings',
} as const;

/** Columns each sheet must have. Anything here missing or renamed stops the converter. */
export const REQUIRED_COLUMNS: Record<string, string[]> = {
  Companies: ['Ticker', 'Company', 'Shares outstanding (mn)', 'FY end month'],
  Qtr_Input: [
    'Ticker', 'Quarter end', 'Net sales', 'Gross profit', 'Operating profit', 'Net profit',
    'Cash and bank', 'Short term investments', 'Short term debt', 'Current portion of LT debt',
    'Long term debt', 'Total assets', 'Total equity', 'Quarter', 'Year', 'Fiscal year', 'Key',
    'Total borrowings', 'Net cash', 'TTM net sales', 'TTM net profit', 'Prior TTM net sales',
    'Prior TTM net profit', 'Average price', 'Market cap', 'Revenue growth QoQ',
    'Net profit growth QoQ', 'Revenue growth YoY', 'Net profit growth YoY', 'Gross margin',
    'Operating margin', 'Net margin', 'ROE TTM', 'ROA TTM', 'TTM net profit growth',
    'TTM revenue growth', 'Debt to equity', 'Net cash per share', 'PE TTM', 'PS TTM', 'PB',
  ],
  Annual: [
    'Ticker', 'Year', 'FY end', 'Status', 'Net sales', 'Gross profit', 'Operating profit', 'Net profit',
    'Cash and bank', 'Short term investments', 'Short term debt', 'Current portion of LT debt',
    'Long term debt', 'Total assets', 'Total equity', 'Key', 'Total borrowings', 'Net cash',
    'Shares outstanding (mn)', 'Average price', 'Market cap', 'Revenue growth', 'Net profit growth',
    'Gross margin', 'Operating margin', 'Net margin', 'ROE', 'ROA', 'Debt to equity',
    'Net cash per share', 'PE', 'PB', 'PS',
  ],
  Prices: ['Ticker', 'Date', 'Price'],
};

/** Identity / helper columns that are not metrics. */
export const NON_METRIC_COLUMNS = new Set([
  'ticker', 'quarter_end', 'quarter', 'year', 'fiscal_year', 'key', 'fy_end', 'status',
  'shares_outstanding_mn',
]);

/** Input columns that make up the balance sheet; all blank = no balance sheet filed. */
export const BALANCE_SHEET_INPUTS = ['total_assets', 'total_equity'];

export const CATALOG: Record<string, MetricDef> = {
  // Income statement (inputs)
  net_sales: { label: 'Net sales', short: 'Revenue', unit: 'pkr_mn', direction: 'higher', group: 'income', input: true },
  gross_profit: { label: 'Gross profit', unit: 'pkr_mn', direction: 'higher', group: 'income', input: true },
  operating_profit: { label: 'Operating profit', unit: 'pkr_mn', direction: 'higher', group: 'income', input: true },
  net_profit: { label: 'Net profit', short: 'Profit', unit: 'pkr_mn', direction: 'higher', group: 'income', input: true, description: 'Profit attributable to owners where reported.' },
  // Balance sheet (inputs)
  cash_and_bank: { label: 'Cash and bank', unit: 'pkr_mn', direction: 'higher', group: 'balance', input: true, needsBalanceSheet: true },
  short_term_investments: { label: 'Short-term investments', unit: 'pkr_mn', direction: 'higher', group: 'balance', input: true, needsBalanceSheet: true },
  short_term_debt: { label: 'Short-term debt', unit: 'pkr_mn', direction: 'lower', group: 'balance', input: true, needsBalanceSheet: true },
  current_portion_of_lt_debt: { label: 'Current portion of LT debt', unit: 'pkr_mn', direction: 'lower', group: 'balance', input: true, needsBalanceSheet: true },
  long_term_debt: { label: 'Long-term debt', unit: 'pkr_mn', direction: 'lower', group: 'balance', input: true, needsBalanceSheet: true },
  total_assets: { label: 'Total assets', unit: 'pkr_mn', direction: 'neutral', group: 'balance', input: true, needsBalanceSheet: true },
  total_equity: { label: 'Total equity', unit: 'pkr_mn', direction: 'higher', group: 'balance', input: true, needsBalanceSheet: true, description: 'Includes minority interest.' },
  // Derived
  total_borrowings: { label: 'Total borrowings', unit: 'pkr_mn', direction: 'lower', group: 'balance', needsBalanceSheet: true },
  net_cash: { label: 'Net cash', unit: 'pkr_mn', direction: 'higher', group: 'balance', needsBalanceSheet: true, description: 'Cash and bank + short-term investments − total borrowings. Negative = net debt.' },
  ttm_net_sales: { label: 'Revenue (TTM)', unit: 'pkr_mn', direction: 'higher', group: 'income' },
  ttm_net_profit: { label: 'Net profit (TTM)', unit: 'pkr_mn', direction: 'higher', group: 'income' },
  prior_ttm_net_sales: { label: 'Revenue (prior TTM)', unit: 'pkr_mn', direction: 'neutral', group: 'income' },
  prior_ttm_net_profit: { label: 'Net profit (prior TTM)', unit: 'pkr_mn', direction: 'neutral', group: 'income' },
  average_price: { label: 'Average share price', unit: 'rs', direction: 'neutral', group: 'market' },
  market_cap: { label: 'Market cap', unit: 'pkr_mn', direction: 'neutral', group: 'market', description: 'Average closing price over the period × current shares outstanding.' },
  // Growth
  revenue_growth_qoq: { label: 'Revenue growth (QoQ)', unit: 'pct', direction: 'higher', group: 'growth' },
  net_profit_growth_qoq: { label: 'Profit growth (QoQ)', unit: 'pct', direction: 'higher', group: 'growth' },
  revenue_growth_yoy: { label: 'Revenue growth (YoY)', unit: 'pct', direction: 'higher', group: 'growth' },
  net_profit_growth_yoy: { label: 'Profit growth (YoY)', unit: 'pct', direction: 'higher', group: 'growth' },
  ttm_revenue_growth: { label: 'Revenue growth (TTM)', unit: 'pct', direction: 'higher', group: 'growth' },
  ttm_net_profit_growth: { label: 'Profit growth (TTM)', unit: 'pct', direction: 'higher', group: 'growth' },
  revenue_growth: { label: 'Revenue growth', unit: 'pct', direction: 'higher', group: 'growth' },
  net_profit_growth: { label: 'Profit growth', short: 'PAT growth', unit: 'pct', direction: 'higher', group: 'growth' },
  // Profitability
  gross_margin: { label: 'Gross margin', short: 'GM', unit: 'pct', direction: 'higher', group: 'profitability' },
  operating_margin: { label: 'Operating margin', short: 'OM', unit: 'pct', direction: 'higher', group: 'profitability' },
  net_margin: { label: 'Net margin', short: 'NM', unit: 'pct', direction: 'higher', group: 'profitability' },
  // Returns
  roe_ttm: { label: 'ROE (TTM)', unit: 'pct', direction: 'higher', group: 'returns', needsBalanceSheet: true },
  roa_ttm: { label: 'ROA (TTM)', unit: 'pct', direction: 'higher', group: 'returns', needsBalanceSheet: true },
  roe: { label: 'ROE', unit: 'pct', direction: 'higher', group: 'returns', needsBalanceSheet: true },
  roa: { label: 'ROA', unit: 'pct', direction: 'higher', group: 'returns', needsBalanceSheet: true },
  // Leverage
  debt_to_equity: { label: 'Debt to equity', short: 'D/E', unit: 'x', direction: 'lower', group: 'leverage', needsBalanceSheet: true },
  net_cash_per_share: { label: 'Net cash per share', unit: 'rs', direction: 'higher', group: 'leverage', needsBalanceSheet: true },
  // Valuation
  pe_ttm: { label: 'P/E (TTM)', unit: 'x', direction: 'lower', group: 'valuation' },
  ps_ttm: { label: 'P/S (TTM)', unit: 'x', direction: 'lower', group: 'valuation' },
  pb: { label: 'P/B', unit: 'x', direction: 'lower', group: 'valuation', needsBalanceSheet: true },
  pe: { label: 'P/E', unit: 'x', direction: 'lower', group: 'valuation' },
  ps: { label: 'P/S', unit: 'x', direction: 'lower', group: 'valuation' },
};

/** Best-effort unit for a column we have never seen (e.g. a new bank ratio). */
export function inferUnit(header: string, sample: number[]): Unit {
  const h = header.toLowerCase();
  if (/(margin|growth|ratio %|%|roe|roa|yield)/.test(h)) return 'pct';
  if (/(p\/e|pe\b|pb\b|ps\b|to equity|times|cover)/.test(h)) return 'x';
  if (/(per share|price|eps|dps)/.test(h)) return 'rs';
  const abs = sample.filter((v) => Number.isFinite(v)).map(Math.abs);
  if (abs.length && abs.every((v) => v <= 3)) return 'pct';
  return 'pkr_mn';
}

export function slugify(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/%/g, ' pct ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}
