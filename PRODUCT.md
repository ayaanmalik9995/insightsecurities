# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Vite + React 19 + TypeScript + React Router 7 + Tailwind CSS 4 + Lucide icons + Apache ECharts 6, static build with no server. Chosen by the agency brief to match Insight Securities' own React/Tailwind/Lucide site; deploy target agreed as the subdomain insights.insightsec.com.pk, with a `/insights` path build as fallback.

## Users

- **Fund managers and buy-side analysts** (primary, per the 31 Oct 2026 review meeting): compare PSX companies within a sector on profitability, growth, leverage and valuation, usually at a desk beside Excel and a trading terminal.
- **Retail investors and prospective Insight Securities clients** (secondary, inferred from the public website context): want the sector story and a company snapshot without reading a spreadsheet.

## Product Purpose

A public "Insights" dashboard on Insight Securities' web presence that turns the research team's sector workbooks into an always-current, interactive view of each PSX sector and its companies. Success: the research team drops in a new workbook and every number, chart and table updates with zero code changes, and readers trust the figures enough to act on them.

## Positioning

Built directly on Insight Securities' own research model (the same workbook the analysts maintain), with its ratio definitions, fiscal-year handling and comparison logic, not a generic market-data widget.

## Operating Context

- Data arrives as one Excel workbook per sector in a fixed format (Companies, Qtr_Input, Annual, Prices, Compare, Company_View, Start). Formulas are calculated in Excel before hand-over. An AI pipeline will later produce the same workbook.
- A converter turns each workbook into static JSON; the dashboard reads only that JSON (later swappable for a read-only API).
- First sector: Pharmaceuticals (13 PSX companies, June and December fiscal years, quarterly data from 2016, daily adjusted prices from 2015). Banks, cement and fertiliser follow.

## Capabilities and Constraints

- Sector overview, valuation map, comparison heatmap, league tables, company deep-dive, 2-4 company head-to-head, methodology, cross-sector overview.
- Hover details: exact value, period, change, source date. Tables under charts; chart PNG and table CSV/XLSX downloads; price series view-only.
- No live price feed (out of contract scope): the ticker shows last close from the workbook.
- Compliance disclaimer on every section; final wording to come from Insight Securities (placeholder until then).
- No viewer accounts or logins.
- GA/GTM event hooks without tracking IDs.

## Brand Commitments

- Insight Securities logo (research/brand/insight-logo.png, footer-logo.png, insight-favicon.svg), signature deep green (#008F3C primary, #004015 footer) and white, Inter, header/footer structure and the dark PSX ticker bar of insightsec.com.pk. The dashboard must feel native to that site and clearly more premium.
- Green/red reserved for performance and colour-blind safe; one accent colour for emphasis (agency decision: amber).

## Evidence on Hand

- data-src/pharma/PSX_Pharma_Model.xlsx (demo data in the production format).
- Methodology text from the workbook's Start sheet.
- No filing dates, titles or links exist yet; an optional Filings sheet may be added later. Do not fabricate filings, prices or claims.

## Product Principles

1. The workbook is the source of truth: every displayed number traces to it, nothing is hardcoded.
2. Provenance beside the number: unit, period and as-of date travel with every figure.
3. Story first, detail on demand: the finding leads; tables, hovers and downloads hold the depth.
4. Honest charts: zero baselines for bars, no smoothing, gaps shown as gaps, n/a and n/m explained.
5. Sector-agnostic: a new sector is a workbook plus one config entry.

## Accessibility & Inclusion

WCAG 2.1 AA contrast; colour never the only cue for up/down (arrows and signs); keyboard-operable selectors and tables; `prefers-reduced-motion` respected; usable at 390px width.
