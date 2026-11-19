# Insight Securities: Insights dashboard

A sector and company analytics site for PSX-listed companies, built by Genesis Solutions for Insight Securities. Every number on every page comes from the research team's sector workbook (`PSX_Pharma_Model.xlsx` format): a converter turns the workbook into static JSON, and the React app reads only that JSON.

- **Live sector:** Pharmaceuticals (13 companies, quarterly data from 2016, daily prices from 2015).
- **Coming soon:** Commercial Banks, Cement, Fertiliser (shown as "coming soon" until their workbooks are added).
- **Stack:** Vite · React 19 · TypeScript · React Router 7 · Tailwind CSS 4 · Lucide · Apache ECharts 6 · SheetJS (converter only).
- **Output:** a static site (HTML, JS, CSS, JSON). No server, database or Node process is needed in production.

---

## 1. Run it

You need **Node.js 20 or newer** (built and tested on Node 24).

```powershell
cd "C:\Users\DELL\Desktop\Genesis\Insight Securities\website"
npm install
npm run dev
```

Open **http://localhost:5173**. `npm run dev` serves the data already in `public/data/`. Run `npm run data` first if you changed a workbook.

| Command | What it does |
|---|---|
| `npm run dev` | Development server with hot reload at http://localhost:5173 |
| `npm run data` | Convert every live sector workbook into `public/data/` |
| `npm run data -- --check path\to\file.xlsx` | Validate a workbook without publishing anything |
| `npm run build` | Convert data, type-check, build the production site into `dist/` |
| `npm run build:path` | Same, for hosting under `/insights/` on the main domain |
| `npm run preview` | Serve the production build at http://localhost:4173 |
| `npm run stress` | Rebuild the worst-case test workbook and convert it (development only) |

---

## 2. Refresh the data (replace the Excel file)

1. Save the new workbook from Excel, so its formulas are calculated (Excel does this automatically on save).
2. Optionally check it first:
   ```powershell
   npm run data -- --check "C:\path\to\PSX_Pharma_Model.xlsx"
   ```
3. Replace the file in `data-src/pharma/`. The file name does not matter, but keep **exactly one** `.xlsx` in the folder.
4. Run `npm run data`, then `npm run build`, and upload `dist/` (or just `dist/data/` if only the numbers changed).

The converter writes `data-src/<sector>/convert-report.md` each time: coverage per company, as-of dates, recalculation checks and warnings.

**What the converter guarantees**
- It **fails loudly, and publishes nothing**, if a required sheet or column is missing or renamed. It names the sheet, column, header row and the probable rename, e.g. `"Net sales" (found "Net Sales (PKR)" instead; was it renamed?)`.
- It fails if formulas have no calculated values (workbook not saved from Excel), if a ticker is not in Companies, if a quarter is entered twice, or if a quarter-end date is not 31 Mar, 30 Jun, 30 Sep or 31 Dec.
- It re-calculates TTM sales, margins, market cap and P/E independently and reports any difference from the workbook.
- It handles the workbook's own conventions:
  - June and December fiscal years.
  - `n/a`, `n/m` and blank cells, each with its meaning.
  - Excel serial dates.
  - Incomplete fiscal years, which are shown as "in progress".
  - Quarters with no balance sheet: Excel shows net cash = 0 for these, and the converter turns that into "not filed".
  - Empty rows inside a sheet: skipped and reported.
- It writes into a staging folder and swaps it in, so a live site never reads half-written data.
- **Optional `Filings` sheet:** if a future workbook adds a sheet named `Filings` with columns `Ticker | Date | Title | URL | Type`, the overview's "Latest results loaded" list becomes a real filings list automatically. Without that sheet nothing changes, so today's workbook format keeps working as-is.

---

## 3. Add a new sector (no code changes)

1. Create `data-src/<slug>/` (e.g. `data-src/banks/`) and put the sector workbook in it. It uses the same sheet structure: `Companies`, `Qtr_Input`, `Annual`, `Prices` (plus `Start`, `Compare` and `Company_View` as in pharma).
2. In `sectors.config.json`, change that sector's entry to `"status": "live"` and set `"workbook": "data-src/<slug>"`. Copy the pharma entry's other blocks and adjust which metrics matter:
   - `kpis`: the five header cards (ids of `aggregates`).
   - `aggregates`: sector totals. `sum`, `median` or `ratio_of_sums`, built from any column.
   - `leagueTables`, `valuationMap` (`x`, `y`, `size`), `compare` (columns for the comparison table; `rank:<metric>` adds a rank column), `companyCharts`, `headToHead`.
   - `metricOverrides`: label, unit (`pkr_mn`, `pct`, `x`, `rs`) and direction (`higher`, `lower`, `neutral`) for new columns.
3. Run `npm run data`.

**Metric ids are the column headers in snake_case**: "PE TTM" becomes `pe_ttm`, and "Advances to deposits" becomes `advances_to_deposits`. New ratio columns (e.g. bank ratios) are picked up automatically, with a guessed unit and a converter warning until you describe them under `metricOverrides`. The sector switcher, footer, cross-sector page and every chart and table read from this config, so no component changes are needed.

Status values: `live` (published), `coming_soon` (listed, disabled), `hidden` (not listed), `dev` (development-only test data, removed from production builds).

---

## 4. Deploy

### Demo deployment (Vercel)
The team preview is live at **https://genesis-x-insight.vercel.app** (Vercel project `genesis-x-insight`). It is connected to GitHub `ayaanmalik9995/insightsecurities`, so every push to `main` rebuilds and redeploys it automatically, using `vercel.json`. Pages send a `noindex` header, so search engines skip the preview.

### Option A (recommended): subdomain `insights.insightsec.com.pk`
1. `npm run build`
2. Upload the contents of `dist/` to the subdomain's document root on the LiteSpeed host.
3. `dist/.htaccess` is included: deep links such as `/pharma/company/SEARL` fall back to `index.html`, build assets are cached for a year, and the data and page are revalidated on each visit.
4. In Cloudflare, add a proxied `CNAME`/`A` record for `insights` pointing at the host. If you set a Cloudflare cache rule, bypass or set a short TTL for `/data/*` so new data appears straight away.

### Option B: under the main site at `/insights/`
1. `npm run build:path` (sets the base path to `/insights/`).
2. Upload `dist/` into an `insights/` folder on the main site, and change `RewriteBase` and the fallback in `.htaccess` to `/insights/` and `/insights/index.html`.

### Option C: inside their React app
The app is self-contained: `src/App.tsx` exports `App`, routing is relative, and design tokens are CSS variables. To embed it, mount the routes under `/insights/*` in their router, and serve `public/data/` at `/insights/data/`. The vendor will need to confirm their React and Router versions first; this build uses React 19 and React Router 7.

### Moving to an API later
All data access goes through `src/lib/data.ts` (`DataSource`). Implement the same five methods against the API and swap `staticJsonSource`. No component changes are needed.

---

## 5. Analytics

`src/lib/analytics.ts` pushes events to `window.dataLayer` when Google Tag Manager is present. Paste the GTM snippet where marked in `index.html`. No IDs are in the code.

| Event | Parameters |
|---|---|
| `insights_section_view` | sector, section |
| `insights_sector_switch` | sector, from_sector |
| `insights_company_view` | sector, ticker |
| `insights_compare` | sector, tickers |
| `insights_period_change` | sector, view, period |
| `insights_download` | sector, item, format (png, csv, xlsx) |
| `insights_theme_toggle` | theme |

---

## 6. What is where

```
data-src/<sector>/          sector workbooks (+ convert-report.md)
sectors.config.json         one entry per sector: status, KPIs, charts, metric overrides
scripts/convert/            workbook → JSON converter and validation
scripts/stress/             worst-case test workbook generator (development only)
public/data/                generated JSON (sectors.json + one folder per sector)
public/brand/               Insight Securities logo and favicon
src/lib/                    data access, formatting, periods, theme, analytics, downloads
src/components/charts/      ECharts wrapper and chart builders
src/components/ui/          panels, tables, controls, disclaimer
src/components/layout/      header, sector nav, search, footer, PSX ticker
src/pages/                  Overview, Valuation, Companies, Company, Compare, Methodology, Sectors
PLAN.md                     approved plan and decisions
DESIGN.md                   design system (tokens, type, chart rules)
research/                   brand and inspiration analysis (/taste), screenshots
```

**Development-only stress test:** in `npm run dev`, a "Demo data / Worst case" switch at the bottom of the screen flips any page to `data-src/stress/`. That workbook holds extreme but plausible data: an 84-character company name, a new listing with one quarter, a company with no prices, a 912x P/E, negative equity and a PSX-sized giant. The switch and the test data are removed from production builds.

**Notes for go-live**
- The disclaimer is placeholder wording, marked "Draft wording", in `src/components/ui/Panel.tsx`. Replace it with Insight's compliance text.
- The ticker bar shows the **last close from the workbook**, not live prices (live feeds are outside this project's scope).
- Daily price series are view-only: they can be saved as chart images but not downloaded as data.
