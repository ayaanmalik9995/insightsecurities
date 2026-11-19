# Insight Securities: Insights Dashboard Prototype Plan

Status: **draft for approval, no code written yet**. Prepared 19 Nov 2026.
Research behind this plan: `research/brand/` (Insight Securities /taste, logo files), `research/inspiration/` (DataDarbar /taste, peer dashboards), `research/screens/` (all captures).

---

## (a) What I understood

### From the proposal (Parts B and C) and the 31 Oct review meeting
- **Audience:** fund managers first (the meeting notes say the focus is "detailed analysis graphs for fund managers"), with retail investors as a second audience. So the first screen tells the story; detail sits one click or hover away.
- **Must cover:** KPI header cards; sector and company views; a chart type chosen per metric; hover details (exact value, period, change %, source date); filters, period selectors and company comparison; a detailed table under each chart; a latest-filings list; notes and disclaimers under every section; download rules (chart image, table as Excel/CSV, possibly a summary PDF, some items view-only); empty and loading states; desktop, tablet and mobile; brand fit with their header, footer, fonts and colours.
- **Out of scope per the proposal:** live price or trading feeds, viewer logins, and writing the compliance wording (Insight provides it). The ticker bar in our prototype will therefore show **last close from the workbook**, clearly labelled as such, not live prices.
- **Sectors:** the meeting confirms banking, pharma and cement workbooks already exist in this format family. Pharma is first.

### From `PSX_Pharma_Model.xlsx`: structure
| Sheet | What it is | Role in the converter |
|---|---|---|
| Start | Instructions, ratio definitions (rows 20-28), colour legend | **Methodology text** (reused as-is in the methodology section) |
| Companies (`tblCo`) | 13 tickers, name, shares outstanding (mn), FY-end month | Company master |
| Qtr_Input (`tblQtr`) | 481 rows: 11 raw inputs + 28 calculated columns | Quarterly facts |
| Annual (`tblAnnual`) | 125 rows: compiled fiscal years + ratios + status | Annual facts |
| Prices (`tblPrices`) | 31,351 rows: Ticker, Excel-serial date, adjusted price | Price series |
| Compare | A view (formulas over Annual/Qtr) | Column order, labels, colour rule text |
| Company_View | A view (formulas) | Row order and labels for the ratio tables |

All four data sheets are real **Excel Tables**, with headers on **row 4** under title and note rows. The converter will find them by table name and fall back to header search.

### Data quirks I found (all handled in the plan)
1. **Mixed fiscal years:** 7 companies end in June (BFBIO, CPHL, FEROZ, IBLHL, MACTER, OTSU, SEARL) and 6 in December. "FY2025" means a different 12 months for each, so **sector totals cannot be summed by FY**. Sector KPIs will use **calendar-quarter TTM** (for example, TTM to Sep-2026 for all 13).
2. **Incomplete years:** 13 Annual rows say "Incomplete: x of 4 qtrs" with blank figures (FY2026 for December filers, FY2027 for June filers). These show as "in progress", never as zero.
3. **Missing balance sheets:** Sep-2026 balance sheets are blank for 10 of 13 companies (only HPL, MACTER and SEARL have them), and BFBIO's first three quarters lack them. **Excel then reports Total borrowings = 0 and Net cash = 0 for those rows, which is wrong.** The converter will set them to n/a.
4. **Text sentinels:** "n/a" (not enough data), "n/m" (loss or prior-period loss), blank (not entered). Counts: 45 loss quarters, 29 quarterly P/E = n/m, 5 annual P/E = n/m (e.g. SEARL FY2025).
5. **Extreme values:** ABOT TTM profit growth is +1,905% (prior TTM profit only PKR 261 mn), and SEARL's Q2-2026 P/E is 120x. Charts need clipped axes with "off-scale" markers, while tables show the true number.
6. **Shorter histories:** BFBIO starts Q3-2023 (annual from FY2024), AGP 2021, CPHL 2020, HALEON and MACTER 2017; everyone else 2016. Charts show gaps honestly and never interpolate.
7. **Prices:** dates are Excel serials (42005 = 1 Jan 2015 to 46336 = 10 Nov 2026), adjusted for bonuses; BFBIO has only 513 trading days. **There are two "as of" dates:** financials to Sep-2026 and prices to 10 Nov 2026. Both are shown.
8. **Valuation method:** market cap = *average* price over the period × *current* shares outstanding, so P/E uses the quarter's or year's average price, not the period-end price. This goes in the methodology section.
9. **Compare colours are not in the file:** the green/red conditional formatting was stripped when the file was last saved; only the rule text survives ("valuation: green = cheaper; other ratios: green = stronger"). We implement that rule in code.
10. **Formulas depend on Excel's cached results.** If a future pipeline writes the workbook with a library and Excel never recalculates it, every calculated column will be empty. I checked: re-computing TTM net sales from the raw inputs matches Excel on 442 of 442 rows, so the converter can verify, and fall back to recomputing, reliably.
11. Net profit is attributable to owners while total equity *includes* minority interest (a small ROE inconsistency, documented in the workbook; we repeat it).
12. **No filings data in the workbook:** there are no filing dates, titles or links. See question 3.

---

## (b) Brand and inspiration

### Insight Securities (insightsec.com.pk), full /taste in `research/brand/insightsec.com.pk.md`
- **Stack confirmed in the DOM:** React + Tailwind with shadcn-style HSL tokens (`--primary: 145 100% 28%`, `--radius: .75rem`, `--container-max: 1280px`, `--section-padding: 5rem`).
- **Colour:** one green family: primary **#008F3C**, dark **#003D1A**, footer **#004015**, soft **#EFF7F2**. Neutrals are pure grey (#1A1A1A, #737373, #E6E6E6).
- **Type:** Inter only, 400/500/600/700; h2 42px/700; body 14-18px.
- **Header:** fixed, 81px, white at 95% with blur, 1px bottom border, logo left, grey 14px nav, green pill "Get in Touch".
- **Footer:** full-bleed #004015, 4 columns, regulator badges (Jama Punji, Asaan Connect), copyright.
- **PSX ticker:** fixed bottom, 74px. A tiny 8.5px uppercase tab reads "LAST UPDATE · SOURCE: PSX", above a #111315 marquee of #1A1D20 chips (symbol, price, tinted change pill, coloured bottom edge; up #27D996, down #FF5867).
- **Logo saved:** `research/brand/insight-logo.png` (292x95), `footer-logo.png` (white version, 570x180), `insight-favicon.svg`.
- **Where "more premium" comes from:** the site runs on stock shadcn defaults, with no tabular numerals, stock shadows and no type voice. A data product can add those without leaving the brand.

### DataDarbar banks tracker (client's main reference), full /taste in `research/inspiration/insights.datadarbar.io.md`
- **Structure:** 4 tabs (P&L Rankings, Balance Sheet, Key Ratios, Trends); 4 KPI cards with unit and period captions; **every metric shown as a pair**, level bars beside YoY diverging bars; labelled-point scatters (ROE vs ROA, IDR vs ADR); an 11px method line ("P&L = annual sum of 4 quarters | BS = Dec snapshot | Source").
- **Borrow:** the tab story, the level + growth pairing, labelled scatters, method next to the number, one ink colour with red meaning "down".
- **Improve on:** titles are labels, not insights; no tables; paired charts are sorted differently, so a bank can't be traced across them; default tooltips; spline smoothing distorts values; a Ctrl-click listbox picker; no mobile design; no as-of date.

### Peers (`research/inspiration/peer-dashboards.md`)
| Site | Why it feels trustworthy | Borrow | Avoid |
|---|---|---|---|
| FT Markets Data | "as of" stamp under every price block; unit inside the label; arrows plus colour; serif + data sans | as-of lines, arrow glyphs, statement sub-tabs | promo banners between data |
| TradingView symbol page | price first; the range buttons show their own % return; unit as small suffix; peer strip | returns on range buttons, peer chips, last-value axis tag | marketing modules, loud gradients |
| Koyfin | calm density; right-aligned tabular columns; pale heatmap cells with dark text; rebased comparison lines with end labels | heatmap cells, rebased head-to-head, end labels | terminal density on a public page |
| Stripe / Linear (pattern notes) | KPI card anatomy (number, delta chip, sparkline); skeletons match the final layout; 1px borders over shadows; short, interruptible motion | all of it | glow/gradient "SaaS" heroes |

---

## (c) Design direction

**Concept: "Their site, in research-house mode."** The marketing site's white-and-green shell, with the dark terminal register they already use for market data (the ticker) brought into a calm, editorial data page.

### Type
- **Inter** (already loaded by their site) for UI and all figures, with `font-variant-numeric: tabular-nums` and slashed zero off. Numbers right-aligned everywhere in tables.
- **Insight headlines** in a serif, **Source Serif 4** (Google Fonts), for chart and section titles only. This gives the FT and DataDarbar editorial authority without touching their UI font. (Question 8 offers an Inter-only fallback.)
- **Scale (1.2 ratio, 4px grid):** 12 / 13 / 14 / 16 / 20 / 24 / 32 / 40. Overline labels 11px/600 uppercase with +0.04em tracking, like their ticker tabs.

### Colour (tokens defined in light and dark)
- **Brand layer:** green #008F3C for primary actions, active tabs, focus ring and links; #003D1A / #004015 for the hero band and footer.
- **Neutrals tinted toward the brand hue** (not pure grey): ink #111A15, muted #5B6861, border #E2E8E4, surface #F6F8F7.
- **Data ink:** slate-green #3E4C45 for default bars and lines; #C9D3CE for context series.
- **The one emphasis accent: amber #D99A1E**, used only to highlight the company or insight being discussed in a chart. It is clearly different from the performance colours and stays distinct for red/green colour-blind readers; their site already uses gold/orange accents.
- **Performance only:** positive #0F7B4A, negative #C2372B, always with ▲/▼ and a ± sign, so colour is never the only cue. Heatmap cells use pale tints with dark text (Koyfin style) and a neutral middle.
- **Dark mode:** green-black surfaces (#0C1310 / #121B17), echoing their ticker bar; same accent and performance hues, lightened for contrast. All pairs checked for WCAG AA.

### Grid and surfaces
- 12-column grid, max width **1280px** (their `--container-max`), 24px gutters, 16px side gutter on mobile, 4px spacing base, 64-80px between sections (their rhythm).
- Cards: 1px tinted border, 12px radius, no shadow at rest (their stock shadows are what makes the site feel template-like). Radii nest: card 12px, inner controls 8px, chips 999px.

### Chart style
- Insight title (serif, states the finding, generated from the data), a subtitle with metric, unit and period, then the chart, then a footer line "Source: Insight Securities research · Financials to Sep-2026 · Prices to 10 Nov 2026".
- Horizontal gridlines only, 1px; no chart borders, no 3D, no gradients on bars; direct labels instead of legends where possible; bars always start at zero; lines never smoothed; gaps shown as gaps.
- **Tooltip:** company, exact value with unit, period (e.g. "Q3-2026, Sep · FY2027 Q1 for June filers"), change vs prior period and vs a year ago, source date. Crosshair on time series.
- **Motion** (Emil Kowalski principles): charts draw in once when first scrolled into view (~500ms ease-out); filter changes morph in 250ms via ECharts universal transitions; UI transitions 150-200ms with `cubic-bezier(0.2, 0.8, 0.2, 1)`; nothing loops; `prefers-reduced-motion` turns animation off.

---

## (d) Section-by-section layout

Routes (React Router, shareable URLs; all state in the query string):

```
/insights                         → redirects to the default live sector (pharma)
/insights/sectors                 → cross-sector overview (fills in as sectors go live)
/insights/:sector                 → sector overview (the main story)
/insights/:sector/valuation       → valuation map + comparison table
/insights/:sector/company/:ticker → company deep-dive
/insights/:sector/compare?t=ABOT,GLAXO,SEARL → head-to-head
/insights/:sector/methodology     → methodology, data notes, disclaimers
```

**Persistent sub-header (sticky under their site header):** sector switcher (Pharma live; Banks, Cement and Fertiliser greyed out as "Coming soon", from config) · section tabs (Overview, Valuation, Companies, Head-to-head, Methodology) · company search (⌘K) · two as-of chips ("Financials to Sep-2026", "Prices to 10 Nov 2026") · light/dark toggle.

### 1. Sector overview (`/insights/pharma`)
| Block | Chart | Why this chart |
|---|---|---|
| **Hero insight band** (deep green) | One sentence generated from data, e.g. "Pharma profits rose 23% over the last year while the sector's median P/E fell from 16.1x to 14.2x" | Answers "what's the story?" before any chart. Template sentences filled from data, so no number is hardcoded |
| **5 KPI cards**: combined revenue (TTM), combined net profit (TTM), revenue growth (TTM YoY), median P/E (TTM), sector ROE (TTM) | Big tabular number + delta chip vs the same quarter last year + 12-quarter sparkline | The number is the message; the sparkline gives trend direction without axes |
| **Revenue and profit trend** | Paired column charts, quarterly sector revenue and net profit (last 12 quarters; toggle All), YoY in tooltip, coverage note when the company count changes | Flows over discrete periods are bars from a zero baseline; losses fall below zero naturally |
| **Margin trends** | Line chart, sector gross / operating / net margin (TTM), direct end labels | Ratios are states over time; lines show slope and convergence |
| **League tables** (4 small multiples) | Sorted horizontal bars: revenue growth (TTM), net margin, ROE (TTM), net cash per share; sector-median rule; selected company in amber; diverging for metrics that go negative | Ranking categorical items; long company names stay readable on the y-axis |
| **Latest data list** | List: company, latest quarter loaded, "P&L + balance sheet" or "P&L only", date | Shows freshness at a glance (see question 3) |
| Section footer | Table toggle under every chart, downloads, notes, disclaimer | Proposal: "tables under each chart" |

### 2. Valuation (`/insights/pharma/valuation`)
| Block | Chart | Why |
|---|---|---|
| **Valuation map** | Bubble scatter: x = ROE (TTM), y = P/E (TTM), size = market cap; dashed lines at sector medians; quadrant labels "Cheap & strong" (low P/E, high ROE), "Expensive & strong", "Cheap & weak", "Expensive & weak"; labelled points; off-scale P/E clipped with ▲ markers; loss-makers listed under the chart ("Not plotted: n/m P/E") | Two continuous variables plus a size variable; median quadrants answer "cheap vs strong" instantly |
| **Comparison table** (the Compare sheet) | Sortable heatmap table, annual (FY, each company's own year) or quarterly (TTM), with period selector; P/E and P/B ranks; per-column tint (valuation: lower = green; others: higher = green; see question 2); median row; sticky ticker column | Exact values plus relative standing in one view, mirroring the Excel the research team trusts |

### 3. Company deep-dive (`/insights/pharma/company/SEARL`)
| Block | Chart | Why |
|---|---|---|
| Header | Name, ticker, FY end, last close, period change, market cap, 6 key stats (TradingView-style grid) | Identity and snapshot |
| **Price** | Line/area, range buttons 1M · 6M · 1Y · 5Y · Max (each shows its own % return), log-scale toggle on Max, LTTB downsampling | Continuous series; downsampling keeps 2,900 points smooth |
| **Quarterly revenue and profit** | Paired columns (12 quarters / All) with a small YoY % strip under each | Discrete flows; a strip avoids a misleading dual axis |
| **Margins and ROE** | Lines: GM / OM / NP% (quarter) and ROE / ROA (TTM), sector-median ghost line | Trend versus the sector |
| **P/E and P/B history** | Lines with a sector-median band; n/m periods drawn as breaks with a "loss" marker | Is it cheap versus its own history and the sector? |
| **Balance-sheet strength** | Mirrored bars: cash + ST investments up, borrowings down, net-cash marker line; D/E in tooltip | "Debt vs net cash" read in one glance |
| **Ratio tables** | Annual and quarterly ratio tables (Company_View layout and labels), horizontally scrollable with sticky first column, CSV/XLSX download | Full detail for analysts |
| Peer chips | "Compare with…" chips that open head-to-head | One-click comparison |

### 4. Head-to-head (`/insights/pharma/compare?t=…`), 2-4 companies
- **Rebased price** (start of range = 100), coloured end labels (Koyfin).
- **Annual revenue and net profit:** grouped columns.
- **Margins and ROE:** small-multiple lines, one panel per metric, companies as lines.
- **Ratio dot plot:** rows = metrics (P/E, P/B, ROE, net margin, growth, D/E), one dot per company. Better than a radar chart, which distorts area.
- Side-by-side table with best value per row in bold.

### 5. Cross-sector overview (`/insights/sectors`)
- A card per sector from config: live sectors show their 4 KPIs + sparkline; "coming soon" sectors show a muted card.
- A cross-sector table (revenue growth, net margin, ROE, median P/E) that lists live sectors only, so it fills in as workbooks arrive.

### 6. Methodology and compliance
- Ratio definitions pulled from the Start sheet, plus our own rules (TTM, sector aggregation, outlier clipping, n/a and n/m meaning), fiscal-year table per company, data quirks.
- **A disclaimer block at the foot of every section** (placeholder text until Insight supplies wording) and a short line under every chart.

### States everywhere
Skeletons with the final layout's shape; empty states ("No balance sheet filed for Sep-2026 yet"); "not meaningful (loss)" chips; error state with a retry; a stress-test page via `/break-ui` (losses, 1,905% growth, 120x P/E, missing data, very long company names).

### Downloads (proposed rules, see question 4)
- Chart → PNG, stamped with title, source and as-of.
- Table → CSV and XLSX (XLSX writer lazy-loaded on click).
- Price series view-only (exchange data rights). Summary PDF deferred.
- Every download fires an analytics event.

---

## (e) Data schema and multi-sector

### Folders
```
website/
  data-src/pharma/PSX_Pharma_Model.xlsx     ← drop-in workbooks (one per sector)
  sectors.config.json                         ← one entry per sector
  scripts/convert/                            ← converter + validation (TypeScript, Node)
  public/data/
    sectors.json                              ← registry built from config + manifests
    pharma/manifest.json                      ← asOf dates, source file + hash, counts, warnings
    pharma/companies.json                     ← company master
    pharma/metrics.json                       ← metric dictionary
    pharma/facts.json                         ← all quarterly + annual values (long format)
    pharma/notes.json                         ← methodology text from the workbook
    pharma/prices/ABOT.json …                 ← one file per ticker, loaded on demand
```

### Core records (the proposal's schema: sector, company, period, metric, value, unit)
```jsonc
// facts.json: compact long format (field list once, rows as arrays: ~21k facts, ~150-250 KB after gzip/brotli on Cloudflare)
{ "sector": "pharma",
  "fields": ["company","period","periodType","periodEnd","fiscalYear","metric","value","status"],
  "rows": [["ABOT","Q4-2024","Q","2024-12-31",2024,"net_sales",18613,"ok"],
           ["SEARL","FY2025","FY","2025-06-30",2025,"pe",null,"nm"], …] }

// metrics.json: one entry per column the workbook carries
{ "id": "pe_ttm", "label": "P/E (TTM)", "unit": "x", "format": "0.0x",
  "direction": "lower_better", "group": "valuation", "basis": "quarterly",
  "source": { "sheet": "Qtr_Input", "header": "PE TTM" },
  "definition": "Average price for the quarter / TTM net profit …" }

// companies.json
{ "ticker": "SEARL", "name": "The Searle Company Ltd", "sharesOutstandingMn": 588.79,
  "fyEndMonth": 6, "firstQuarter": "2016-03-31", "lastQuarter": "2026-09-30",
  "lastBalanceSheet": "2026-09-30", "priceFrom": "2015-01-01", "priceTo": "2026-11-10" }

// prices/SEARL.json: [daysSinceEpoch, price] pairs
{ "ticker": "SEARL", "points": [[16436, 104.2], …] }
```
`unit` lives on the metric (PKR mn, %, x, Rs), and every fact carries a `status`: `ok | na | nm | blank | incomplete`, so the UI can say *why* a value is missing.

### How multi-sector works
- **`sectors.config.json`, one entry per sector:**
  ```jsonc
  { "slug": "banks", "name": "Banks", "status": "coming_soon", "colour": "#1F5F8B",
    "workbook": "data-src/banks/PSX_Banks_Model.xlsx",
    "kpis": ["revenue_ttm","net_profit_ttm","revenue_growth_ttm","pe_ttm:median","roe_ttm:aggregate"],
    "leagueTables": ["revenue_growth_yoy","net_margin","roe_ttm","net_cash_per_share"],
    "valuationMap": { "x": "roe_ttm", "y": "pe_ttm", "size": "market_cap" },
    "compareColumns": [...], "metricOverrides": { "debt_to_equity": { "direction": "neutral" } } }
  ```
- **Metric ids come from the workbook headers** ("PE TTM" → `pe_ttm`). A shared metric catalogue gives known metrics their unit and direction. **Unknown columns (e.g. bank ratios such as ADR, IDR, CASA) are picked up automatically** with an inferred unit and a converter warning, and can be refined in `metricOverrides`. No component changes.
- **Components never name a metric.** They receive metric ids from config, so a bank page uses its own KPIs, league tables and valuation axes.
- **Status rules:** `status: "live"` needs a valid workbook. "coming_soon" shows a muted card and disabled switcher item; "hidden" leaves the sector out.
- **Data access** goes through one `DataSource` interface. `StaticJsonSource` reads `/data/...` today; an `ApiSource` can replace it later with no component changes.

### Converter and validation (`npm run data`)
1. Reads every live sector in config.
2. **Validates and fails loudly**, naming the sheet, column, expected vs found and row number, and exiting non-zero:
   - required sheets and Excel tables;
   - required headers (missing or renamed → a "did you mean 'Net sales'?" suggestion);
   - types: dates are quarter-ends, numbers are numbers or the allowed sentinels;
   - every ticker exists in Companies; no duplicate (ticker, quarter); FY-end month is 6 or 12;
   - **calculated columns actually have cached values** (if empty: "Open and save the workbook in Excel so formulas calculate, then re-run");
   - spot-recomputes TTM sums, margins and P/E against Excel within tolerance.
3. **Cleans:** serial dates → ISO; "n/a"/"n/m"/blank → `status`; impossible zeros (net cash when there's no balance sheet) → n/a; incomplete years flagged.
4. Writes the JSON plus a manifest with a source-file hash and a human-readable `convert-report.md` (counts, warnings, coverage per company).
5. Re-running on a new workbook in the same format updates everything. Nothing is hardcoded in the UI.

---

## (f) Tech stack and integration

| Layer | Choice | Why |
|---|---|---|
| Build | **Vite + React 18 + TypeScript** | Matches their React SPA; static output, no Node server |
| Routing | **React Router v6** (data-agnostic `<Routes>`) | Drops into their router as `/insights/*`, or runs standalone |
| Styling | **Tailwind CSS v4 with a class prefix (`is:`)** and preflight scoped to `.insights-root`; design tokens as CSS variables on that root | Our classes and their Tailwind config can never collide in either direction |
| Charts | **Apache ECharts 5** (tree-shaken `echarts/core`, canvas renderer) | See below |
| Tables | **TanStack Table v8** (headless) | Sorting, sticky columns, our own markup and styles |
| Search | **cmdk** | Accessible ⌘K company search |
| Icons/fonts | **Lucide**, Google Fonts (Inter, Source Serif 4) | Same as their site |
| Downloads | ECharts `getDataURL` (PNG, stamped); our own CSV writer; **write-excel-file** for XLSX, lazy-loaded | Small bundle; XLSX code loads only on click |
| Analytics | `track(event, params)` pushes to `window.dataLayer` if it exists; no IDs | Events: `insights_sector_switch`, `insights_company_view`, `insights_compare`, `insights_period_change`, `insights_download` |
| Converter | **Node + TypeScript + ExcelJS** (`npm run data`) | One toolchain for the team; reads Excel tables and cached values |
| QA | Vitest (converter and formatters), Playwright (screenshots at 1440 / 1024 / 390, light and dark; console-error check) | Proposal asks for accuracy testing |

**Why ECharts over the alternatives**
- **One library for everything:** bubble, heatmap-styled bars, mirrored bars, dot plots, small multiples and the price series. One look, one tooltip system, one theme for dark mode.
- **Built-in LTTB downsampling** (`sampling: 'lttb'`) and `dataZoom` keep long price ranges smooth on mobile.
- Universal-transition animations for filter morphs; built-in ARIA descriptions and decal patterns for accessibility; PNG export.
- *Lightweight Charts* is excellent for prices but would add a second visual language for one chart. *visx* gives full control, but SVG with tens of thousands of points is slower and every interaction would be hand-built. *Recharts/Chart.js* (DataDarbar uses Chart.js) are weaker on tooltips, transitions and large series.

**Integration later (both paths supported from day one)**
1. **Static build at `/insights`:** `npm run build` → `dist/` with `base: '/insights/'`, plus a `.htaccess` SPA fallback for LiteSpeed. Cloudflare caches the JSON; the data folder is swapped on each refresh.
2. **Inside their React app:** a library build exports `<InsightsApp basename="/insights" dataUrl="/insights/data" embedded />`. Their router mounts `<Route path="/insights/*" element={<InsightsApp …/>} />`; in embedded mode our header, footer and ticker replicas are hidden and theirs are used.
3. **Standalone prototype:** it renders a replica of their header, footer and ticker (built from the /taste tokens), so the page can be judged in context. The ticker shows **last close from the workbook**, labelled "Last close · 10 Nov 2026", not live prices.

**Build order after approval:** converter + validation → design tokens (`/impeccable` context, then typeset, colorize, arrange) → chart and table primitives → sector overview → valuation and comparison → company deep-dive → head-to-head → tables, downloads, disclaimers → responsive and dark mode → `/emil-design-eng`, `/animate`, `/review-animations`, `/break-ui`, `/impeccable polish` and `harden` → Playwright screenshot matrix → cross-check ≥10 numbers against Excel → `npm run build` + preview → README.

---

## (g) Questions

1. **Sector totals across mixed fiscal years:** I recommend calendar-quarter TTM (all companies to the same quarter end) for sector KPIs and trends, including every company with data and noting when coverage changes (BFBIO joins in 2023). The alternative is a constant sample of companies with full history. OK?
2. **Comparison colours:** the Excel rule covers valuation (lower = green) and "other ratios" (higher = green). For **debt to equity**, I'll treat lower as green; for **net cash per share**, higher as green. Confirm?
3. **Latest filings:** the workbook has no filing dates, titles or links. For the prototype I'll show a derived "latest data loaded" list per company. Can the AI pipeline add an optional `Filings` sheet (Ticker, Date, Title, URL)? The converter would pick it up automatically if present.
4. **Download rules:** proposed PNG for charts and CSV/XLSX for tables, with the price series view-only and the summary PDF deferred. Agree?
5. **Disclaimer text:** I'll use clearly marked placeholder wording until Insight's compliance team supplies it. OK?
6. **Recalculated workbooks:** will the pipeline's workbooks be saved through Excel (or LibreOffice) so formula results exist? If not, I'll make the converter compute the ratios itself for this template (it already verifies against them).
7. **Accent colour:** amber #D99A1E as the single emphasis colour (so green stays free for "good performance"), or would you rather the highlight be their brand green and performance use blue/orange?
8. **Headline font:** Inter + Source Serif 4 for insight headlines (more editorial), or Inter-only to match their site exactly?
9. **Default landing:** `/insights` opens the Pharma sector page (recommended while only one sector is live), not the cross-sector overview. OK?
10. **Their exact React and React Router versions:** can the vendor confirm (I'm assuming React 18 / Router v6)? This only matters for the embedded build.
