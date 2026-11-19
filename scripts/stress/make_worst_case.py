"""
Build a worst-case sector workbook from the pharma workbook, for UI stress tests.

    python scripts/stress/make_worst_case.py

Writes data-src/stress/PSX_Stress_Model.xlsx (values only, as Excel would have
calculated them). Every extreme is plausible for a PSX sector:
  - a very long company name (Haleon's former legal name)
  - a new listing with one quarter of history, no balance sheet, 4 days of prices
  - a company with no prices at all
  - a quarter with tiny profit (P/E ~900x) and growth from a tiny base (+12,400%)
  - negative equity (P/B and D/E negative)
  - a giant (PSO-sized revenue, PKR 3+ trillion a year) next to tiny companies
  - a deep loss quarter (net margin -250%)
"""
import datetime as dt
import sys
from pathlib import Path

import openpyxl

root = Path(__file__).resolve().parents[2]
src = root / "data-src" / "pharma" / "PSX_Pharma_Model.xlsx"
out_dir = root / "data-src" / "stress"
out_dir.mkdir(parents=True, exist_ok=True)
out = out_dir / "PSX_Stress_Model.xlsx"

wb = openpyxl.load_workbook(src, data_only=True)


def header_map(ws, row=4):
    return {c.value: i + 1 for i, c in enumerate(ws[row]) if c.value}


co = wb["Companies"]
q = wb["Qtr_Input"]
an = wb["Annual"]
pr = wb["Prices"]
H = header_map(q)
HA = header_map(an)

# 1. Very long legal name
for r in range(5, co.max_row + 1):
    if co.cell(r, 1).value == "HALEON":
        co.cell(r, 2).value = "GlaxoSmithKline Consumer Healthcare Pakistan Limited (now Haleon Pakistan Limited)"
    if co.cell(r, 1).value == "IBLHL":
        co.cell(r, 2).value = "IBL HealthCare Ltd"

# 2. New listing: one quarter, no balance sheet
r = co.max_row + 1
co.cell(r, 1).value = "NEWPH"
co.cell(r, 2).value = "Nova Pharmaceutical Industries Ltd"
co.cell(r, 3).value = 41.2
co.cell(r, 4).value = 6
qr = q.max_row + 1
q.cell(qr, H["Ticker"]).value = "NEWPH"
q.cell(qr, H["Quarter end"]).value = dt.datetime(2026, 9, 30)
for k, v in {"Net sales": 1, "Gross profit": 0, "Operating profit": -3, "Net profit": -2}.items():
    q.cell(qr, H[k]).value = v
for k in ["Quarter", "Year", "Fiscal year", "Key"]:
    q.cell(qr, H[k]).value = {"Quarter": "Q3-2026", "Year": 2026, "Fiscal year": 2027, "Key": "NEWPH|46295"}[k]
q.cell(qr, H["Total borrowings"]).value = 0
q.cell(qr, H["Net cash"]).value = 0
for k in ["TTM net sales", "TTM net profit", "Prior TTM net sales", "Prior TTM net profit", "Revenue growth QoQ", "Net profit growth QoQ",
          "Revenue growth YoY", "Net profit growth YoY", "ROE TTM", "ROA TTM", "TTM net profit growth", "TTM revenue growth",
          "Debt to equity", "Net cash per share", "PE TTM", "PS TTM", "PB"]:
    q.cell(qr, H[k]).value = "n/a"
q.cell(qr, H["Average price"]).value = 31.5
q.cell(qr, H["Market cap"]).value = 31.5 * 41.2
q.cell(qr, H["Gross margin"]).value = 0
q.cell(qr, H["Operating margin"]).value = -3
q.cell(qr, H["Net margin"]).value = -2
pstart = pr.max_row + 1
for i, (d, p) in enumerate([(46330, 30.0), (46331, 33.0), (46332, 31.1), (46333, 29.9)]):
    pr.cell(pstart + i, 1).value = "NEWPH"
    pr.cell(pstart + i, 2).value = d
    pr.cell(pstart + i, 3).value = p

# 3. A company with no prices at all (delete OTSU price rows by blanking the ticker)
for rr in range(5, pr.max_row + 1):
    if pr.cell(rr, 1).value == "OTSU":
        pr.cell(rr, 1).value = None
        pr.cell(rr, 2).value = None
        pr.cell(rr, 3).value = None
for rr in range(5, q.max_row + 1):
    if q.cell(rr, 1).value == "OTSU":
        for k in ["Average price", "Market cap", "PE TTM", "PS TTM", "PB"]:
            q.cell(rr, H[k]).value = "n/a"

# 4-7. Extremes in the latest two quarters
for rr in range(5, q.max_row + 1):
    t, d = q.cell(rr, 1).value, q.cell(rr, 2).value
    if not t or not isinstance(d, dt.datetime):
        continue
    if t == "MACTER" and d.year == 2026 and d.month in (6, 9):
        q.cell(rr, H["PE TTM"]).value = 912.4
        q.cell(rr, H["TTM net profit growth"]).value = 124.0
        q.cell(rr, H["Net profit growth YoY"]).value = 124.0
    if t == "FEROZ" and d.year == 2026 and d.month in (6, 9):
        q.cell(rr, H["Total equity"]).value = -1840
        q.cell(rr, H["PB"]).value = -4.6
        q.cell(rr, H["Debt to equity"]).value = -2.3
        q.cell(rr, H["ROE TTM"]).value = "n/m"
    if t == "ABOT" and d.year >= 2025:
        for k in ["Net sales", "TTM net sales", "Gross profit"]:
            v = q.cell(rr, H[k]).value
            if isinstance(v, (int, float)):
                q.cell(rr, H[k]).value = v * 45
    if t == "HPL" and d.year == 2026 and d.month == 6:
        q.cell(rr, H["Net profit"]).value = -2500
        q.cell(rr, H["Net margin"]).value = -2.5

# The new listing appears in Annual as an incomplete year
ar = an.max_row + 1
an.cell(ar, HA["Ticker"]).value = "NEWPH"
an.cell(ar, HA["Year"]).value = 2027
an.cell(ar, HA["FY end"]).value = 46568
an.cell(ar, HA["Status"]).value = "Incomplete: 1 of 4 qtrs"
an.cell(ar, HA["Key"]).value = "NEWPH|2027"

wb.save(out)
print(f"wrote {out.relative_to(root)}")
