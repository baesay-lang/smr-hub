# -*- coding: utf-8 -*-
"""SMR-map.html 의 기저 지도(us-geo.js)를 재생성한다.

실제 미국 주 경계 + 캐나다 외곽선을 SMR-map 의 등장방형(equirectangular) 투영으로
변환해 프로젝트 루트의 us-geo.js 로 출력한다.
    투영: x=(lon+128)*1000/66, y=(52-lat)*20,  viewBox 0 0 1000 560

출처:
  - 미국 주: PublicaMundi/MappingAPI us-states.json (GeoJSON)
  - 캐나다 외곽선: Natural Earth 110m admin_0 countries (GeoJSON)

실행:  python scripts/gen-usmap.py     (인터넷 필요, 의존성 없음 - 표준 라이브러리만)
"""
import json
import os
import urllib.request

US_URL = "https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json"
NE_URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson"

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "us-geo.js")

SX = 1000.0 / 66.0
def proj(lon, lat):
    return ((lon + 128.0) * SX, (52.0 - lat) * 20.0)

ABBR = {
 'Alabama':'AL','Alaska':'AK','Arizona':'AZ','Arkansas':'AR','California':'CA',
 'Colorado':'CO','Connecticut':'CT','Delaware':'DE','District of Columbia':'DC',
 'Florida':'FL','Georgia':'GA','Hawaii':'HI','Idaho':'ID','Illinois':'IL',
 'Indiana':'IN','Iowa':'IA','Kansas':'KS','Kentucky':'KY','Louisiana':'LA',
 'Maine':'ME','Maryland':'MD','Massachusetts':'MA','Michigan':'MI','Minnesota':'MN',
 'Mississippi':'MS','Missouri':'MO','Montana':'MT','Nebraska':'NE','Nevada':'NV',
 'New Hampshire':'NH','New Jersey':'NJ','New Mexico':'NM','New York':'NY',
 'North Carolina':'NC','North Dakota':'ND','Ohio':'OH','Oklahoma':'OK','Oregon':'OR',
 'Pennsylvania':'PA','Rhode Island':'RI','South Carolina':'SC','South Dakota':'SD',
 'Tennessee':'TN','Texas':'TX','Utah':'UT','Vermont':'VT','Virginia':'VA',
 'Washington':'WA','West Virginia':'WV','Wisconsin':'WI','Wyoming':'WY',
 'Puerto Rico':'PR',
}
SKIP = {'Alaska', 'Hawaii', 'Puerto Rico'}  # 본토 외 영역은 제외


def fetch(url):
    with urllib.request.urlopen(url, timeout=60) as r:
        return json.loads(r.read().decode('utf-8'))


def polys(geom):
    t = geom['type']; c = geom['coordinates']
    if t == 'Polygon':
        yield c
    elif t == 'MultiPolygon':
        for p in c:
            yield p


def ring_to_path(ring, simp=0.35):
    pts = []; last = None
    for lon, lat in ring:
        x, y = proj(lon, lat)
        if last is not None and abs(x-last[0]) < simp and abs(y-last[1]) < simp:
            continue
        pts.append((x, y)); last = (x, y)
    if len(pts) < 3:
        return None
    a = 0.0
    for i in range(len(pts)):
        x1, y1 = pts[i]; x2, y2 = pts[(i+1) % len(pts)]
        a += x1*y2 - x2*y1
    area = abs(a) / 2.0
    d = 'M' + ' L'.join(f'{x:.1f},{y:.1f}' for x, y in pts) + 'Z'
    return d, area, pts


def centroid(pts):
    a = cx = cy = 0.0
    for i in range(len(pts)):
        x1, y1 = pts[i]; x2, y2 = pts[(i+1) % len(pts)]
        cr = x1*y2 - x2*y1; a += cr; cx += (x1+x2)*cr; cy += (y1+y2)*cr
    if abs(a) < 1e-6:
        xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
        return sum(xs)/len(xs), sum(ys)/len(ys)
    a *= 0.5
    return cx/(6*a), cy/(6*a)


def main():
    us = fetch(US_URL)
    states = []
    for f in us['features']:
        name = f['properties']['name']
        if name in SKIP:
            continue
        abbr = ABBR.get(name, name[:2].upper())
        ds = []; biggest = None; biggest_area = -1; total = 0.0
        for poly in polys(f['geometry']):
            for ri, ring in enumerate(poly):
                res = ring_to_path(ring)
                if not res:
                    continue
                d, area, pts = res
                ds.append(d)
                if ri == 0:
                    total += area
                    if area > biggest_area:
                        biggest_area = area; biggest = pts
        if not ds:
            continue
        cx, cy = centroid(biggest)
        states.append({'abbr': abbr, 'name': name, 'd': ' '.join(ds),
                       'cx': round(cx, 1), 'cy': round(cy, 1), 'area': round(total)})

    ne = fetch(NE_URL)
    ca = []
    for f in ne['features']:
        p = f['properties']
        if (p.get('NAME') or p.get('ADMIN') or p.get('name')) == 'Canada':
            for poly in polys(f['geometry']):
                for ring in poly:
                    res = ring_to_path(ring, simp=0.5)
                    if res:
                        ca.append(res[0])
            break

    with open(OUT, 'w', encoding='utf-8') as out:
        out.write('// 자동 생성 (scripts/gen-usmap.py). 등장방형 투영 x=(lon+128)*1000/66, y=(52-lat)*20.\n')
        out.write('// 출처: PublicaMundi US states GeoJSON, Natural Earth 110m admin_0 countries.\n')
        out.write('var US_STATES=' + json.dumps(states, ensure_ascii=False) + ';\n')
        out.write('var CA_OUTLINE=' + json.dumps(' '.join(ca)) + ';\n')

    print(f'wrote {OUT}  ({len(states)} states, canada {"yes" if ca else "no"})')


if __name__ == '__main__':
    main()
