---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: []
---

# Surface brief: Insights dashboard (all routes)

Scope: sector overview, valuation, company deep-dive, head-to-head, sectors, methodology. Visitor mode: Operate (with Read moments in the insight headlines and methodology).
Audience/job: fund managers comparing PSX companies within a sector; retail readers wanting the story. Constraints: data only from converted workbook JSON; brand of insightsec.com.pk; light default, dark toggle.
Memorable moment: the deep-green "research note" band whose headline sentence is written by the data itself.

## Direction contract

THESIS: A research house's sector note that happens to be interactive. Every block opens with a sentence the data wrote, then proves it. Refuses the category default of a grid of identical KPI tiles and label-titled charts (DataDarbar, most broker dashboards).

OWN-WORLD: Insight's white-and-green site in research mode. Paper white #FFFFFF on a faint green-grey field, ink #101A15, one brand green #008F3C for actions and selection, deep green #00321A band, amber #C98A12 only for "the company under discussion". Performance green #0E7A47 / red #C0392B always with ▲▼. Inter with tabular numerals for everything; Source Serif 4 upright (never italic) for insight headlines only. 1px tinted hairlines, 12px radii, no resting shadows. The PSX ticker's dark register (#0F1512) appears only where market prices live.

STORY: Visitor reads the sector's one-sentence finding, sees five KPIs with their periods, then trends, valuation and rankings; clicks any company to its deep-dive or adds peers to a head-to-head; downloads what they need; always knows the as-of date and method.

FIRST VIEWPORT: Site header (logo, nav, sector switcher) → deep-green band spanning full width: left two-thirds holds the serif headline (40px desktop) written from data plus a one-line method/as-of note; right third holds a compact sector "fact strip" (companies, financials to, prices to). Directly below, overlapping the band's bottom edge by 32px, a single white ruled panel holding the five KPIs as columns divided by hairlines (not separate cards), each with number, delta, period, and a 12-quarter micro-trend. Primary action: section tabs + company search sit sticky above the panel.

FORM: Research note / broker sector report translated to an interactive page; position 1 of the approved PLAN.md structure; seed key: none (structure pinned by the approved plan; concept-seed not run because the surface was precisely specified and approved).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
