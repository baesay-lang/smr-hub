/* ============================================================
   SMR news auto-tracker  (hybrid)
   - fetches RSS feeds, keeps SMR-relevant + new items
   - classify: rule-based by DEFAULT (free, no key) ;
               Claude API (Haiku) automatically if ANTHROPIC_API_KEY is set
   - rewrites news-data.js  (PR is opened by the workflow)
   Run: node scripts/track-news.mjs            (free)
        ANTHROPIC_API_KEY=... node ...         (Claude)
   ============================================================ */
import Parser from 'rss-parser';
import fs from 'node:fs';

/* ---- config: edit these freely ---- */
const SOURCES = [
  // Verified working (2026-06). A feed that 404s is skipped + logged.
  'https://www.world-nuclear-news.org/rss',
  'https://www.powermag.com/feed/',
  // Google News RSS — broad + fresh aggregator (English + Korean queries)
  'https://news.google.com/rss/search?q=%22small%20modular%20reactor%22&hl=en-US&gl=US&ceid=US:en',
  'https://news.google.com/rss/search?q=SMR%20%EC%9B%90%EC%9E%90%EB%A0%A5&hl=ko&gl=KR&ceid=KR:ko',
];
// non-RSS HTML boards (scraped). Korean domestic policy/news.
const HTML_BOARDS = [
  { url: 'https://www.kaif.or.kr/ko/?c=250', base: 'https://www.kaif.or.kr/ko/', source: 'KAIF 투데이뉴스' },
];
const KEYWORDS = [
  'smr','small modular','advanced reactor','microreactor','micro-reactor','gen iv','generation iv',
  'nuscale','x-energy','xe-100','terrapower','natrium','bwrx','kairos','oklo','holtec','smr-300',
  'rolls-royce smr','smart100','i-smr','seaborg','saltfoss','arc-100','evinci','ap300','westinghouse',
  'haleu','triso','part 53','molten salt','htgr','high-temperature gas','sodium-cooled','fast reactor',
  'vendor design review','construction permit','design certification','combined license',
  // Korean terms (KAIF / 국내 매체)
  '소형모듈','소형원자로','소형 원자로','초소형원자로','마이크로원자로','i-smr','혁신형','용융염','고온가스로','mmr','차세대 원전','첨단원자로','첨단 원자로',
  '빌게이츠','빌 게이츠','bill gates',
];
const MAX_NEW = 20;                         // cost cap per run
const MODEL = 'claude-haiku-4-5-20251001';  // cheap + fast for tagging
const VALIDCAT = ['인허가','계약','투자','기술','정책'];
const VALIDTYPE = ['General','PWR','BWR','SFR','HTGR','FHR','MSR','Micro'];
const FILE = 'news-data.js';
const ARTICLES_DIR = 'articles';            // per-article AI detail (전문) — lazy-loaded by the modal
const API_KEY = process.env.ANTHROPIC_API_KEY;

// our 13 tracked developers — any news mentioning one of these is ALWAYS kept (ignores the cap & relevance filter)
const PRIORITY_DEVS = [
  'nuscale','x-energy','xenergy','xe-100','terrapower','natrium','ge hitachi','ge-hitachi','ge vernova','bwrx',
  'kairos','oklo','holtec','smr-300','rolls-royce','smart100','i-smr','seaborg','saltfoss','arc-100','arc clean',
  'westinghouse','ap300','evinci','혁신형',
];
// cross-source dedup key: normalized headline (also strips Google News " - Publisher" suffix)
const dedupKey = (title) => String(title).toLowerCase()
  .replace(/\s+[-–—|]\s+[^-–—|]+$/, '')
  .replace(/[^a-z0-9가-힣]+/g, ' ').trim();

const HEADER = `/* ============================================================
   SMR News data — single source for SMR-news.html
   Auto-updated by scripts/track-news.mjs (GitHub Actions); changes land via PR.
   Schema: date, title, summary, cat(인허가|계약|투자|기술|정책),
           type(General|PWR|BWR|SFR|HTGR|FHR|MSR|Micro), dev, region, source, url, k(internal dedup key)
   Optional: summaryLong (2~3문장 — 홈 피처드 카드에서 summary 대신 표시)
   ============================================================ */
window.SMR_NEWS = `;

const dkey = (d) => { const p = String(d).split('-'); return (p[0]||'0000')+(p[1]||'12')+(p[2]||'28'); };
const todayISO = () => new Date().toISOString().slice(0,10);
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./,''); } catch { return u; } };
// stable 8-hex id from the article url (FNV-1a) → articles/<id>.json filename
const articleId = (url) => { let h = 0x811c9dc5; const s = String(url||''); for (let i=0;i<s.length;i++){ h = Math.imul(h ^ s.charCodeAt(i), 0x01000193); } return (h>>>0).toString(16).padStart(8,'0'); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function loadExisting(){
  const text = fs.readFileSync(FILE,'utf8');
  const g = {};
  new Function('window', text)(g);   // executes `window.SMR_NEWS = [...]`
  return g.SMR_NEWS || [];
}

async function fetchCandidates(seen, seenKeys){
  const parser = new Parser({ timeout: 15000, headers: { 'User-Agent': 'smr-hub-news-tracker' } });
  const out = []; const keysThisRun = new Set();
  // SOURCES order matters: direct outlets (WNN/POWER) before Google News, so the direct one wins on a cross-source dup
  for (const url of SOURCES){
    try {
      const feed = await parser.parseURL(url);
      for (const it of (feed.items||[])){
        const link = (it.link||'').trim().replace(/([^:])\/\/+/g, '$1/');  // fix accidental // in feed links
        const title = (it.title||'').trim();
        if (!link || !title) continue;
        const key = dedupKey(title);
        if (seen.has(link) || seenKeys.has(key) || keysThisRun.has(key)) continue;  // URL + cross-source title dedup
        const snip = (it.contentSnippet || it.summary || it.content || '').replace(/\s+/g,' ').slice(0,400);
        const hay = (title + ' ' + snip).toLowerCase();
        const priority = PRIORITY_DEVS.some(d => hay.includes(d));      // one of our 13 devs → always keep
        if (!priority && !KEYWORDS.some(k => hay.includes(k))) continue;
        let date = '';
        if (it.isoDate) date = it.isoDate.slice(0,10);
        else if (it.pubDate) { const d = new Date(it.pubDate); if (!isNaN(d)) date = d.toISOString().slice(0,10); }
        keysThisRun.add(key);
        const itemSrc = (typeof it.source === 'string' ? it.source : (it.source && it.source._)) || '';  // Google News: real publisher
        out.push({ title, snip, link, date, key, priority, source: itemSrc || feed.title || host(url) });
      }
      console.log(`feed ok: ${url} (+${out.length} cumulative)`);
    } catch (e) { console.error(`feed fail: ${url} — ${e.message}`); }
  }

  // --- HTML boards (no RSS) — KAIF 투데이뉴스 등 국내 매체 ---
  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
  for (const b of HTML_BOARDS){
    try {
      const res = await fetch(b.url, { headers: { 'User-Agent': UA, 'Accept-Language': 'ko' } });
      const html = await res.text();
      let n = 0, rows = html.split(/<tr[\s>]/i);
      for (const row of rows){
        const a = row.match(/class="col-tit">[\s\S]*?<a\s+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
        if (!a) continue;
        const href = a[1].replace(/&amp;/g, '&');
        const link = href.startsWith('http') ? href : b.base + href;
        const title = a[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
        if (!title) continue;
        const dm = row.match(/class="col-date">\s*([0-9.]+)/i);
        const date = dm ? dm[1].replace(/\./g, '-').replace(/-+$/, '') : '';
        const key = dedupKey(title);
        if (seen.has(link) || seenKeys.has(key) || keysThisRun.has(key)) continue;
        const hay = title.toLowerCase();
        const priority = PRIORITY_DEVS.some(d => hay.includes(d));
        if (!priority && !KEYWORDS.some(k => hay.includes(k))) continue;   // SMR-relevant only
        keysThisRun.add(key);
        out.push({ title, snip: '', link, date, key, priority, source: b.source });
        n++;
      }
      console.log(`board ok: ${b.source} (rows=${rows.length}, +${n})`);
    } catch (e) { console.error(`board fail: ${b.url} — ${e.message}`); }
  }

  // keep ALL priority items (13 devs, never dropped) + up to MAX_NEW non-priority; hard ceiling for cost safety
  const pri = out.filter(c => c.priority);
  const rest = out.filter(c => !c.priority).slice(0, MAX_NEW);
  console.log(`candidates: ${pri.length} priority(13-dev) + ${rest.length} other`);
  return [...pri, ...rest].slice(0, 60);
}

/* ---- rule-based classifier (free, no API key) ---- */
const CAT_RULES = [
  ['인허가', ['construction permit','operating licence','operating license','combined license','combined licence','design certification','standard design','vendor design review',' vdr ',' gda',' sda','docket','license application','licence application','regulatory approval','nrc approves','nrc accepts','nrc issues','nrc dockets','표준설계','건설허가','운영허가']],
  ['계약',   ['agreement','contract',' mou','memorandum','partnership','to supply','supply deal','offtake','off-take',' ppa','power purchase','signs','selected','preferred bidder','joint development','계약']],
  ['투자',   ['investment','invests','funding','raises','financing','stake','series ','ipo','valuation','million','billion']],
  ['정책',   ['executive order','government','policy','department of energy','doe announces','national strategy','loan guarantee','subsidy','programme','funding program']],
];
const TYPE_RULES = [
  ['HTGR',  ['xe-100','x-energy','xenergy','high-temperature gas','htgr','pebble']],
  ['BWR',   ['bwrx','boiling water',' bwr']],
  ['SFR',   ['natrium','terrapower','sodium','arc-100','fast reactor','oklo','aurora']],
  ['FHR',   ['kairos','kp-fhr','fluoride salt','flibe',' fhr']],
  ['MSR',   ['seaborg','saltfoss','molten salt','cmsr',' msr']],
  ['Micro', ['microreactor','micro-reactor','evinci']],
  ['PWR',   ['nuscale','ap300','smart','i-smr','smr-300','holtec','rolls-royce','voygr','pressurized water','ipwr',' pwr']],
];
const DEV_RULES = [
  ['두산에너빌리티',['doosan']],['X-energy',['x-energy','xenergy','xe-100']],['NuScale',['nuscale']],
  ['TerraPower',['terrapower','natrium']],['GE-Hitachi',['ge hitachi','ge-hitachi','ge vernova','bwrx']],
  ['Kairos Power',['kairos']],['Oklo',['oklo']],['Holtec',['holtec','smr-300']],
  ['Rolls-Royce',['rolls-royce','rolls royce']],['Westinghouse',['westinghouse','ap300','evinci']],
  ['KAERI/SMART',['kaeri','smart100']],['Seaborg',['seaborg','saltfoss']],['ARC',['arc-100','arc clean']],
  ['Centrus',['centrus']],['KHNP',['khnp','korea hydro']],['TVA',['tva','tennessee valley']],
  ['Amazon',['amazon']],['Centrica',['centrica']],['NRC',['nuclear regulatory','nrc ']],['DOE',['department of energy']],
];
const REGION_RULES = [
  ['KR',['korea','korean','한국','khnp','kaeri','doosan','samsung','i-smr','smart100']],
  ['UK',['united kingdom',' uk ','britain','british',' wales','wylfa','hartlepool','centrica','rolls-royce',' onr',' gda']],
  ['CA',['canada','canadian','cnsc','ontario','opg','new brunswick','point lepreau','darlington']],
  ['DK',['denmark','danish','seaborg','saltfoss']],
  ['JP',['japan','japanese']],
  ['US',['united states',' u.s','us nrc','nuclear regulatory','department of energy','tva','wyoming','texas','idaho','michigan','tennessee','washington','american','oak ridge']],
];
function firstMatch(hay, rules, def){ for (const [v, keys] of rules){ if (keys.some(k => hay.includes(k))) return v; } return def; }

/* high-precision cat override: only RESCUES items left as 기술 (or invalid) — never downgrades a
   specific call. Keywords are deliberately unambiguous to avoid false positives in the 인허가/계약 filters. */
const CAT_OVERRIDE = [
  ['인허가', ['표준설계','설계인증','건설허가','운영허가','design certification','construction permit','combined licen','vendor design review',' gda',' vdr','예비안전분석','표준설계인가','규제 승인','nrc approves','nrc certif']],
  ['계약',   [' mou','양해각서','업무협약','공급계약','수주','offtake','off-take','power purchase',' ppa','합작','파트너십 체결','계약 체결','계약을 체결']],
  ['투자',   ['ipo','투자 유치','지분 인수','펀딩','자금 조달','시리즈 ','신규 상장']],
  ['정책',   ['행정명령','executive order','보조금','국책 ','정부 지원','법안 ']],
];
function betterCat(hay, cur){
  if (cur && cur !== '기술' && VALIDCAT.includes(cur)) return cur;   // keep the model's specific call
  for (const [v, keys] of CAT_OVERRIDE){ if (keys.some(k => hay.includes(k))) return v; }
  return '기술';
}

/* developer/product → fixed reactor type. The classifier sometimes mis-types a known reactor
   (e.g. Oklo Aurora = SFR, NOT Micro). Reactor type is a fixed fact per product, so a known
   developer keyword authoritatively overrides the model's guess. Specific tokens only (avoid FPs). */
const DEV_TYPE = [
  ['evinci','Micro'],
  ['xe-100','HTGR'], ['x-energy','HTGR'], ['xenergy','HTGR'],
  ['bwrx','BWR'],
  ['kairos','FHR'], ['kp-fhr','FHR'], ['hermes','FHR'],
  ['oklo','SFR'], ['aurora','SFR'], ['natrium','SFR'], ['terrapower','SFR'], ['arc-100','SFR'], ['arc clean','SFR'],
  ['seaborg','MSR'], ['saltfoss','MSR'], ['cmsr','MSR'],
  ['nuscale','PWR'], ['voygr','PWR'], ['ap300','PWR'], ['holtec','PWR'], ['smr-300','PWR'],
  ['rolls-royce','PWR'], ['rolls royce','PWR'], ['smart100','PWR'], ['i-smr','PWR'], ['ismr','PWR'], ['혁신형','PWR'],
];
function betterType(hay, cur){
  for (const [kw, t] of DEV_TYPE){ if (hay.includes(kw)) return t; }
  return VALIDTYPE.includes(cur) ? cur : 'General';
}
function ruleTag(it){
  const hay = (it.title + ' ' + it.snip).toLowerCase();
  const sm = it.snip.trim();
  return {
    relevant: true,
    titleKo: it.title,                                  // free mode: keep original (English) title
    summary: sm.length > 170 ? sm.slice(0,170).trim() + '…' : sm,
    summaryLong: sm.length > 380 ? sm.slice(0,380).trim() + '…' : sm,
    cat: firstMatch(hay, CAT_RULES, '기술'),
    type: firstMatch(hay, TYPE_RULES, 'General'),
    dev: firstMatch(hay, DEV_RULES, ''),
    region: firstMatch(hay, REGION_RULES, ''),
  };
}

function classifyPrompt(input){
  return `아래는 원자력 뉴스 후보 목록이다. 각 항목을 SMR(소형모듈원자로)·첨단로 레퍼런스 사이트용으로 태깅하라.
각 항목마다 JSON 객체를 만들어라:
{"i":번호,
 "relevant":SMR·첨단로·관련 개발사/연료/인허가/계약/정책이면 true, 일반 대형원전·무관 뉴스면 false,
 "titleKo":한국어 제목(간결, 핵심만),
 "summary":한국어 1~2문장 요약,
 "summaryLong":한국어 4~5문장 상세 요약(무엇이 일어났는지 + 당사자·배경·핵심 수치·일정·의미/전망까지 풍부하게. 제공된 제목·스니펫을 근거로 작성하고, 없는 구체적 수치·날짜는 지어내지 말 것 — 클릭 시 모달 상세 보기용),
 "cat":${JSON.stringify(VALIDCAT)} 중 하나(건설허가·운영허가·설계인증·규제 신청/접수/도케팅·GDA·VDR·표준설계인가=인허가; 계약·MOU·부품 공급/수주·PPA·합작·파트너십=계약; 투자·펀딩·지분·IPO=투자; 정부 정책·규제 발효·국책 프로그램=정책; 그 외 기술·시운전·마일스톤=기술),
 "type":${JSON.stringify(VALIDTYPE)} 중 하나(마이크로/초소형로=Micro, 소듐냉각고속로=SFR, 고온가스로=HTGR, 용융염=MSR, 가압/비등경수로=PWR/BWR; 특정 노형 불명확하면 "General"),
 "dev":개발사/기관 짧은 이름 또는 "",
 "region":"US"|"KR"|"UK"|"CA"|"DK"|"EU"|"JP"|"" }
[중요] cat 분류 규칙을 엄격히 적용하라: 제목·요약에 MOU·양해각서·협약·공급계약·수주·PPA·합작·파트너십 체결이 있으면 반드시 "계약"; 인가·인증·허가·건설허가·운영허가·설계인증·GDA·VDR·표준설계·안전분석 승인이면 "인허가"; IPO·상장·투자·펀딩·지분 인수·자금 조달이면 "투자"; 정부 정책·행정명령·보조금·국책 프로그램이면 "정책". 이 신호가 분명하면 절대 "기술"로 분류하지 마라. "기술"은 위 어디에도 해당 안 되는 순수 기술·시운전·마일스톤에만 쓴다.
[표기] titleKo·summary·summaryLong 모두에서, 외국 지명·기관명·인명·전문용어·약어는 '한글(English)' 형태로 영문을 괄호 병기하라(예: 오버레이설주(Overijssel), 예비안전분석(PDSA), 미국 에너지부(DOE), 가압경수로(PWR)). 영문 명칭은 정확히 쓰고, 한국 고유명사나 이미 병기된 경우는 중복하지 마라.
반드시 입력과 같은 순서로, 오직 JSON 배열만 출력하라. 설명 금지.
입력:
${JSON.stringify(input)}`;
}

/* lenient JSON: try the whole array first, else salvage each {...} object (recovers truncated responses) */
function salvageJsonArray(txt){
  const m = txt.match(/\[[\s\S]*\]/);
  if (m){ try { return JSON.parse(m[0]); } catch {} }
  const objs = [];
  for (const piece of (txt.match(/\{[^{}]*\}/g) || [])){
    try { objs.push(JSON.parse(piece)); } catch {}
  }
  return objs;
}

async function classifyBatch(batch){
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method:'POST',
    headers:{ 'x-api-key': API_KEY, 'anthropic-version':'2023-06-01', 'content-type':'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: 8000, messages:[{ role:'user', content: classifyPrompt(batch) }] })
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${(await res.text()).slice(0,200)}`);
  const data = await res.json();
  return salvageJsonArray(data?.content?.[0]?.text || '');
}

/* classify in small batches so each response stays well under max_tokens (a single 42-item
   request truncates → invalid JSON → everything dropped). Each item keeps its GLOBAL index i. */
async function classify(items){
  const out = items.map(()=>null);
  const input = items.map((it,i)=>({ i, title: it.title, snippet: it.snip, source: it.source }));
  const BATCH = 8;
  for (let s=0; s<input.length; s+=BATCH){
    const batch = input.slice(s, s+BATCH);
    let arr = [];
    try { arr = await classifyBatch(batch); }
    catch(e){ console.error(`classify batch ${s}-${s+batch.length-1} fail: ${e.message}`); }
    let got = 0;
    for (const o of arr) if (o && Number.isInteger(o.i) && o.i>=0 && o.i<items.length){ out[o.i] = o; got++; }
    console.log(`classified ${s}-${s+batch.length-1}: ${got}/${batch.length}`);
  }
  return out;
}

function writeData(list){
  list.sort((a,b)=> dkey(b.date).localeCompare(dkey(a.date)));
  const updated = new Date(Date.now() + 9*3600*1000).toISOString().slice(0,16).replace('T',' ') + ' KST';
  fs.writeFileSync(FILE, HEADER + JSON.stringify(list, null, 2) + ';\nwindow.SMR_UPDATED = ' + JSON.stringify(updated) + ';\n');
}

/* AI 전문(detail) — transformative explainer (KO + EN + term glossary), NOT a copy of the source.
   Written to articles/<id>.json and lazy-loaded by the modal. */
async function generateDetail(item){
  const isKo = /[가-힣]/.test(item.source || '');   // Korean-source article → no English version needed
  const prompt = isKo ?
`다음 한국 SMR·원자력 뉴스에 대해 '읽기 쉬운 상세 해설'을 한국어로 작성하라. 원문 복제 금지, 제공 정보와 배경지식으로 재구성, 없는 수치·날짜·고유명사 지어내지 마라.
제목: ${item.title}
요약: ${item.summaryLong || item.summary || ''}
분류: ${item.cat} / 노형: ${item.type} / 개발사: ${item.dev || ''} / 출처: ${item.source || ''}
아래 JSON만 출력(설명 금지, 줄바꿈은 \\n):
{"detailKo":"한국어 상세 해설 6~10문장, 문단은 \\n\\n 으로 구분, 외국 지명·기관·인명·전문용어·약어는 한글(English)로 병기, 가독성 있게.",
 "detailEn":"",
 "terms":[{"t":"용어 또는 약어(영문 포함)","d":"한국어 한 줄 설명"}]}`
:
`다음 SMR·원자력 뉴스에 대해 '읽기 쉬운 상세 해설'을 작성하라. 원문을 그대로 복제하지 말고, 제공된 정보와 일반 배경지식으로 재구성하라. 제공 정보에 없는 구체적 수치·날짜·고유명사를 새로 지어내지 마라.
제목: ${item.title}
요약: ${item.summaryLong || item.summary || ''}
분류: ${item.cat} / 노형: ${item.type} / 개발사: ${item.dev || ''} / 출처: ${item.source || ''}
아래 JSON만 출력하라(설명 금지). 문자열 내 줄바꿈은 \\n 으로 이스케이프:
{"detailKo":"한국어 상세 해설. 배경→핵심 내용→의미·전망 흐름으로 6~10문장. 문단은 \\n\\n 으로 구분. 외국 지명·기관·인명·전문용어·약어는 한글(English)로 병기. 쉽고 가독성 있게.",
 "detailEn":"같은 내용을 자연스러운 영어로 5~9문장.",
 "terms":[{"t":"용어 또는 약어(영문 포함)","d":"한국어 한 줄 설명"}]}`;
  const body = JSON.stringify({ model: MODEL, max_tokens: 4000, messages:[{ role:'user', content: prompt }] });
  for (let attempt=0; attempt<3; attempt++){
    const ctrl = new AbortController();
    const to = setTimeout(()=>ctrl.abort(), 30000);   // hard 30s timeout so one hung request can't stall the run
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method:'POST',
        headers:{ 'x-api-key': API_KEY, 'anthropic-version':'2023-06-01', 'content-type':'application/json' },
        body, signal: ctrl.signal
      });
      clearTimeout(to);
      if (res.status === 429 || res.status >= 500){ await sleep(2000*(attempt+1)); continue; }   // throttled/5xx → backoff & retry
      if (!res.ok) return null;
      const data = await res.json();
      const txt = data?.content?.[0]?.text || '';
      const m = txt.match(/\{[\s\S]*\}/);
      if (!m) return null;
      const d = JSON.parse(m[0]);
      if (!d.detailKo) return null;
      return { detailKo: String(d.detailKo||''), detailEn: isKo ? '' : String(d.detailEn||''), terms: Array.isArray(d.terms) ? d.terms.slice(0,8) : [] };
    } catch(e){ clearTimeout(to); if (attempt === 2){ console.error(`detail gen fail: ${e.message}`); return null; } await sleep(1500); }
  }
  return null;
}
function writeDetail(id, item, d){
  fs.writeFileSync(`${ARTICLES_DIR}/${id}.json`, JSON.stringify({
    id, k: item.k || '', title: item.title, url: item.url || '', source: item.source || '',
    detailKo: d.detailKo, detailEn: d.detailEn, terms: d.terms
  }));
}
async function ensureDetail(item){          // generate + persist detail; sets item.id
  const id = articleId(item.url);
  item.id = id;
  if (fs.existsSync(`${ARTICLES_DIR}/${id}.json`)) return false;   // already done
  const d = await generateDetail(item);
  if (d){ writeDetail(id, item, d); return true; }
  return false;
}

/* one-time backfill (env BACKFILL=true): generate AI 전문 for every existing item that lacks one
   (also stamps each with its id). Idempotent — skips items whose detail file already exists. */
async function backfillDetails(items){
  fs.mkdirSync(ARTICLES_DIR, { recursive: true });
  items.forEach(it => { it.id = articleId(it.url); });                         // stamp id on every item
  // free pass: strip the English version from existing Korean-source articles (no API call)
  let stripped = 0;
  for (const it of items){
    const p = `${ARTICLES_DIR}/${it.id}.json`;
    if (!fs.existsSync(p) || !/[가-힣]/.test(it.source||'')) continue;
    try { const j = JSON.parse(fs.readFileSync(p,'utf8')); if (j.detailEn){ j.detailEn=''; fs.writeFileSync(p, JSON.stringify(j)); stripped++; } } catch {}
  }
  if (stripped) console.log(`stripped English from ${stripped} Korean-source article(s)`);
  const todo = items.filter(it => !fs.existsSync(`${ARTICLES_DIR}/${it.id}.json`));
  console.log(`detail backfill: ${todo.length}/${items.length} need a detail file`);
  let made = 0, idx = 0;
  async function worker(){
    while (idx < todo.length){
      const it = todo[idx++];
      const d = await generateDetail(it);
      if (d){ writeDetail(it.id, it, d); made++; if (made % 15 === 0) console.log(`... made ${made}/${todo.length}`); }
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker));                        // 6 concurrent → ~6x faster, with per-call timeout
  console.log(`detail backfill done — ${made} new detail file(s)`);
  return made;
}

async function main(){
  const useClaude = !!API_KEY;
  console.log('classify mode:', useClaude ? 'Claude API' : 'rule-based (free)');
  const existing = loadExisting();
  let repaired = 0;   // self-heal previously mis-tagged cat/type on existing items
  existing.forEach(n => {
    const hay = ((n.dev||'')+' '+(n.title||'')+' '+(n.summary||'')).toLowerCase();
    const nc = betterCat(hay, n.cat); if (nc !== n.cat){ n.cat = nc; repaired++; }
    const nt = betterType(hay, n.type); if (nt !== n.type){ n.type = nt; repaired++; }
  });
  if (repaired) console.log(`repaired ${repaired} cat/type field(s) on existing items`);

  if (process.env.BACKFILL === 'true'){   // one-time: generate AI 전문 for all existing items, then write & exit
    const made = await backfillDetails(existing);
    writeData(existing);
    console.log(`backfill mode done — ${made} detail file(s), data written (ids stamped)`);
    return;
  }

  const seen = new Set(existing.map(n => (n.url||'').trim()).filter(Boolean));
  const seenTitles = new Set(existing.map(n => (n.title||'').trim()));
  const seenKeys = new Set(existing.map(n => n.k).filter(Boolean));  // cross-run, cross-source title dedup

  const candidates = await fetchCandidates(seen, seenKeys);
  console.log(`candidates after filter: ${candidates.length}`);
  if (candidates.length === 0) { console.log('no new relevant candidates — exiting'); return; }

  const tagged = useClaude ? await classify(candidates) : candidates.map(ruleTag);
  const toAdd = [];
  tagged.forEach((c,i)=>{
    const src = candidates[i];
    if (!c && src.priority) c = ruleTag(src);   // classifier missed/failed but it's one of our 13 devs → keep (rule-based tags)
    if (!c) return;
    if (c.relevant === false && !src.priority) return;   // 13-dev news kept even if classifier says off-topic
    const title = (c.titleKo || src.title).trim();
    if (!title || seenTitles.has(title)) return;
    seenTitles.add(title);
    toAdd.push({
      date: src.date || todayISO(),
      title,
      summary: (c.summary || '').trim(),
      summaryLong: (c.summaryLong || '').trim() || undefined,
      cat: betterCat(((c.titleKo||src.title)+' '+(src.title||'')+' '+(c.summary||'')).toLowerCase(), VALIDCAT.includes(c.cat) ? c.cat : '기술'),
      type: betterType(((c.titleKo||src.title)+' '+(src.title||'')+' '+(c.dev||'')+' '+(c.summary||'')).toLowerCase(), VALIDTYPE.includes(c.type) ? c.type : 'General'),
      dev: (c.dev || '').trim(),
      region: (c.region || '').trim(),
      source: src.source,
      url: src.link,
      k: src.key,
    });
  });

  // generate AI 전문 for each new item (sets .id, writes articles/<id>.json)
  if (toAdd.length){
    fs.mkdirSync(ARTICLES_DIR, { recursive: true });
    for (const n of toAdd){ await ensureDetail(n); }
  }
  // always rewrite so SMR_UPDATED reflects THIS run (last-checked time), even with 0 new items
  writeData(existing.concat(toAdd));
  console.log(`run complete — added ${toAdd.length}, repaired ${repaired}:`);
  toAdd.forEach(n => console.log(`  · ${n.date} [${n.cat}/${n.type}] ${n.title}`));
}

main().catch(e => { console.error(e); process.exit(1); });
