# -*- coding: utf-8 -*-
"""SMR HUB용 세계 원전 백과사전 페이지 빌더 v1
출력: 저장소 루트 SMR-npp-db.html (허브 디자인 시스템 — styles.css 변수, 다크모드, 공용 topnav)
데이터: pris_cache의 units_raw.csv + locations.csv + pris_spec_map_v1
"""
import sys, csv, json, pathlib

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from pris_spec_map_v1 import classify, TYPE_KO, STATUS_KO

VERSION = "v1"
ASOF = "2026-07-10"
CACHE = pathlib.Path(sys.argv[1])
OUT = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else pathlib.Path("SMR-npp-db.html")

units = list(csv.DictReader(open(CACHE / "units_raw.csv", encoding="utf-8-sig")))
loc = {}
locf = CACHE / "locations.csv"
if locf.exists():
    for r in csv.DictReader(open(locf, encoding="utf-8-sig")):
        loc[(r["country_code"], r["name"].upper())] = r["location"]

data = []
for u in units:
    spec, basis = classify(u)
    data.append({
        "id": int(u["pris_id"]), "nm": u["name"], "alt": u["alt_name"],
        "ct": u["country"], "cc": u["country_code"],
        "lo": loc.get((u["country_code"], u["name"].upper()), ""),
        "st": STATUS_KO.get(u["status"], u["status"]), "stE": u["status"],
        "ty": u["type"], "tyK": TYPE_KO.get(u["type"], ""), "md": u["model"],
        "co": spec["냉각재"], "ph": spec["냉각재_상"], "mo": spec["감속재"],
        "fu": spec["연료_물질"], "ff": spec["연료_형태"], "en": spec["농축도"],
        "bs": basis, "nt": spec["스펙_비고"],
        "ne": u["net_mwe"], "gr": u["gross_mwe"], "th": u["thermal_mwt"],
        "d1": u["construction_start"], "d2": u["first_criticality"],
        "d3": u["grid_connection"], "d4": u["commercial_operation"], "d5": u["permanent_shutdown"],
        "ow": u["owner"], "op": u["operator"], "gen": u["lifetime_generation_twh"],
    })
data.sort(key=lambda r: (r["ct"], r["nm"]))

n_op = sum(1 for d in data if d["st"] == "운전중")
n_uc = sum(1 for d in data if d["st"] == "건설중")
n_ps = sum(1 for d in data if d["st"] in ("영구정지", "해체완료"))
gw_op = sum(float(d["ne"] or 0) for d in data if d["st"] == "운전중") / 1000
countries = len({d["ct"] for d in data})

HTML = """<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>세계 원전 백과사전 — 유닛·냉각재·감속재·연료·농축도 DB</title>
<meta name="description" content="IAEA PRIS 기반 전 세계 원자로 __N_ALL__기 — 유닛별 용량·이력에 냉각재(물질·상)·감속재·연료·농축도까지 붙인 검색형 백과사전 DB.">
<link rel="canonical" href="https://baesay-lang.github.io/smr-hub/SMR-npp-db.html">
<meta name="theme-color" content="#2563eb">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<meta property="og:type" content="website">
<meta property="og:site_name" content="SMR HUB">
<meta property="og:locale" content="ko_KR">
<meta property="og:title" content="세계 원전 백과사전 · SMR HUB">
<meta property="og:description" content="전 세계 원자로 __N_ALL__기 — 냉각재·감속재·연료·농축도까지 검색되는 유닛 DB.">
<meta property="og:url" content="https://baesay-lang.github.io/smr-hub/SMR-npp-db.html">
<meta property="og:image" content="https://baesay-lang.github.io/smr-hub/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="세계 원전 백과사전 · SMR HUB">
<meta name="twitter:description" content="전 세계 원자로 __N_ALL__기 — 냉각재·감속재·연료·농축도 검색 DB.">
<meta name="twitter:image" content="https://baesay-lang.github.io/smr-hub/og-image.png">
<link rel="stylesheet" href="styles.css?v=5">
<script>(function(){try{var t=localStorage.getItem('smrhub-theme');if(t==='dark'||(!t&&window.matchMedia&&matchMedia('(prefers-color-scheme:dark)').matches))document.documentElement.setAttribute('data-theme','dark');}catch(e){}})();</script>
<script src="ui.js?v=4" defer></script>
<style>
  main{max-width:1440px;}
  .db-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin:4px 0 16px;}
  .db-tile{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);box-shadow:var(--shadow);padding:12px 16px;}
  .db-tile .k{font-size:11px;font-weight:700;color:var(--text-faint);letter-spacing:.04em;margin-bottom:4px;}
  .db-tile .v{font-size:23px;font-weight:800;color:var(--text);font-variant-numeric:tabular-nums;}
  .db-tile.hl .v{color:var(--accent-strong);}
  .db-filters{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;align-items:center;}
  .db-filters input,.db-filters select{font:inherit;font-size:13px;padding:7px 10px;border:1px solid var(--border-strong);border-radius:var(--radius-sm);background:var(--surface);color:var(--text);}
  .db-filters input{flex:1;min-width:220px;}
  .db-filters select{max-width:180px;}
  .db-count{font-size:12.5px;color:var(--text-dim);margin-left:auto;white-space:nowrap;font-variant-numeric:tabular-nums;}
  .db-box{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);box-shadow:var(--shadow);overflow:auto;max-height:72vh;}
  .db-box table{border-collapse:collapse;width:100%;min-width:1240px;}
  .db-box thead th{background:var(--surface-2);color:var(--text);font-size:12px;font-weight:700;padding:9px 10px;text-align:left;position:sticky;top:0;z-index:2;cursor:pointer;user-select:none;white-space:nowrap;border-bottom:1px solid var(--border-strong);}
  .db-box thead th:hover{color:var(--accent-strong);}
  .db-box tbody td{padding:7px 10px;border-bottom:1px solid var(--border);font-size:12.5px;white-space:nowrap;color:var(--text-dim);}
  .db-box tbody td:first-child{color:var(--text);font-weight:600;}
  .db-box tbody tr{cursor:pointer;}
  .db-box tbody tr:hover{background:var(--accent-weak);}
  td.num{text-align:right;font-variant-numeric:tabular-nums;}
  .badge{display:inline-block;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700;}
  .b-op{background:var(--accent-weak);color:var(--accent-strong);}
  .b-uc{background:#fef3e2;color:#92610f;}
  .b-ps{background:var(--surface-3);color:var(--text-faint);}
  .b-sus{background:#fef3e2;color:#92610f;}
  [data-theme="dark"] .b-uc,[data-theme="dark"] .b-sus{background:#3a2f18;color:#e3b25f;}
  #dbPanel{position:fixed;top:0;right:-580px;width:560px;max-width:94vw;height:100vh;background:var(--surface);box-shadow:-6px 0 28px rgba(0,0,0,.25);z-index:400;transition:right .25s ease;overflow-y:auto;border-left:1px solid var(--border);}
  #dbPanel.open{right:0;}
  #dbPanel .phead{background:var(--surface-2);padding:18px 22px;position:sticky;top:0;border-bottom:1px solid var(--border);z-index:1;}
  #dbPanel .phead h2{font-size:18px;margin:0 0 3px;color:var(--text);}
  #dbPanel .phead .m{font-size:12.5px;color:var(--text-dim);}
  #dbPanel .close{position:absolute;top:12px;right:14px;background:none;border:none;color:var(--text-dim);font-size:22px;cursor:pointer;line-height:1;}
  #dbPanel .close:hover{color:var(--text);}
  .db-sect{padding:14px 22px 4px;font-size:11px;font-weight:700;color:var(--text-faint);letter-spacing:.08em;text-transform:uppercase;}
  .db-grid{display:grid;grid-template-columns:130px 1fr;padding:0 22px;}
  .db-grid .k{padding:7px 0;font-size:12px;color:var(--text-faint);border-bottom:1px solid var(--border);}
  .db-grid .v{padding:7px 0;font-size:13px;color:var(--text-dim);border-bottom:1px solid var(--border);word-break:break-all;}
  .db-grid .v.strong{color:var(--text);font-weight:700;}
  .db-note{margin:12px 22px;border-left:3px solid var(--accent);background:var(--accent-weak);color:var(--accent-strong);padding:10px 12px;font-size:12.5px;border-radius:0 var(--radius-sm) var(--radius-sm) 0;}
  .db-plink{display:inline-block;margin:14px 22px 26px;font-size:12.5px;font-weight:700;border:1px solid var(--accent);border-radius:var(--radius-sm);padding:7px 14px;}
  .db-plink:hover{background:var(--accent);color:#fff;text-decoration:none;}
  #dbDim{position:fixed;inset:0;background:rgba(10,16,28,.4);z-index:390;opacity:0;pointer-events:none;transition:opacity .25s;}
  #dbDim.on{opacity:1;pointer-events:auto;}
  @media (max-width:720px){.db-filters select{max-width:none;flex:1;}.db-box{max-height:none;}}
</style>
</head>
<body>
<nav class="topnav" aria-label="주요 메뉴"><noscript><a class="brand" href="index.html">SMR HUB</a></noscript></nav>

<header class="page">
  <div class="kicker">Global NPP Database</div>
  <h1>세계 원전 백과사전</h1>
  <p class="subtitle">IAEA PRIS 기반 전 세계 원자로 <b>__N_ALL__기 · __N_CT__개국</b> — 유닛별 용량·이력에
  <b>냉각재(물질·상)·감속재·연료·농축도</b>까지 붙인 검색형 DB. 행을 클릭하면 상세 카드가 열림.</p>
</header>

<main>
<div class="db-tiles">
<div class="db-tile"><div class="k">총 유닛</div><div class="v">__N_ALL__</div></div>
<div class="db-tile hl"><div class="k">운전중</div><div class="v">__N_OP__</div></div>
<div class="db-tile"><div class="k">건설중</div><div class="v">__N_UC__</div></div>
<div class="db-tile"><div class="k">영구정지·해체</div><div class="v">__N_PS__</div></div>
<div class="db-tile"><div class="k">국가</div><div class="v">__N_CT__</div></div>
<div class="db-tile"><div class="k">운전중 순용량</div><div class="v">__GW__ GW</div></div>
</div>
<div class="db-filters">
<input id="q" type="search" placeholder="검색: 유닛명, 위치, 모델, 소유자, 운영자 …" aria-label="검색">
<select id="fct" aria-label="국가"><option value="">국가 전체</option></select>
<select id="fty" aria-label="노형"><option value="">노형 전체</option></select>
<select id="fst" aria-label="상태"><option value="">상태 전체</option></select>
<select id="fco" aria-label="냉각재"><option value="">냉각재 전체</option></select>
<select id="fmo" aria-label="감속재"><option value="">감속재 전체</option></select>
<span class="db-count" id="cnt"></span>
</div>
<div class="db-box"><table id="tbl">
<thead><tr>
<th data-k="nm">유닛명</th><th data-k="ct">국가</th><th data-k="st">상태</th>
<th data-k="ty">타입</th><th data-k="md">모델</th><th data-k="co">냉각재</th>
<th data-k="ph">냉각재 상</th><th data-k="mo">감속재</th><th data-k="fu">연료</th>
<th data-k="en">농축도</th><th data-k="ne" class="num">순출력 MWe</th><th data-k="d3">계통연결</th>
</tr></thead><tbody id="tb"></tbody>
</table></div>
</main>

<div id="dbDim"></div>
<div id="dbPanel"></div>

<footer>
  유닛 데이터: <a href="https://pris.iaea.org" target="_blank" rel="noopener">IAEA PRIS</a> (__ASOF__ 수집) ·
  냉각재/감속재/연료/농축도: 노형 타입·모델 기반 <b>대표값</b> 매핑(IAEA ARIS/RDS-1, 공개 문헌) — 유닛별 노심 설계·재장전에 따라 다를 수 있음.<br>
  <a href="SMR-reactor-types.html">SMR 노형 분류</a> · <a href="SMR-catalogue.html">SMR 카탈로그</a> · <a href="SMR-fuel-supply.html">연료 공급망</a>
</footer>

<script>
const D = __DATA__;
const $id = s => document.getElementById(s);
const tb = $id("tb"), badge = s => s==="운전중"?"b-op":s==="건설중"?"b-uc":s.startsWith("운전중단")||s==="건설중단"?"b-sus":"b-ps";
let sortK = "ct", sortAsc = true, view = D.slice();

function fillSel(id, key){
  const vals = [...new Set(D.map(d=>d[key]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"ko"));
  const sel = $id(id);
  vals.forEach(v=>{const o=document.createElement("option");o.value=v;o.textContent=v;sel.appendChild(o);});
}
fillSel("fct","ct"); fillSel("fty","ty"); fillSel("fst","st"); fillSel("fco","co"); fillSel("fmo","mo");

function apply(){
  const q = $id("q").value.trim().toLowerCase();
  const f = {ct:$id("fct").value, ty:$id("fty").value, st:$id("fst").value, co:$id("fco").value, mo:$id("fmo").value};
  view = D.filter(d=>{
    for(const k in f) if(f[k] && d[k]!==f[k]) return false;
    if(!q) return true;
    return (d.nm+" "+d.alt+" "+d.ct+" "+d.lo+" "+d.md+" "+d.ow+" "+d.op+" "+d.fu+" "+d.en).toLowerCase().includes(q);
  });
  view.sort((a,b)=>{
    let x=a[sortK]??"", y=b[sortK]??"";
    if(sortK==="ne"){x=parseFloat(x)||0; y=parseFloat(y)||0; return sortAsc?x-y:y-x;}
    return sortAsc? String(x).localeCompare(String(y),"ko") : String(y).localeCompare(String(x),"ko");
  });
  render();
}
function esc(s){return String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))}
function render(){
  $id("cnt").textContent = view.length + " / " + D.length + "기";
  tb.innerHTML = view.map((d,i)=>`<tr data-i="${i}">
<td>${esc(d.nm)}</td><td>${esc(d.ct)}</td>
<td><span class="badge ${badge(d.st)}">${esc(d.st)}</span></td>
<td title="${esc(d.tyK)}">${esc(d.ty)}</td><td>${esc(d.md)}</td>
<td>${esc(d.co)}</td><td>${esc(d.ph)}</td><td>${esc(d.mo)}</td>
<td title="${esc(d.ff)}">${esc(d.fu)}</td><td>${esc(d.en)}</td>
<td class="num">${d.ne?Number(d.ne).toLocaleString():""}</td><td>${esc(d.d3)}</td></tr>`).join("");
}
tb.addEventListener("click", e=>{
  const tr = e.target.closest("tr"); if(!tr) return;
  openPanel(view[+tr.dataset.i]);
});
document.querySelectorAll("thead th").forEach(th=>th.addEventListener("click",()=>{
  const k = th.dataset.k;
  if(sortK===k) sortAsc=!sortAsc; else {sortK=k; sortAsc=true;}
  apply();
}));
["q","fct","fty","fst","fco","fmo"].forEach(id=>$id(id).addEventListener("input",apply));

function row(k,v,strong){return v?`<div class="k">${k}</div><div class="v${strong?" strong":""}">${esc(v)}</div>`:""}
function openPanel(d){
  $id("dbPanel").innerHTML = `
<div class="phead"><button class="close" aria-label="닫기" onclick="closePanel()">×</button>
<h2>${esc(d.nm)}${d.alt?` <span style="font-weight:400;font-size:13px">(${esc(d.alt)})</span>`:""}</h2>
<div class="m">${esc(d.ct)} · ${esc(d.lo||"위치 정보 없음")} · <span class="badge ${badge(d.st)}">${esc(d.st)}</span></div></div>
<div class="db-sect">노형 · 스펙</div>
<div class="db-grid">
${row("타입", d.ty+(d.tyK?" — "+d.tyK:""),1)}
${row("모델", d.md)}
${row("냉각재", d.co,1)}
${row("냉각재 상", d.ph)}
${row("감속재", d.mo,1)}
${row("연료 물질", d.fu,1)}
${row("연료 형태", d.ff)}
${row("농축도", d.en,1)}
${row("스펙 근거", d.bs)}
</div>
${d.nt?`<div class="db-note">${esc(d.nt)}</div>`:""}
<div class="db-sect">용량 · 이력</div>
<div class="db-grid">
${row("순출력", d.ne?Number(d.ne).toLocaleString()+" MWe":"")}
${row("총출력", d.gr?Number(d.gr).toLocaleString()+" MWe":"")}
${row("열출력", d.th?Number(d.th).toLocaleString()+" MWt":"")}
${row("착공", d.d1)}
${row("최초 임계", d.d2)}
${row("계통 연결", d.d3)}
${row("상업 운전", d.d4)}
${row("영구정지", d.d5)}
${row("누적 발전량", d.gen?d.gen+" TWh":"")}
${row("소유자", d.ow)}
${row("운영자", d.op)}
</div>
<a class="db-plink" href="https://pris.iaea.org/PRIS/CountryStatistics/ReactorDetails.aspx?current=${d.id}" target="_blank" rel="noopener">IAEA PRIS 원본 페이지 →</a>`;
  $id("dbPanel").classList.add("open"); $id("dbDim").classList.add("on");
}
function closePanel(){$id("dbPanel").classList.remove("open");$id("dbDim").classList.remove("on");}
$id("dbDim").addEventListener("click",closePanel);
document.addEventListener("keydown",e=>{if(e.key==="Escape")closePanel();});
apply();
</script>
<script src="feedback.js" defer></script>
</body>
</html>"""

html = (HTML
        .replace("__DATA__", json.dumps(data, ensure_ascii=False, separators=(",", ":")))
        .replace("__ASOF__", ASOF)
        .replace("__N_ALL__", f"{len(data):,}").replace("__N_OP__", f"{n_op:,}")
        .replace("__N_UC__", f"{n_uc:,}").replace("__N_PS__", f"{n_ps:,}")
        .replace("__N_CT__", str(countries)).replace("__GW__", f"{gw_op:,.0f}"))
OUT.write_text(html, encoding="utf-8")
print(f"saved {OUT} ({len(data)} units, {len(html)//1024} KB)")
