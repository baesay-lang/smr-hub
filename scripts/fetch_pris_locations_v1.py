# -*- coding: utf-8 -*-
"""PRIS 국가 페이지에서 유닛별 Location 수집 v1
units_raw.csv의 국가코드 목록으로 CountryDetails 페이지를 받아
유닛명 → 소재지 매핑 CSV 생성.
"""
import sys, csv, pathlib, subprocess
from bs4 import BeautifulSoup

CACHE = pathlib.Path(sys.argv[1])
UNITS_CSV = CACHE / "units_raw.csv"
OUT = CACHE / "locations.csv"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0"

codes = sorted({r["country_code"] for r in csv.DictReader(open(UNITS_CSV, encoding="utf-8-sig")) if r["country_code"]})
print("countries:", len(codes))

cdir = CACHE / "countries"
cdir.mkdir(exist_ok=True)
cfg_lines = []
for c in codes:
    out = cdir / f"{c}.html"
    if out.exists() and out.stat().st_size > 5000:
        continue
    cfg_lines.append(f'url = "https://pris.iaea.org/PRIS/CountryStatistics/CountryDetails.aspx?current={c}"\noutput = "{out.as_posix()}"')
if cfg_lines:
    cfg = cdir / "_curl.cfg"
    cfg.write_text("\n".join(cfg_lines), encoding="utf-8")
    subprocess.run(["curl", "-sL", "--parallel", "--parallel-max", "8", "-A", UA,
                    "--max-time", "60", "--retry", "2", "--config", str(cfg)], check=False)

rows = []
for c in codes:
    f = cdir / f"{c}.html"
    if not f.exists():
        print("MISS", c)
        continue
    s = BeautifulSoup(f.read_text(encoding="utf-8", errors="ignore"), "lxml")
    for t in s.find_all("table"):
        trs = t.find_all("tr")
        if not trs:
            continue
        hdr = [x.get_text(strip=True) for x in trs[0].find_all(["th", "td"])]
        if hdr[:2] == ["Name", "Type"] and "Location" in hdr:
            li = hdr.index("Location")
            for tr in trs[1:]:
                cells = [x.get_text(strip=True) for x in tr.find_all(["td", "th"])]
                if len(cells) > li and cells[0]:
                    rows.append({"country_code": c, "name": cells[0], "location": cells[li]})

with open(OUT, "w", newline="", encoding="utf-8-sig") as fp:
    w = csv.DictWriter(fp, fieldnames=["country_code", "name", "location"])
    w.writeheader()
    w.writerows(rows)
print(f"{len(rows)} locations -> {OUT}")
