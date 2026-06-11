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
   ============================================================ */
window.SMR_NEWS = `;

const dkey = (d) => { const p = String(d).split('-'); return (p[0]||'0000')+(p[1]||'12')+(p[2]||'28'); };
const todayISO = () => new Date().toISOString().slice(0,10);
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./,''); } catch { return u; } };

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
function ruleTag(it){
  const hay = (it.title + ' ' + it.snip).toLowerCase();
  const sm = it.snip.trim();
  return {
    relevant: true,
    titleKo: it.title,                                  // free mode: keep original (English) title
    summary: sm.length > 170 ? sm.slice(0,170).trim() + '…' : sm,
    cat: firstMatch(hay, CAT_RULES, '기술'),
    type: firstMatch(hay, TYPE_RULES, 'General'),
    dev: firstMatch(hay, DEV_RULES, ''),
    region: firstMatch(hay, REGION_RULES, ''),
  };
}

async function classify(items){
  const input = items.map((it,i)=>({ i, title: it.title, snippet: it.snip, source: it.source }));
  const prompt =
`아래는 원자력 뉴스 후보 목록이다. 각 항목을 SMR(소형모듈원자로)·첨단로 레퍼런스 사이트용으로 태깅하라.
각 항목마다 JSON 객체를 만들어라:
{"i":번호,
 "relevant":SMR·첨단로·관련 개발사/연료/인허가/계약/정책이면 true, 일반 대형원전·무관 뉴스면 false,
 "titleKo":한국어 제목(간결, 핵심만),
 "summary":한국어 1~2문장 요약,
 "cat":${JSON.stringify(VALIDCAT)} 중 하나(건설허가·운영허가·설계인증·규제 신청/접수/도케팅·GDA·VDR·표준설계인가=인허가; 계약·MOU·부품 공급/수주·PPA·합작·파트너십=계약; 투자·펀딩·지분·IPO=투자; 정부 정책·규제 발효·국책 프로그램=정책; 그 외 기술·시운전·마일스톤=기술),
 "type":${JSON.stringify(VALIDTYPE)} 중 하나(마이크로/초소형로=Micro, 소듐냉각고속로=SFR, 고온가스로=HTGR, 용융염=MSR, 가압/비등경수로=PWR/BWR; 특정 노형 불명확하면 "General"),
 "dev":개발사/기관 짧은 이름 또는 "",
 "region":"US"|"KR"|"UK"|"CA"|"DK"|"EU"|"JP"|"" }
반드시 입력과 같은 순서로, 오직 JSON 배열만 출력하라. 설명 금지.
입력:
${JSON.stringify(input)}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method:'POST',
    headers:{ 'x-api-key': API_KEY, 'anthropic-version':'2023-06-01', 'content-type':'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: 4000, messages:[{ role:'user', content: prompt }] })
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const txt = data?.content?.[0]?.text || '';
  const m = txt.match(/\[[\s\S]*\]/);
  if (!m) { console.error('no JSON array in model output'); return items.map(()=>null); }
  let arr; try { arr = JSON.parse(m[0]); } catch(e){ console.error('JSON parse fail:', e.message); return items.map(()=>null); }
  const out = items.map(()=>null);
  for (const o of arr) if (o && Number.isInteger(o.i) && o.i>=0 && o.i<items.length) out[o.i] = o;
  return out;
}

async function main(){
  const useClaude = !!API_KEY;
  console.log('classify mode:', useClaude ? 'Claude API' : 'rule-based (free)');
  const existing = loadExisting();
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
    if (!c) return;
    if (c.relevant === false && !src.priority) return;   // 13-dev news kept even if classifier says off-topic
    const title = (c.titleKo || src.title).trim();
    if (!title || seenTitles.has(title)) return;
    seenTitles.add(title);
    toAdd.push({
      date: src.date || todayISO(),
      title,
      summary: (c.summary || '').trim(),
      cat: VALIDCAT.includes(c.cat) ? c.cat : '기술',
      type: VALIDTYPE.includes(c.type) ? c.type : 'General',
      dev: (c.dev || '').trim(),
      region: (c.region || '').trim(),
      source: src.source,
      url: src.link,
      k: src.key,
    });
  });

  if (toAdd.length === 0) { console.log('nothing relevant after classification — exiting'); return; }

  const merged = existing.concat(toAdd);
  merged.sort((a,b)=> dkey(b.date).localeCompare(dkey(a.date)));
  const updated = new Date(Date.now() + 9*3600*1000).toISOString().slice(0,16).replace('T',' ') + ' KST';
  fs.writeFileSync(FILE, HEADER + JSON.stringify(merged, null, 2) + ';\nwindow.SMR_UPDATED = ' + JSON.stringify(updated) + ';\n');
  console.log(`added ${toAdd.length} item(s):`);
  toAdd.forEach(n => console.log(`  · ${n.date} [${n.cat}/${n.type}] ${n.title}`));
}

main().catch(e => { console.error(e); process.exit(1); });
