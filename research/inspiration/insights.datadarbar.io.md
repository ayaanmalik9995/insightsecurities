# Design Map

Source: https://insights.datadarbar.io/pakistan-banks-2025-performance-tracker/
The article is a WordPress post (serif headline, byline, hero image) that embeds a separate Chart.js dashboard in an iframe: https://datadarbar.github.io/DD-charts/pakistan_banking_sector_dashboard.html (2,682px tall, 22 canvases). Analysed at 1440x900 across all four tabs.

## Spacing Scale
- Body padding 20px 24px; chart grid 2 columns, ~24px gutter, no max-width (fills the iframe)
- KPI row: 4 equal cards; about 48px between chart rows

## Font Hierarchy
- Family: Poppins only (dashboard); the article shell uses a serif display face
- Dashboard title: 20px / 500 / #0A4C76
- Meta line: 11px / 400 / #999999 ("FY2025 | PKR Billions | P&L = annual sum of 4 quarters | BS = Dec 2025 snapshot | Source: Company Financials")
- Chart title: ~13px / 500 / #1A1A1A; chart subtitle: ~11px / #999 (unit and period)
- KPI value: 20px / 500 / #0A4C76; KPI label and caption ~11px grey
- Tabs: 12px / 400, padding 6px 16px, radius 6px

## Color Palette
- Background #FFFFFF; KPI card fill ~#EEF5FB
- Primary navy #0A4C76 (bars, active tab, KPI numbers)
- Negative red #C0392B (growth bars below zero; IDR > 100% points)
- Scatter tiers: navy, light blue ~#4BA3D9, grey ~#A8A8A8 (encoding not explained on the page)
- Gridlines ~#EEEEEE; axis text ~#666

## Image Ratios
- Article hero 16:9 static PNG of the dashboard (1536x864)
- Chart panels ~1.6:1 (bars), ~2.4:1 (scatters at full width)

## Component Tokens
- Tabs: P&L Rankings | Balance Sheet | Key Ratios | Trends (filled navy = active, outline = idle)
- KPI cards: label, then big number, then "PKR Bn | FY2025 annual" caption
- Paired charts per metric: left = level (horizontal bar, sorted desc), right = YoY growth (diverging bar, sorted asc, red below 0)
- Scatter: labelled points (ticker text above each dot), axis titles in grey, "Equal axis spacing" note
- Trends tab: metric <select> + multi-select listbox ("Hold Ctrl/Cmd to select multiple banks"), spline lines
- Footer line: "...Source: Company Financials | Built with Chart.js"
- Animation: Chart.js default 1000ms easeOutQuart on every tab switch

---

# Taste DNA

### Pair every level with its change
- **Trigger**: When showing a metric such as PAT across 18 banks
- **Decision**: Two charts side by side, the level as sorted horizontal bars and the YoY change as a diverging bar, instead of one bar chart with a growth label
- **Reason**: Fund managers ask "who is biggest?" and "who is moving?" together. Side by side, both questions are answered without a click.
- **Evidence**: PAT, Gross Markup, Net Markup, Fee & Commission, Total Assets and Deposits all follow the level + growth pair; growth bars are red below 0% and navy above

### One ink colour; red only means "down"
- **Trigger**: When colouring about 20 bar charts and 2 scatters
- **Decision**: Every bar is navy #0A4C76 and only negative values turn #C0392B, instead of a categorical colour per bank
- **Reason**: With 18 banks, per-bank colours become noise. One ink keeps attention on length, and red becomes a signal you notice at once.
- **Evidence**: The Chart.js datasets use backgroundColor arrays of #0a4c76 with #c0392b only on negative indices; KPI numbers and the active tab reuse the same navy

### Method on the page, not in a footnote
- **Trigger**: When numbers mix annual sums and year-end snapshots
- **Decision**: An 11px meta line under the title states the period, unit, aggregation rule and source, and every chart subtitle repeats unit and period, instead of a separate methodology page
- **Reason**: An analyst checks "is this annual or Q4?" before trusting a bar. Answering it next to the chart removes the doubt.
- **Evidence**: "P&L = annual sum of 4 quarters | BS = Dec 2025 snapshot"; chart subtitles "PKR Billions | Annual" and "FY2025 vs FY2024"; KPI captions "PKR Bn | Dec 2025"

### No tables, no insight headlines (restraint, and its cost)
- **Trigger**: When deciding how much to say beyond the charts
- **Decision**: Charts only, with label-style titles ("PAT — FY2025") and no data tables, annotations or written takeaways, instead of a narrative layer
- **Reason**: It ships quickly and stays neutral, but readers must find the story themselves and cannot copy or verify exact values. Our dashboard should borrow the structure and add what is missing here.
- **Evidence**: 0 HTML tables; titles are metric names; level and growth charts sort differently, so the eye cannot follow one bank across a pair; default tooltips (`callbacks: {}`); spline lines (tension) in Trends can overshoot real values
