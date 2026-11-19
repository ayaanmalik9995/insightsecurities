# Peer financial dashboards: what to borrow, what to avoid

Captured with Playwright at 1440x900 on 19 Nov 2026 (screenshots in `research/screens/peer-*`). Cookie walls were dismissed by removing the overlay, not by accepting. Stripe and Linear dashboards need a login, so those notes come from known product patterns, not a fresh capture.

## 1. Financial Times: Markets Data tearsheet (markets.ft.com)
**Why it feels trustworthy**
- Every number carries provenance: "Data delayed at least 20 minutes, as of Nov 19 2026 14:35 GMT" sits directly under the price strip.
- Labelled header stats in a fixed order (PRICE (GBX), TODAY'S CHANGE, SHARES TRADED, 1 YEAR CHANGE, BETA), with small-caps underlined labels and 22px values. The unit lives in the label.
- A custom sans (Metric) for data and a serif (Financier) for headings: news authority plus data legibility.
- Tabs (Summary / Charts / Profile / Financials / Forecasts / Historical prices) and sub-tabs (Income statement / Cash flow / Balance sheet) mirror how analysts think.
- One brand tint (salmon #FFF1E5) and one action colour (teal #0D7680); red/green appear only on deltas, with arrow glyphs so they don't depend on colour.

**Borrow:** the as-of line under every figure block; up/down arrow glyphs plus colour; statement sub-tabs; the restrained two-colour discipline.
**Avoid:** the dense ad and promo slots ("Find More Stocks" banner) between header and data; paywall interruptions.

## 2. TradingView: symbol page (tradingview.com/symbols/PSX-SEARL)
**Why it feels trustworthy**
- The price chart sits first, with a range row underneath (1 day, 5 days, 1 month ... All time), and each range button shows its own % return. The selector itself is information.
- "Key stats" grid: label, then value with unit suffix in smaller type ("46.58 B PKR"), 4 columns, lots of air.
- Peer strip ("People also watch": AGP, HPL, FEROZ, CPHL, BFBIO) makes comparison one click away.
- A single area series in teal with a gradient fill, a last-price tag on the right axis, and nothing else on the canvas.

**Borrow:** returns printed on the range buttons; unit as a smaller suffix; last-value tag on the axis; peer chips that open head-to-head.
**Avoid:** the 1,000+ px of marketing modules below the fold; neon area gradients on long ranges (they exaggerate drawdowns visually).

## 3. Koyfin (koyfin.com; app screens shown on the marketing page)
**Why it feels trustworthy**
- Terminal density done calmly: 11-12px tables with right-aligned Price / Chg / % columns, hairline row rules, grey group headers ("Broad Markets", "Developed Markets").
- Heatmap tiles (US Equity Factors grid) use pale green/red fills with dark text, so values stay readable and colour intensity carries magnitude.
- Multi-series comparison chart rebased to 0%, with coloured end-of-line labels (CWB -2.78%, SPX -4.10%) instead of a legend.
- One accent blue for selection; everything else is neutral grey (#5E6166 text, #191E25 headings), set in Aktiv Grotesk.

**Borrow:** rebased (% change) comparison lines with end labels for head-to-head; pale-fill heatmap cells with dark text for the Compare table; right-aligned tabular columns.
**Avoid:** full terminal density on a public site; Insight's audience includes retail investors, so detail should sit one layer down.

## 4. Stripe / Linear dashboard polish (product pattern notes)
**Why it feels premium**
- KPI cards with a label, a large tabular number, a delta chip and a sparkline drawn without axes, all on one 4px rhythm.
- Neutral greys tinted toward the brand hue; 1px borders instead of shadows; one accent colour.
- Motion is short (150-250ms), interruptible and used only on state change. Skeletons match the final layout exactly, so nothing jumps when data arrives.
- Command-K style search for jumping straight to an entity (here: a company).

**Borrow:** delta chip + sparkline KPI card anatomy; layout-exact skeletons; keyboard company search; border-not-shadow surfaces.
**Avoid:** SaaS "gradient glow" hero treatments, which would read as a startup, not a 30-year brokerage.

## 5. DataDarbar banks tracker (client's main reference; full analysis in `insights.datadarbar.io.md`)
**Borrow:** tabbed sector story (P&L, Balance sheet, Ratios, Trends); level + growth chart pairs; labelled-point scatter with quadrant reading; a meta line stating period, unit, aggregation and source.
**Fix in our version:** insight headlines instead of label titles; a sortable table under every chart; one consistent sort so a company can be traced across paired charts; real hover tooltips (value, period, change, source date); no spline smoothing; a chip-based company picker instead of a Ctrl-click listbox; a mobile layout.

## Synthesis: what makes all of them read as trustworthy
1. Provenance next to the number (as-of time, source, unit), never only in a footer.
2. Colour means something (direction or selection), and nothing else is coloured.
3. Numerals are aligned, right-aligned in tables and carry units as suffixes.
4. The first screen answers the headline question; detail is one tab, hover or row away.
5. Charts are honest: zero baselines for bars, no smoothing, consistent sorts, explicit gaps for missing data.
