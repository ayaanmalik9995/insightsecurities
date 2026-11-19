# Design Map

Source: https://insightsec.com.pk/ (homepage, 1440x900, single page; a "Shareholder Agahi" modal was closed before capture)

## Spacing Scale
- Base unit 4px (Tailwind). Most used: 4, 8, 12, 16, 24, 32, 48, 64, 80px
- Section padding: 80px (`--section-padding: 5rem`)
- Body padding-bottom 74px, which reserves space for the fixed ticker

## Font Hierarchy
- Family: Inter only (Google Fonts), weights 400 / 500 / 600 / 700
- Hero: 50px / 700
- h2: 42px / 700 / 40px line-height
- h3/h4: 18px / 600 / 28px
- Lead body: 18px / 400 / 28px, max-width 512px
- Body and nav: 14px / 400, nav colour #737373
- Button: 14px / 600
- Ticker symbol 13px / 700; ticker meta 8.5px / 600 uppercase, tracking 0.02em
- Most frequent sizes: 12px, 14px, 11px, 13px (dense UI text)

## Color Palette
- Background #FFFFFF; text #1A1A1A; muted #737373; border #E6E6E6
- Brand primary #008F3C (hsl 145 100% 28%)
- Primary dark #003D1A (hsl 145 100% 12%); footer band #004015
- Primary soft #EFF7F2 (hsl 145 33% 95%); accent tint #EBFFF3
- Dark band #141414
- Ticker: bar #111315, chip #1A1D20, meta text #AEB8B3, up #27D996, down #FF5867, live dot #00A34A
- Danger token hsl(0 72% 51%) ≈ #DC2626

## Image Ratios
- Hero slider 2.4:1 (1425px wide)
- Service cards 1.33:1
- Logo 3.07:1 (292x95 PNG, saved as `insight-logo.png`); white footer logo 3.17:1 (`footer-logo.png`); favicon SVG (`insight-favicon.svg`)

## Component Tokens
- Radius: 4px, 7px (ticker chips), 12px (buttons), 16px (cards), 24px, 9999px (pills), `--radius: 0.75rem`
- Shadows: Tailwind sm `0 1px 2px rgba(0,0,0,.05)`, md, lg; `0 4px 20px rgba(0,0,0,.08)`; ticker `drop-shadow(0 -3px 10px rgba(0,0,0,.18))`
- Container max 1280px; 3-column card grids; contact grid 2 columns, gap 40px
- Header: fixed, 81px, white 95% + blur(4px), 1px #E6E6E6 bottom border, green 44px CTA "Get in Touch"
- Ticker: fixed bottom, 74px = 16px meta tabs + 58px marquee; chips 44px tall, min-width 190-205px, 7px radius, change shown as a tinted pill with an arrow
- Footer: #004015, 4 columns (brand + socials / Resources / Helpful Links / Contacts), regulator badges, centred copyright
- Motion: 150-200ms `cubic-bezier(0.4, 0, 0.2, 1)`; has `prefers-reduced-motion` and `:focus-visible` rules
- WhatsApp "Need Help? Chat with us" floating pill, bottom right, above the ticker

---

# Taste DNA

### One green, no second brand hue
- **Trigger**: When the brand needed emphasis in headlines, CTAs, icons and section bands
- **Decision**: A single green family (#008F3C / #003D1A / #004015 / #EFF7F2) over pairing green with a secondary brand colour such as gold or navy
- **Reason**: A brokerage is judged on steadiness. One recurring colour makes every green element read as "Insight" and keeps attention on the numbers and the call to action.
- **Evidence**: `--primary 145 100% 28%` on the 44px "Get in Touch" pill and on headline words; `--primary-dark 145 100% 12%`; footer #004015; neutrals at 0% saturation (#1A1A1A, #737373, #E6E6E6), so no other hue competes

### Live market data gets its own dark terminal register
- **Trigger**: When putting live PSX prices on a marketing page that is otherwise white
- **Decision**: A fixed near-black ticker (#111315 bar, #1A1D20 chips) with bright up/down colours (#27D996 / #FF5867), instead of styling prices in the page's white-and-green palette
- **Reason**: Traders recognise a dark strip with coloured deltas as market data, so they know these numbers are live and come from the exchange, not from marketing copy
- **Evidence**: Ticker fixed at bottom, 74px tall, z-index 200; 8.5px uppercase "LAST UPDATE" and "SOURCE: PSX" tabs; change pills tinted rgba(39,217,150,.1) / rgba(255,88,103,.1); body padding-bottom 74px

### Full-bleed colour bands instead of dividers
- **Trigger**: When separating ten-plus sections on a 5,842px page
- **Decision**: Alternating full-width bands (white, deep green, white, #141414, white, #004015 footer) with 80px padding, instead of hairline dividers or one uniform white page
- **Reason**: On a long scroll a colour change is the strongest "new chapter" signal, and each dark band gives one product (trading portal, awards) the whole stage
- **Evidence**: `--section-padding: 5rem`; #141414 Awards band; green "Trade Smarter" band; 80px and 64px among the most frequent spacing values

### Off-the-shelf component system, not bespoke type
- **Trigger**: When choosing type, radii and shadows for a React + Tailwind build
- **Decision**: shadcn/Tailwind defaults (Inter only, `--radius: .75rem`, stock sm/md/lg shadows, 150-200ms ease) over a custom type pairing and hand-tuned elevation
- **Reason**: The vendor chose build speed and consistency across pages. The cost is that numbers, tables and headings have no voice of their own, and that is the gap a data product can fill.
- **Evidence**: Inter is the only family (936 of 936 sampled elements); prices lack tabular numerals; shadows are stock Tailwind values; radii of 7 / 12 / 16 / 9999px follow no parent-child logic
