# -*- coding: utf-8 -*-
"""PRIS 캐시 HTML → units CSV 파서 v1"""
import sys, re, pathlib, csv
from bs4 import BeautifulSoup

CACHE = pathlib.Path(sys.argv[1])
OUT = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else CACHE / "units_raw.csv"

MONTH = {m: i for i, m in enumerate(
    ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], 1)}

def norm_date(s):
    # "20 Jul, 1976" -> 1976-07-20
    m = re.match(r"(\d{1,2})\s+([A-Za-z]{3}),?\s+(\d{4})", s or "")
    if not m:
        return ""
    d, mon, y = m.groups()
    return f"{y}-{MONTH.get(mon, 0):02d}-{int(d):02d}"

def get_span(s, key):
    el = s.find("span", id=re.compile(key + "$"))
    return el.get_text(" ", strip=True) if el else ""

rows = []
files = sorted(CACHE.glob("r*.html"), key=lambda p: int(re.sub(r"\D", "", p.name)))
for f in files:
    html = f.read_text(encoding="utf-8", errors="ignore")
    if "Errorpage" in html[:2000]:
        continue
    s = BeautifulSoup(html, "lxml")
    name = get_span(s, "lblReactorName")
    if not name:
        continue
    a = s.select_one("a[href*='CountryDetails.aspx?current=']")
    ccode, cname = "", ""
    if a:
        ccode = a["href"].split("current=")[-1]
        cname = a.get_text(strip=True)
    # Owner/Operator: 표에서 Type|Model|Owner|Operator 헤더 다음 행
    owner = operator = ""
    for td in s.find_all("td"):
        if td.get_text(strip=True) == "Owner":
            tr = td.find_parent("tr")
            hdrs = [c.get_text(strip=True) for c in tr.find_all(["td", "th"])]
            val_tr = tr.find_next_sibling("tr")
            if val_tr:
                vals = [c.get_text(" ", strip=True) for c in val_tr.find_all(["td", "th"])]
                m = dict(zip(hdrs, vals))
                owner, operator = m.get("Owner", ""), m.get("Operator", "")
            break
    rows.append({
        "pris_id": int(re.sub(r"\D", "", f.name)),
        "name": name,
        "alt_name": get_span(s, "lblAlternateName").strip("()"),
        "country_code": ccode,
        "country": cname,
        "status": get_span(s, "lblReactorStatus"),
        "type": get_span(s, "lblType"),
        "model": get_span(s, "lblModel"),
        "owner": owner,
        "operator": operator,
        "net_mwe": get_span(s, "lblNetCapacity"),
        "design_net_mwe": get_span(s, "lblDesignNetCapacity"),
        "gross_mwe": get_span(s, "lblGrossCapacity"),
        "thermal_mwt": get_span(s, "lblThermalCapacity"),
        "construction_start": norm_date(get_span(s, "lblConstructionStartDate")),
        "first_criticality": norm_date(get_span(s, "lblFirstCriticality")),
        "grid_connection": norm_date(get_span(s, "lblGridConnectionDate")),
        "commercial_operation": norm_date(get_span(s, "lblCommercialOperationDate")),
        "permanent_shutdown": norm_date(get_span(s, "lblPermanentShutdownDate")),
        "lifetime_generation_twh": get_span(s, "lblGeneration").replace("TW.h", "").strip(),
        "lifetime_eaf_pct": get_span(s, "lblEAF").replace("%", "").strip(),
        "perf_asof_year": get_span(s, "lblLifetimePerformanceYear"),
    })

OUT.parent.mkdir(parents=True, exist_ok=True)
with open(OUT, "w", newline="", encoding="utf-8-sig") as fp:
    w = csv.DictWriter(fp, fieldnames=list(rows[0].keys()))
    w.writeheader()
    w.writerows(rows)
print(f"parsed {len(rows)} units -> {OUT}")
print("countries:", len({r['country_code'] for r in rows}))
print("statuses:", sorted({r['status'] for r in rows}))
print("types:", sorted({r['type'] for r in rows}))
