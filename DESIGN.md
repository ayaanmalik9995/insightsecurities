# Design system: Insight Securities Insights

Insight Securities' white-and-green site, in research-house mode: a sector note whose sentences are written by the data, with the PSX ticker's dark register kept for market prices. Tokens live in `src/styles/index.css` (CSS variables, light and dark) and are read into charts by `src/lib/theme.tsx`.

## Colour
| Role | Light | Dark | Use |
|---|---|---|---|
| Page field | `#F3F6F4` | `#0A100D` | Background behind panels |
| Surface | `#FFFFFF` | `#111815` | Panels, header |
| Ink / ink-2 / muted / faint | `#101A15` / `#33413A` / `#5A6760` / `#86938C` | `#E7EEE9` / `#C3CEC8` / `#98A69F` / `#6C7A73` | Text hierarchy; neutrals tinted toward the brand hue |
| Line / line-strong | `#E0E7E3` / `#C9D4CE` | `#22302A` / `#31423A` | 1px borders; no resting shadows |
| Brand | `#008F3C` (text `#00753A`) | `#34C274` | Actions, active tab, focus, "cheap and strong" |
| Brand deep | `#00321A` | `#0B2417` | Research-note band; footer `#004015` |
| Accent (only emphasis colour) | `#C98A12` | `#E5A93B` | The company under discussion in a chart |
| Positive / negative | `#0E7A47` / `#C0392B` | `#3FC985` / `#F06A5C` | Performance only, always with an arrow and a sign |
| Data ink | `#3E4C45`, `#A9B6AF`, `#D6DFDA` | `#B9C7C0`, `#56655E`, `#2B3832` | Default bars and lines, context series |
| Series (head-to-head) | `#00753A`, `#2F6DB5`, `#C98A12`, `#9B4F96` | lightened | Up to four companies |

## Type
- **Inter** for UI and every figure, with `font-variant-numeric: tabular-nums` (`.num`); numbers right-aligned in tables.
- **Source Serif 4** (upright, 600) for insight headlines only: page lead sentences, panel titles and the hero.
- Scale: 11 / 12 / 12.5 / 13.5 / 15 / 17 / 21 / 26–34 / 40–44px. Tracking −0.02 to −0.03em on large sans headings.

## Layout
- Max width 1280px; side gutters 16 / 24 / 32px; 4px spacing base; 56–64px between sections.
- Panels: 1px border, 12px radius, header (serif finding + metric/unit/period subtitle + controls), body, footer (notes + source line).
- KPI strip: one panel divided by hairlines, overlapping the deep-green band by 56px.

## Charts (ECharts)
- Bars from zero; losses below zero in the negative colour; no smoothing; gaps stay gaps.
- Horizontal gridlines only; direct end labels instead of legends; sector medians as dashed ghost lines.
- Outliers clipped and pinned to the edge with their true value in the label; tables show exact values.
- Tooltip: title (company/period), value with unit, change vs a year earlier with a drawn up/down marker, and a source line.

## Motion
- Charts draw once when scrolled into view (520ms cubic-out), then morph in 260ms on filter changes.
- UI transitions 150–260ms with `cubic-bezier(0.2, 0.8, 0.2, 1)`, transform and opacity only.
- `prefers-reduced-motion` disables chart animation, the ticker marquee and transitions.
