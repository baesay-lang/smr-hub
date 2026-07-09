/* 실시간 회의 번역 — 웹 엔진
   설정(localStorage) → 데이터 로드 → Soniox 실시간 STT → Claude 번역 → 자막
   보안 무시 전제: 키는 브라우저 localStorage에만(깃·서버 없음). */

const $ = (id) => document.getElementById(id);
const SONIOX_WS = "wss://stt-rt.soniox.com/transcribe-websocket";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const TARGET_RATE = 16000, SOFT_LIMIT = 180;
const FILLER = new Set(["yeah","yes","yep","yup","ok","okay","k","right","sure","cool","mm","mhm",
  "uh","um","huh","hello","hi","hey","bye","thanks","thank you","got it","i see","nice","great",
  "exactly","correct","alright","wow"]);
const COST = {
  max:      {model:"claude-sonnet-4-6", batch:false, filler:false},
  balanced: {model:"claude-haiku-4-5",  batch:false, filler:true},
  min:      {model:"claude-haiku-4-5",  batch:true,  filler:true},
};

const cfg = {
  soniox: localStorage.getItem("tr_soniox") || "",
  anthropic: localStorage.getItem("tr_anthropic") || "",
  cost: localStorage.getItem("tr_cost") || "max",   // 기본 = 최대 품질
  source: localStorage.getItem("tr_source") || "system",
  title: localStorage.getItem("tr_title") || "",
  tz: localStorage.getItem("tr_tz") || "kst",
  companies: JSON.parse(localStorage.getItem("tr_companies") || "[]"),
  record: localStorage.getItem("tr_record") !== "0",   // 기본 ON
};

let GLOSS = null, SPEAKERS = null, SYS_PROMPT = "", SONIOX_CTX = "";
let ROSTER_MAP = {}, COMPANIES_LIST = [], ROSTER_BY_CO = {};
const EXCLUDE_CO = new Set(["Doosan","두산"]);   // 기본 목록에서 제외(필요하면 직접 추가 가능)
let CUSTOM = (()=>{ try { const c = JSON.parse(localStorage.getItem("tr_custom_roster")); return (c && c.people) ? c : {companies:[], people:{}}; } catch(e){ return {companies:[], people:{}}; } })();
let manualSeq = 0;
let ADMIN_PW = "admin1234";   // keys.local.json 의 admin_pw 로 덮어씀(없으면 이 기본값)
let adminUnlocked = false;
function saveCustom(){ try { localStorage.setItem("tr_custom_roster", JSON.stringify(CUSTOM)); } catch(e){} }
const state = { running:false, ws:null, ac:null, proc:null, stream:null,
  history:[], queue:[], pumping:false, segments:[],
  speakerMap:{}, spkRows:{}, spkAutoOpened:false,
  startedAt:null, endedAt:null, rec:null, recChunks:[], audioBlob:null,
  mp3enc:null, mp3Data:[] };

/* ---------- 로컬 키 자동 로드 (이 PC 전용 · keys.local.json, 깃 제외) ---------- */
async function loadLocalKeys() {
  try {
    const k = await (await fetch("keys.local.json", {cache:"no-store"})).json();
    if (!cfg.soniox && k.soniox) { cfg.soniox = k.soniox; localStorage.setItem("tr_soniox", k.soniox); }
    if (!cfg.anthropic && k.anthropic) { cfg.anthropic = k.anthropic; localStorage.setItem("tr_anthropic", k.anthropic); }
    if (k.admin_pw) ADMIN_PW = String(k.admin_pw);
  } catch (e) { /* 파일 없으면 무시 — 관리자에서 직접 입력 */ }
}

/* ---------- 보안(암호화 번들) 모드 ----------
   공개 배포(SMR HUB)에서는 키·용어집·명단을 비밀번호로 복호화해서만 사용.
   로컬(127.0.0.1)에서는 기존 방식(keys.local.json + data/) 그대로 — 비번 없이. */
function secureMode(){
  const h = location.hostname;
  const local = (h === "localhost" || h === "127.0.0.1" || h === "");
  return !local || new URLSearchParams(location.search).has("secure");
}
function b64d(s){ return Uint8Array.from(atob(s), c => c.charCodeAt(0)); }
async function decryptBundle(b, pw){
  const salt = b64d(b.salt), iv = b64d(b.iv), data = b64d(b.data);
  const baseKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey(
    {name:"PBKDF2", salt, iterations: b.iter||250000, hash:"SHA-256"},
    baseKey, {name:"AES-GCM", length:256}, false, ["decrypt"]);
  const pt = await crypto.subtle.decrypt({name:"AES-GCM", iv}, key, data);
  return JSON.parse(new TextDecoder().decode(pt));
}
async function loadSecure(){
  let blob;
  try { blob = await (await fetch("secure.enc", {cache:"no-store"})).json(); }
  catch(e){ setStatus("보안 데이터 로드 실패", "err"); return false; }
  for (let i=0; i<5; i++){
    const pw = prompt(i ? "비밀번호가 틀렸습니다. 다시 입력하세요:" : "이 도구를 사용하려면 비밀번호를 입력하세요:");
    if (pw === null){ setStatus("🔒 잠김 — ▶ 시작을 다시 누르면 비밀번호를 입력할 수 있어요", ""); return false; }
    try {
      const o = await decryptBundle(blob, pw.trim());
      cfg.soniox = o.soniox || ""; cfg.anthropic = o.anthropic || "";
      if (o.admin_pw) ADMIN_PW = String(o.admin_pw);
      adminUnlocked = true;   // 마스터 비번을 이미 통과함
      GLOSS = o.glossary; SPEAKERS = o.speakers;
      return true;
    } catch(e){ /* 복호화 실패 = 비번 틀림 → 재시도 */ }
  }
  setStatus("🔒 비밀번호 5회 실패 — ▶ 시작을 다시 눌러 시도하세요", "err");
  return false;
}

/* ---------- 데이터 로드 + 프롬프트 빌드 ---------- */
let locked = false;
async function loadData() {
  if (secureMode()){
    // 페이지는 보이게 하고, 실제 사용(시작) 때 비번으로 잠금 해제 → 그때 복호화
    locked = true;
    $("dataStatus").textContent = "🔒 비밀번호 필요";
    setStatus("🔒 팀 전용 도구 — ▶ 시작을 누른 뒤 비밀번호를 입력하세요", "");
    return;
  }
  await loadLocalKeys();
  try {
    GLOSS = await (await fetch("../data/glossary.json", {cache:"no-store"})).json();
    SPEAKERS = await (await fetch("../data/speakers.json", {cache:"no-store"})).json();
  } catch (e) { $("dataStatus").textContent = "용어집 로드 실패: " + e; return; }
  buildPrompts();
  buildRoster();
  $("dataStatus").textContent =
    `용어집 ${GLOSS.keep_english.length}개 · 조직 ${GLOSS.organizations.length} · 인명 ${rosterNames().length}`;
}
async function ensureUnlocked(){   // 보안 모드: 시작 시점에 1회 비번 입력 → 복호화
  if (!locked) return true;
  if (!(await loadSecure())) return false;   // 취소/오답 → 잠금 유지
  buildPrompts(); buildRoster();
  $("dataStatus").textContent =
    `용어집 ${GLOSS.keep_english.length}개 · 조직 ${GLOSS.organizations.length} · 인명 ${rosterNames().length}`;
  locked = false;
  return true;
}

function rosterNames() {
  const out = [];
  for (const [co, members] of Object.entries(SPEAKERS || {})) {
    if (co.startsWith("_") || !Array.isArray(members)) continue;
    for (const p of members) if (p && p.name_en) out.push(p.name_en.replace(/[()]/g,""));
  }
  return [...new Set(out)];
}
function rosterAliasLines() {
  const lines = [];
  for (const [co, members] of Object.entries(SPEAKERS || {})) {
    if (co.startsWith("_") || !Array.isArray(members)) continue;
    for (const p of members) {
      if (!p || !p.name_en) continue;
      const al = (p.aliases || []).join(", ");
      lines.push(`  - ${p.name_en} (${co})` + (al ? ` ← ${al}` : ""));
    }
  }
  return lines.join("\n");
}

function buildPrompts() {
  const g = GLOSS;
  // 회사 필터: 선택된 회사가 있으면 그 회사 조직·인명만 강조(없으면 전체)
  SONIOX_CTX = `${g.meeting_context} 주요 고유명사·용어: ` +
    [...g.keep_english, ...g.organizations.map(o=>o.canonical), ...rosterNames()]
      .filter(Boolean).join(", ") + ".";

  const keep = g.keep_english.join(", ");
  const fixed = Object.entries(g.translate_fixed||{}).map(([k,v])=>`- "${k}" → "${v}"`).join("\n");
  const orgs = (g.organizations||[]).map(o=>{
    const lab = o.canonical + (o.ko?` (${o.ko})`:"");
    const vs = (o.variants||[]).join(", ");
    return `- ${lab}` + (vs?` ← ${vs}`:"");
  }).join("\n");
  const acro = Object.entries(g.acronyms||{}).map(([k,v])=>`- ${k} = ${v}`).join("\n");
  const corr = Object.entries(g.stt_corrections||{}).filter(([k])=>!k.startsWith("_"))
    .map(([k,v])=> typeof v==="object" ? `- "${k}" → ${v.to} (${v.note||""})` : `- "${k}" → "${v}"`).join("\n");
  const fewshot = [
    ['we got the Part 72 license, first time in five decades','Part 72 라이선스를 받았는데, 이게 50년 만에 처음이래요.'],
    ['KHNP is under MOTIR and MOTIR will ask if viable','KHNP가 MOTIE 산하라서, MOTIE가 사업성 있는지 KHNP한테 물어볼 거예요.'],
    ['we can put Caxim and KEPCO in place for ECA financing','ECA 금융 쪽은 K-EXIM이랑 KEPCO를 붙이면 돼요.'],
    ['it just does seem a little premature but happy to be creative','지금 당장은 좀 이른 것 같아요. 그래도 방법은 같이 한번 찾아볼게요.'],
    ['no decision has been made at this time','아직 정해진 건 없어요.'],
  ].map(([e,k])=>`  "${e}" → "${k}"`).join("\n");

  SYS_PROMPT =
`You are a professional simultaneous interpreter for technical SMR (Small Modular Reactor) business meetings between X-energy (US) and DL E&C (Korea). Speakers are mostly Korean engineers using Korean-accented English, so the source text (from speech-to-text) may contain recognition errors.

Meeting context: ${g.meeting_context}

TASK: Turn the speaker's English into Korean the way a Korean professional would actually say it in a meeting — smooth, natural, easy to understand. First silently REPAIR likely speech-to-text errors using the glossary, then convey the INTENDED meaning. This is interpretation, NOT word-for-word.

RULES:
- Output ONLY the Korean translation. No explanations, no quotes, no English commentary.
- Keep these terms in ORIGINAL English: ${keep}
- Fixed Korean translations:
${fixed}
- Organizations — recognize even when garbled, always render the canonical name (English unless Korean given). "Canonical (Korean) ← variants":
${orgs}
- People — recognize even when garbled, always render the canonical name. "Canonical (company) ← variants":
${rosterAliasLines()}
- Acronym meanings (keep acronym in English, use meaning to translate correctly):
${acro}
- Other speech-to-text corrections:
${corr}
- Preserve numbers, units, regulation codes exactly.
- Korean business indirectness: convey intent. "a little premature / let's table it / not urgent" = soft no/deferral; US legal hedging ("no decision has been made") stays non-committal.
- NATURAL KOREAN: default to clear friendly-professional 해요체. No translationese, no English word order, no stiff "~할 것입니다". Use natural connectors (그래서, 근데, ~라서, ~한테). Smooth, not robotic.
- Examples:
${fewshot}`;
}

function isSkippable(t) {
  t = (t||"").trim().toLowerCase().replace(/[.,!?…~ ]+$/,"");
  if (!t || t.length <= 2) return true;
  const w = t.replace(/-/g," ").split(/\s+/);
  return w.length <= 2 && w.every(x => FILLER.has(x.replace(/[.,!?]/g,"")));
}

/* ---------- Claude 번역 (브라우저 직접 호출 · 캐싱) ---------- */
async function claude(content, maxTokens=600) {
  const model = COST[cfg.cost].model;
  const r = await fetch(ANTHROPIC_URL, {
    method:"POST",
    headers:{
      "content-type":"application/json",
      "x-api-key":cfg.anthropic,
      "anthropic-version":"2023-06-01",
      "anthropic-dangerous-direct-browser-access":"true",
    },
    body: JSON.stringify({
      model, max_tokens:maxTokens,
      system:[{type:"text", text:SYS_PROMPT, cache_control:{type:"ephemeral"}}],
      messages:[{role:"user", content}],
    }),
  });
  if (!r.ok) throw new Error("Claude " + r.status + " " + (await r.text()).slice(0,200));
  const j = await r.json();
  return (j.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("").trim();
}
function recentCtx() {
  if (!state.history.length) return "";
  const h = state.history.slice(-3).map(([e,k])=>`EN: ${e}\nKO: ${k}`).join("\n");
  return `[Recent context]\n${h}\n\n`;
}
async function translateOne(en) {
  const ko = await claude(recentCtx() + `[Translate this line]\n${en}`);
  state.history.push([en, ko]);
  return ko;
}
async function translateBatch(texts) {
  if (texts.length === 1) return [await translateOne(texts[0])];
  const numbered = texts.map((t,i)=>`${i+1}. ${t}`).join("\n");
  const out = await claude(recentCtx() +
    "Translate each numbered English line into Korean per the rules. Output ONLY translations, one per line, each prefixed with its number and a period, same order.\n\n" + numbered, 1024);
  const res = {};
  out.split("\n").forEach(line=>{ const m=line.match(/^\s*(\d+)[.)]\s*(.+)$/); if(m){const i=+m[1]-1; if(i>=0&&i<texts.length) res[i]=m[2].trim();}});
  if (Object.keys(res).length !== texts.length) return Promise.all(texts.map(translateOne));
  texts.forEach((e,i)=>state.history.push([e,res[i]]));
  return texts.map((_,i)=>res[i]);
}

/* ---------- 파이프라인 (순서보존 큐) ---------- */
function onSentence(s) { state.queue.push(s); pump(); }
async function pump() {
  if (state.pumping) return;
  state.pumping = true;
  try {
    while (state.queue.length) {
      const eco = COST[cfg.cost].batch;
      const batch = eco ? state.queue.splice(0, 5) : state.queue.splice(0, 1);
      const translateOn = $("translateChk").checked;
      const need = [];
      batch.forEach((it, i) => {
        const txt = (it.text||"").trim();
        if (translateOn && it.language !== "ko" && !(COST[cfg.cost].filler && isSkippable(txt))) need.push([i, txt]);
      });
      const tr = {};
      try {
        if (need.length === 1) tr[need[0][0]] = await translateOne(need[0][1]);
        else if (need.length > 1) (await translateBatch(need.map(n=>n[1]))).forEach((r,k)=>tr[need[k][0]]=r);
      } catch (e) { setStatus("번역 오류: " + e.message, "err"); }
      batch.forEach((it, i) => {
        const txt = (it.text||"").trim(); if (!txt) return;
        let en=null, ko, plain=false;
        if (i in tr) { en = txt; ko = tr[i]; }
        else { ko = txt; plain = true; }   // 한국어 / 번역 OFF / 자투리 → 원문
        const seg = {en, ko, speaker:it.speaker, lang:it.language, override:null, plain, ts:Date.now()};
        state.segments.push(seg);
        ensureSpeakerRow(it.speaker);
        renderSeg(seg);
      });
      autosave();
    }
  } finally { state.pumping = false; }
}
/* ---------- 화자: 라벨→이름/회사 매핑, 실시간 패널, 줄 단위 재지정 ---------- */
function buildRoster() {
  ROSTER_MAP = {}; COMPANIES_LIST = []; ROSTER_BY_CO = {};
  const addCo = (co) => { if (co && !COMPANIES_LIST.includes(co)) COMPANIES_LIST.push(co); };
  const addPerson = (co, raw) => {
    const nm = (raw||"").replace(/[()]/g,"").trim(); if (!nm || !co) return;
    ROSTER_MAP[nm] = co; addCo(co);
    (ROSTER_BY_CO[co] = ROSTER_BY_CO[co] || []);
    if (!ROSTER_BY_CO[co].includes(nm)) ROSTER_BY_CO[co].push(nm);
  };
  // 기본 로스터(speakers.json) — 두산 제외
  for (const [co, members] of Object.entries(SPEAKERS || {})) {
    if (co.startsWith("_") || !Array.isArray(members) || EXCLUDE_CO.has(co)) continue;
    addCo(co);
    for (const p of members) if (p && p.name_en) addPerson(co, p.name_en);
  }
  // 사용자가 직접 추가한 회사·이름
  (CUSTOM.companies||[]).forEach(addCo);
  for (const [co, names] of Object.entries(CUSTOM.people||{})) (names||[]).forEach(n => addPerson(co, n));
}
function registerPerson(company, name){
  if (!company || company === "미지정" || !name) return;
  CUSTOM.people[company] = CUSTOM.people[company] || [];
  if (!CUSTOM.people[company].includes(name)) CUSTOM.people[company].push(name);
  if (!COMPANIES_LIST.includes(company)) (CUSTOM.companies = CUSTOM.companies||[]).push(company);
  saveCustom(); buildRoster();
}
function addCompany(c){
  c = (c||"").trim(); if (!c) return false;
  if (!COMPANIES_LIST.includes(c)) { (CUSTOM.companies = CUSTOM.companies||[]).push(c); saveCustom(); buildRoster(); }
  return true;
}
/* 이름 없으면 회사 이름만으로 표시(요청 2) */
function spkLabel(name, company){
  company = (company && company !== "미지정") ? company : "";
  if (name) return name + (company ? ` · ${company}` : "");
  if (company) return company;
  return null;
}
const OUR_CO = "DL E&C";   // 회사별 색: 우리(DL)=코발트, 다른 회사=틸, 미지정=회색
function coClass(company){
  if (company === OUR_CO) return "co-dl";
  if (company && company !== "미지정") return "co-xe";
  return "co-none";
}
function initials(name, company){
  const n = (name||"").trim();
  if (n){ const p = n.split(/\s+/); return (p.length>=2 ? p[0][0]+p[1][0] : n.slice(0,2)).toUpperCase(); }
  const c = (company||"").trim();
  if (c && c!=="미지정") return c[0].toUpperCase();
  return "?";
}
function styleCap(seg){   // 화자 회사에 따라 아바타·이름·색 갱신(재지정 시에도 자동 반영)
  if (!seg.capEl) return;
  const m = seg.override || state.speakerMap[seg.speaker] || {};
  const name = m.name || "";
  const company = (m.company && m.company !== "미지정") ? m.company : "";
  seg.capEl.classList.remove("co-dl","co-xe","co-none");
  seg.capEl.classList.add(coClass(m.company));
  seg.capEl.classList.toggle("cont", !!seg._cont && !seg.override);   // 재지정되면 그룹에서 분리(머리표 표시)
  if (seg.avEl) seg.avEl.textContent = initials(name, company);
  if (seg.nameEl) seg.nameEl.textContent = name || company || ("화자 " + (seg.speaker==null?"?":seg.speaker));
  if (seg.subEl){
    const parts = [];
    if (name && company) parts.push(company);
    if (state.startedAt && seg.ts) parts.push(fmtElapsed(seg.ts - state.startedAt));
    seg.subEl.textContent = parts.length ? " · " + parts.join(" · ") : "";
  }
}
function refreshLabel(label) {
  for (const s of state.segments)
    if (!s.override && String(s.speaker) === String(label)) styleCap(s);
}
/* 자막 줄 클릭 → 우측 화자 목록에서 고르거나 직접 입력(요청 3) */
function panelSpeakers(){
  const seen = new Set(), out = [];
  document.querySelectorAll("#spkList .spk-row").forEach(row => {
    const nm = row.querySelector(".spk-name"), co = row.querySelector(".spk-co");
    const name = (nm && nm.value.trim()) || "";
    let company = (co && co.value) || ""; if (company === "__add__" || company === "미지정") company = "";
    const disp = spkLabel(name, company);
    if (disp && !seen.has(disp)) { seen.add(disp); out.push({ name, company, disp }); }
  });
  return out;
}
function closeSpeakerPicker(){ const m = document.querySelector(".spk-picker"); if (m) m.remove(); }
function showSpeakerPicker(seg, anchor){
  closeSpeakerPicker();
  const menu = document.createElement("div"); menu.className = "spk-picker";
  const item = (label, fn, cls) => { const b = document.createElement("button"); b.textContent = label;
    if (cls) b.className = cls; b.onclick = (e)=>{ e.stopPropagation(); closeSpeakerPicker(); fn(); }; menu.appendChild(b); };
  const set = (name, company) => { seg.override = { name, company }; styleCap(seg); };
  const people = panelSpeakers();
  if (!people.length){ const d = document.createElement("div"); d.className = "spk-picker-empty"; d.textContent = "우측에 등록된 화자 없음"; menu.appendChild(d); }
  people.forEach(p => item(p.disp, ()=> set(p.name, p.company)));
  item("직접 입력…", ()=> reassignPrompt(seg), "pick-input");
  item("원래 화자로", ()=>{ seg.override = null; styleCap(seg); }, "pick-clear");
  document.body.appendChild(menu);
  const r = anchor.getBoundingClientRect();
  menu.style.left = (r.left + window.scrollX) + "px";
  menu.style.top  = (r.bottom + window.scrollY + 4) + "px";
  setTimeout(()=> document.addEventListener("click", closeSpeakerPicker, { once:true }), 0);
}
function reassignPrompt(seg) {
  const cur = seg.override ? seg.override.name
            : (state.speakerMap[seg.speaker] && state.speakerMap[seg.speaker].name) || "";
  const name = prompt("화자 이름 직접 입력 (비우면 지정 해제):", cur);
  if (name === null) return;
  const nm = name.trim();
  if (!nm) { seg.override = null; styleCap(seg); return; }
  const company = ROSTER_MAP[nm] || "";
  seg.override = { name: nm, company };
  styleCap(seg);
  ensureManualRow(nm, company || "미지정");   // 우측 화자 패널에 반영(요청 1)
}

/* 회사 select 옵션 채우기 (미지정 + 회사들 + '+ 회사 추가') */
function fillCompanySelect(sel, current){
  sel.innerHTML = "";
  const opts = ["미지정", ...COMPANIES_LIST];
  if (current && current !== "미지정" && !opts.includes(current)) opts.push(current);
  opts.forEach(c => { const o = document.createElement("option"); o.value = c; o.textContent = c; sel.appendChild(o); });
  const add = document.createElement("option"); add.value = "__add__"; add.textContent = "+ 회사 추가…"; sel.appendChild(add);
  sel.value = (current && opts.includes(current)) ? current : "미지정";
}
/* 이름 select 채우기: 미지정 + 그 회사 사람 + 직접 입력 (요청 2·3) */
function fillNameSelect(sel, company, current){
  sel.innerHTML = "";
  const mk = (v,t)=>{ const o=document.createElement("option"); o.value=v; o.textContent=t; sel.appendChild(o); };
  mk("", "미지정");
  const names = (company && company !== "미지정" && ROSTER_BY_CO[company]) ? ROSTER_BY_CO[company] : Object.keys(ROSTER_MAP);
  names.forEach(n => mk(n, n));
  if (current && !names.includes(current)) mk(current, current);
  mk("__add__", "+ 직접 입력…");
  sel.value = current || "";
}
/* select 자리에서 바로 타이핑해 새 값 입력(요청 1) */
function inlineAdd(selectEl, placeholder, commit){
  const input = document.createElement("input"); input.className = selectEl.className; input.placeholder = placeholder;
  selectEl.replaceWith(input); input.focus();
  let settled = false;
  const finish = (save) => { if (settled) return; settled = true;
    const val = input.value.trim(); input.replaceWith(selectEl); commit(save ? val : null); };
  input.addEventListener("keydown", e => { if (e.key === "Enter"){ e.preventDefault(); finish(true); } else if (e.key === "Escape"){ finish(false); } });
  input.addEventListener("blur", () => finish(true));
}
function ensureSpeakerRow(label) {
  if (label == null) return;
  const key = String(label);
  if (state.spkRows[key]) return;
  addSpeakerRow({ key, labelText: "화자 " + label });
}
function ensureManualRow(name, company){
  const key = name ? ("man:" + name) : ("man#" + (++manualSeq));
  if (state.spkRows[key]) return;
  addSpeakerRow({ key, labelText: "추가", manual: true, name, company });
}
/* 공통 행 생성: 회사 → 이름 순. 둘 다 드롭다운(미지정 가능) + 직접 입력 */
function addSpeakerRow(opts){
  const { key, labelText, manual=false } = opts;
  const list = $("spkList"); if (!list) return;
  const row = document.createElement("div"); row.className = "spk-row" + (manual ? " manual" : "");
  row.classList.add(coClass(opts.company));
  const av = document.createElement("div"); av.className = "spk-av"; av.title = labelText;
  av.textContent = initials(opts.name || "", (opts.company && opts.company!=="미지정") ? opts.company : "");
  const co = document.createElement("select"); co.className = "search spk-co";
  const nm = document.createElement("select"); nm.className = "search spk-name";
  fillCompanySelect(co, opts.company || "미지정");
  fillNameSelect(nm, co.value, opts.name || "");
  let curName = opts.name || "";

  const applyMap = () => {
    const company = co.value === "__add__" ? "미지정" : co.value;
    const name = nm.value === "__add__" ? "" : nm.value;
    row.classList.remove("co-dl","co-xe","co-none"); row.classList.add(coClass(company));
    av.textContent = initials(name, (company && company!=="미지정") ? company : "");
    if (manual) {
      const newCo = (company === "미지정" || !company) ? "" : company;
      for (const s of state.segments)
        if (s.override && s.override.name === curName) { s.override.name = name || curName; s.override.company = newCo; styleCap(s); }
      curName = name || curName;
    } else {
      state.speakerMap[key] = { name, company }; refreshLabel(key);
    }
  };
  co.addEventListener("change", () => {
    if (co.value === "__add__") {                              // 회사 직접 입력(요청 1)
      co.value = "미지정";
      inlineAdd(co, "회사 이름 입력", (val) => {
        if (val) { addCompany(val); fillCompanySelect(co, val); co.value = val; }
        else fillCompanySelect(co, "미지정");
        fillNameSelect(nm, co.value, "");
        applyMap();
      });
      return;
    }
    fillNameSelect(nm, co.value, nm.value === "__add__" ? "" : nm.value);
    applyMap();
  });
  nm.addEventListener("change", () => {
    if (nm.value === "__add__") {                              // 이름 직접 입력(요청 1·3)
      nm.value = "";
      inlineAdd(nm, "이름 입력", (val) => {
        const company = co.value;
        if (val && company && company !== "미지정") registerPerson(company, val);
        fillNameSelect(nm, company, val || "");
        applyMap();
      });
      return;
    }
    const c = ROSTER_MAP[nm.value];                            // 알려진 이름이면 회사 자동
    if (nm.value && c && co.value === "미지정") { fillCompanySelect(co, c); co.value = c; fillNameSelect(nm, c, nm.value); }
    applyMap();
  });
  const del = document.createElement("button"); del.className = "spk-del"; del.textContent = "−"; del.title = "삭제";
  del.onclick = () => {
    delete state.spkRows[key];
    if (!manual) { delete state.speakerMap[key]; refreshLabel(key); }
    row.remove();
  };
  row.appendChild(av); row.appendChild(co); row.appendChild(nm); row.appendChild(del);
  list.appendChild(row);
  state.spkRows[key] = true;
  if (manual && opts.name) applyMap();
  if (!state.spkAutoOpened) { $("spkPanel").hidden = false; state.spkAutoOpened = true; }
}

/* ---------- Soniox 실시간 STT ---------- */
async function getStream() {
  if (cfg.source === "mic") return navigator.mediaDevices.getUserMedia({audio:true});
  const s = await navigator.mediaDevices.getDisplayMedia({video:true, audio:true});
  if (!s.getAudioTracks().length) { s.getTracks().forEach(t=>t.stop());
    throw new Error("오디오가 공유 안 됨 — 공유 창에서 '오디오 공유'를 체크하세요"); }
  s.getVideoTracks().forEach(t=>t.stop());
  return s;
}
function startSTT() {
  const ws = new WebSocket(SONIOX_WS);
  state.ws = ws;
  ws.binaryType = "arraybuffer";
  let finalText = "", spk = {}, lang = {}, curSpk = null;
  const top = (o)=>{const k=Object.keys(o); return k.length? k.reduce((a,b)=>o[a]>=o[b]?a:b):null;};
  const emit = () => {
    const t = finalText.trim();
    if (t) onSentence({text:t, speaker:(curSpk!=null?curSpk:top(spk)), language:(top(lang)||"en")});
    finalText=""; spk={}; lang={}; curSpk=null;
  };
  ws.onopen = () => {
    ws.send(JSON.stringify({
      api_key:cfg.soniox, model:"stt-rt-v4", audio_format:"pcm_s16le",
      sample_rate:TARGET_RATE, num_channels:1, language_hints:["en","ko"],
      enable_endpoint_detection:true, enable_language_identification:true,
      enable_speaker_diarization:true, context:SONIOX_CTX,
    }));
    // 오디오 시작 실패(공유 취소·마이크 거부 등)를 놓치지 않고 정지 처리
    pipeAudio().then(()=>{
      setStatus(`듣는 중 (${cfg.source==="mic"?"마이크":"시스템 오디오"})`, "live");
    }).catch(e=>{
      const msg = /Permission|NotAllowed/i.test(e.name||e.message) ? "취소됨 — 오디오 공유/마이크를 허용해야 시작돼요" : e.message;
      setStatus("시작 실패: " + msg, "err"); stop();
    });
  };
  ws.onmessage = (ev) => {
    let res; try { res = JSON.parse(ev.data); } catch { return; }
    let interim = finalText;
    for (const tok of (res.tokens||[])) {
      const text = tok.text || "";
      if (!tok.is_final) { interim += text; continue; }
      if (text === "<end>") { emit(); interim=""; continue; }
      // 화자가 바뀌면 그 지점에서 끊어 화자별로 분리(한 덩어리에 여러 명 묻히는 것 방지)
      if (tok.speaker != null && curSpk != null && String(tok.speaker) !== String(curSpk) && finalText.trim()) {
        emit(); interim="";
      }
      finalText += text;
      if (tok.speaker != null) { spk[tok.speaker]=(spk[tok.speaker]||0)+1; if (curSpk==null) curSpk=tok.speaker; }
      if (tok.language) lang[tok.language]=(lang[tok.language]||0)+1;
      interim = finalText;
      if (finalText.length >= SOFT_LIMIT) { emit(); interim=""; }
    }
    $("interim").textContent = interim.trim() ? "… " + interim.trim() : "";
    if (res.finished) emit();
  };
  ws.onerror = () => { if (state.running) setStatus("STT 연결 오류", "err"); };
  ws.onclose = () => {   // 회의 중 예기치 않게 끊기면 명확히 알리고 정지
    if (!state.running) return;
    emit(); stop();
    setStatus("연결 끊김 — 지금까지 자막은 저장 가능. 다시 시작해 주세요", "err");
  };
}
async function pipeAudio() {
  state.stream = await getStream();
  startRecording(state.stream);
  const ac = new (window.AudioContext||window.webkitAudioContext)();
  state.ac = ac;
  const src = ac.createMediaStreamSource(state.stream);
  const proc = ac.createScriptProcessor(4096, 1, 1);
  state.proc = proc;
  const ratio = ac.sampleRate / TARGET_RATE;
  proc.onaudioprocess = (e) => {
    if (!state.running) return;
    const inp = e.inputBuffer.getChannelData(0);
    const outLen = Math.floor(inp.length / ratio);
    const out = new Int16Array(outLen);
    for (let i=0;i<outLen;i++){   // 구간 평균으로 다운샘플(단순 추출 대비 잡음↓ → 인식률↑)
      const a = Math.floor(i*ratio), b = Math.min(inp.length, Math.max(a+1, Math.floor((i+1)*ratio)));
      let sum = 0; for (let j=a;j<b;j++) sum += inp[j];
      const s = sum / (b-a);
      out[i] = Math.max(-1,Math.min(1,s))*0x7fff;
    }
    if (state.mp3enc) { try { const b = state.mp3enc.encodeBuffer(out); if (b && b.length) state.mp3Data.push(b); } catch(e){} }
    if (state.ws && state.ws.readyState === 1) state.ws.send(out.buffer);
  };
  src.connect(proc); proc.connect(ac.destination);
}

/* ---------- 시작/정지 ---------- */
async function start() {
  if (state.running) return;
  if (!(await ensureUnlocked())) return;   // 보안 모드면 비번 먼저(취소 시 중단)
  if (!cfg.soniox || !cfg.anthropic) { openSettings(); setStatus("⚠ 설정에서 API 키를 먼저 넣어주세요","err"); return; }
  if (!SYS_PROMPT) { setStatus("용어집 로딩 중 — 잠시 후 다시","err"); return; }
  state.running = true; state.history = []; state.segments = [];
  state.startedAt = Date.now(); state.endedAt = null;
  state.audioBlob = null; state.recChunks = [];
  state.mp3enc = null; state.mp3Data = [];
  $("captions").innerHTML = ""; $("interim").textContent = "";   // 새 회의 = 새 전사
  curRow = null; lastSeg = null;
  setRunningUI(true);
  $("saveBtn").disabled = true;
  try { startSTT(); }
  catch (e) { setStatus("시작 실패: " + e.message, "err"); stop(); }
}
function stop() {
  state.running = false; state.endedAt = Date.now();
  try { if (state.rec && state.rec.state !== "inactive") state.rec.stop(); } catch {}
  try { state.proc && state.proc.disconnect(); } catch {}
  try { state.ac && state.ac.close(); } catch {}
  try { state.stream && state.stream.getTracks().forEach(t=>t.stop()); } catch {}
  try { if (state.ws && state.ws.readyState===1){ state.ws.send(""); state.ws.close(); } } catch {}
  if (state.mp3enc) {   // MP3 인코딩 마무리
    try { const end = state.mp3enc.flush(); if (end && end.length) state.mp3Data.push(end);
      if (state.mp3Data.length) state.audioBlob = new Blob(state.mp3Data, {type:"audio/mpeg"}); } catch(e){}
    state.mp3enc = null;
  }
  setRunningUI(false);
  $("interim").textContent = "";
  if (state.segments.length) $("saveBtn").disabled = false;
  setStatus("정지됨" + (state.segments.length ? ` — ${state.segments.length}줄, 저장 가능` : ""), "");
}

/* ---------- 오디오 녹음 ----------
   기본: MP3(범용·소용량). 16kHz PCM(STT용으로 이미 만듦)을 pipeAudio에서 실시간 인코딩.
   폴백: lamejs 없으면 MediaRecorder(webm). */
function startRecording(stream) {
  if (!cfg.record) return;
  if (!stream.getAudioTracks().length) return;
  if (window.lamejs && window.lamejs.Mp3Encoder) {
    try { state.mp3enc = new lamejs.Mp3Encoder(1, TARGET_RATE, 32); state.mp3Data = []; return; }
    catch (e) { state.mp3enc = null; }   // 실패 시 아래 폴백
  }
  if (!window.MediaRecorder) return;
  let mime = "";
  for (const m of ["audio/webm;codecs=opus","audio/webm","audio/ogg;codecs=opus"])
    if (MediaRecorder.isTypeSupported(m)) { mime = m; break; }
  try {
    const opts = {audioBitsPerSecond: 32000};
    if (mime) opts.mimeType = mime;
    const rec = new MediaRecorder(stream, opts);
    state.rec = rec; state.recChunks = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) state.recChunks.push(e.data); };
    rec.onstop = () => {
      if (!state.recChunks.length) return;
      state.audioBlob = new Blob(state.recChunks, {type: state.recChunks[0].type || mime || "audio/webm"});
    };
    rec.start(1000);
  } catch (e) { setStatus("녹음 시작 실패(자막은 계속됨): " + e.message, ""); }
}

/* ---------- 기록 저장 (txt·json) + 자동 백업 ---------- */
const pad = (n) => String(n).padStart(2, "0");
function fmtClock(ms){ const d=new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function fmtElapsed(ms){ const s=Math.max(0,Math.floor(ms/1000)); return `${pad(Math.floor(s/60))}:${pad(s%60)}`; }
function safeName(s){ return (s||"").replace(/[\\/:*?"<>|]/g,"_").trim(); }
function meetingName(){
  if (cfg.title) return safeName(cfg.title);
  const d = new Date(state.startedAt || Date.now());
  return `회의_${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}
function buildMeta(){
  return { name: cfg.title || meetingName(), tz: cfg.tz, companies: cfg.companies,
    startedAt: state.startedAt, endedAt: state.endedAt || Date.now(), speakerMap: state.speakerMap };
}
function cleanSegments(segs){
  return segs.map(s => {
    const m = state.speakerMap[s.speaker] || {};
    const o = s.override;   // 줄 단위 지정이 있으면 그 값 그대로(행 매핑과 섞지 않음)
    return { ts:s.ts||null, speaker:s.speaker,
      name: o ? (o.name || null) : (m.name || null),
      company: o ? (o.company || null) : (m.company || null),
      lang:s.lang, en:s.en, ko:s.ko, plain:!!s.plain };
  });
}
function currentData(){
  if (state.segments.length) return { meta: buildMeta(), segments: cleanSegments(state.segments) };
  return null;
}
function buildTxt(data){
  const m=data.meta||{}, segs=data.segments||[];
  const start = m.startedAt || (segs[0] && segs[0].ts);
  const out = [];
  out.push(`회의: ${m.name||"(제목 없음)"}`);
  if (start) out.push(`일시: ${fmtClock(start)}` + (m.endedAt?` ~ ${fmtClock(m.endedAt)}`:""));
  if (m.companies && m.companies.length) out.push(`참여 회사: ${m.companies.join(", ")}`);
  const mapped = Object.entries(m.speakerMap||{}).map(([k,v])=>[k, spkLabel(v&&v.name, v&&v.company)]).filter(([,l])=>l);
  if (mapped.length) out.push(`화자: ` + mapped.map(([k,l])=>`화자${k}=${l}`).join(", "));
  out.push(""); out.push("-".repeat(40)); out.push("");
  for (const s of segs){
    const t = (start && s.ts) ? fmtElapsed(s.ts - start) : "--:--";
    const who = spkLabel(s.name, s.company) || `화자 ${s.speaker==null?"?":s.speaker}`;
    out.push(`[${t}] ${who}`);
    if (s.en) out.push(`  ${s.en}`);
    out.push(`  ${s.ko}`);
    out.push("");
  }
  return out.join("\n");
}
function download(filename, content, type){
  const blob = content instanceof Blob ? content : new Blob([content], {type: type || "text/plain;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href=url; a.download=filename;
  document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 1500);
}
/* --- Word(.docx): 외부 라이브러리 없이 OOXML zip 직접 생성 --- */
function xmlEsc(s){ return (s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
function para(text, opt={}){
  const rpr = (opt.bold?"<w:b/>":"") + (opt.sz?`<w:sz w:val="${opt.sz}"/>`:"") + (opt.color?`<w:color w:val="${opt.color}"/>`:"");
  const ppr = opt.space?`<w:pPr><w:spacing w:after="${opt.space}"/></w:pPr>`:"";
  return `<w:p>${ppr}<w:r>${rpr?`<w:rPr>${rpr}</w:rPr>`:""}<w:t xml:space="preserve">${xmlEsc(text)}</w:t></w:r></w:p>`;
}
function buildDocx(data){
  const m=data.meta||{}, segs=data.segments||[];
  const start = m.startedAt || (segs[0] && segs[0].ts);
  let body = para(m.name||"회의 기록", {bold:true, sz:32, space:120});
  if (start) body += para(`일시: ${fmtClock(start)}` + (m.endedAt?` ~ ${fmtClock(m.endedAt)}`:""), {sz:18, color:"666666"});
  if (m.companies && m.companies.length) body += para(`참여 회사: ${m.companies.join(", ")}`, {sz:18, color:"666666"});
  const mapped = Object.entries(m.speakerMap||{}).map(([k,v])=>[k, spkLabel(v&&v.name, v&&v.company)]).filter(([,l])=>l);
  if (mapped.length) body += para("화자: " + mapped.map(([k,l])=>`화자${k}=${l}`).join(", "), {sz:18, color:"666666", space:160});
  for (const s of segs){
    const t = (start && s.ts) ? fmtElapsed(s.ts-start) : "--:--";
    const who = spkLabel(s.name, s.company) || `화자 ${s.speaker==null?"?":s.speaker}`;
    body += para(`[${t}] ${who}`, {bold:true, sz:20});
    if (s.en) body += para(s.en, {sz:18, color:"888888"});
    body += para(s.ko, {sz:22, space:160});
  }
  return packDocx(body);
}
function packDocx(body){
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr/></w:body></w:document>`;
  const ct = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
  const enc = new TextEncoder();
  return zipStore([
    {name:"[Content_Types].xml", data:enc.encode(ct)},
    {name:"_rels/.rels", data:enc.encode(rels)},
    {name:"word/document.xml", data:enc.encode(doc)},
  ], "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
}
/* 마크다운풍 텍스트(# 제목, - 불릿) → Word 문단 */
function plainDocx(title, text){
  let body = para(title, {bold:true, sz:32, space:160});
  for (const raw of (text||"").split("\n")){
    const line = raw.replace(/\s+$/,"");
    if (!line){ body += para("", {sz:10}); continue; }
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h){ const lvl=h[1].length; body += para(h[2], {bold:true, sz:lvl===1?28:lvl===2?24:22, space:120}); }
    else body += para(line, {sz:20, space:60});
  }
  return packDocx(body);
}
function crc32(b){ let c=~0; for(let i=0;i<b.length;i++){ c^=b[i]; for(let k=0;k<8;k++) c=(c>>>1)^(0xEDB88320 & -(c&1)); } return ~c>>>0; }
function zipStore(files, mime){
  const enc=new TextEncoder(), u16=n=>[n&255,(n>>8)&255], u32=n=>[n&255,(n>>8)&255,(n>>16)&255,(n>>24)&255];
  const parts=[], central=[]; let offset=0;
  for(const f of files){
    const nm=enc.encode(f.name), d=f.data, crc=crc32(d);
    const lh=new Uint8Array([].concat(u32(0x04034b50),u16(20),u16(0x0800),u16(0),u16(0),u16(0),u32(crc),u32(d.length),u32(d.length),u16(nm.length),u16(0)));
    parts.push(lh, nm, d);
    central.push(new Uint8Array([].concat(u32(0x02014b50),u16(20),u16(20),u16(0x0800),u16(0),u16(0),u16(0),u32(crc),u32(d.length),u32(d.length),u16(nm.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset))), nm);
    offset += lh.length + nm.length + d.length;
  }
  let cdSize=0; central.forEach(c=>cdSize+=c.length);
  const eocd=new Uint8Array([].concat(u32(0x06054b50),u16(0),u16(0),u16(files.length),u16(files.length),u32(cdSize),u32(offset),u16(0)));
  const all=[...parts,...central,eocd]; let total=0; all.forEach(a=>total+=a.length);
  const out=new Uint8Array(total); let p=0; for(const a of all){ out.set(a,p); p+=a.length; }
  return new Blob([out], {type:mime||"application/zip"});
}

/* --- 형식별 저장 (txt / json / docx / audio) --- */
function saveFmt(fmt){
  if (fmt === "audio") { saveAudio(); return; }
  const data = currentData();
  if (!data || !data.segments.length) { setStatus("저장할 기록이 없어요","err"); return; }
  const base = safeName(data.meta && data.meta.name) || meetingName();
  if (fmt==="txt")  download(`${base}_자막.txt`, buildTxt(data));
  if (fmt==="json") download(`${base}_기록.json`, JSON.stringify(data,null,2), "application/json");
  if (fmt==="docx") download(`${base}.docx`, buildDocx(data));
  setStatus(`기록 저장됨 — ${data.segments.length}줄 (${fmt})`, "");
}

/* ---------- 회의록(MoM) 자동작성 (회사별 입장 · 음슴체) ---------- */
const MOM_SYSTEM = `너는 SMR 사업 회의록(MoM)을 정리하는 보조자다. 한국어로, 음슴체(~함/~필요함/~로 봄)로 쓴다. 이모지 금지.
입력은 회사별로 묶인 회의 발언(영어 원문/한국어 번역 혼재)이다.
아래 순서로 정리한다(마크다운 제목 사용):
## 회의 개요 — 회의 성격·전체 맥락을 1~2줄로.
## 회사별 정리 — 회사마다 ### 소제목으로, (가) 핵심 입장·주장 (나) 합의/결정 사항 (다) follow-up·다음 액션을 개조식으로.
## 전체 결정사항·다음 액션 — 회사 교차 핵심만 모아 정리.
개인이 아니라 '회사 측 입장'으로 종합한다. 기술·규제·금융 용어(SMR, MOTIE, NRC, SPV, TRISO-X 등)는 영문 유지. 추측·불명확한 건 '확인 필요'로 표시. 발언에 없는 내용은 지어내지 말 것.`;

function momSource(){ return currentData(); }
function momStatus(s){ $("momStatus").textContent = s; }
function momName(){ const d=momSource(); return safeName(d && d.meta && d.meta.name) || meetingName(); }
function momBundle(data){
  const by = {};
  for (const s of data.segments){
    const comp = (s.company && s.company!=="미지정") ? s.company : (s.name || "미지정");
    const line = (s.ko || s.en || "").trim();
    if (line) (by[comp] = by[comp] || []).push(line);
  }
  const blocks = Object.entries(by).map(([c,ls])=> `## ${c}\n` + ls.slice(0,400).map(l=>`- ${l}`).join("\n"));
  return blocks.length ? blocks.join("\n\n") : "(발언 없음)";
}
async function claudeMoM(userContent){
  const model = cfg.cost==="min" ? "claude-haiku-4-5" : "claude-sonnet-4-6";
  const r = await fetch(ANTHROPIC_URL, { method:"POST", headers:{
    "content-type":"application/json", "x-api-key":cfg.anthropic,
    "anthropic-version":"2023-06-01", "anthropic-dangerous-direct-browser-access":"true",
  }, body: JSON.stringify({ model, max_tokens:2500, system:MOM_SYSTEM, messages:[{role:"user", content:userContent}] }) });
  if (!r.ok) throw new Error("Claude " + r.status + " " + (await r.text()).slice(0,200));
  const j = await r.json();
  return (j.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("").trim();
}
async function generateMoM(){
  if (!cfg.anthropic){ momStatus("⚠ 설정에서 Anthropic 키를 먼저 넣어주세요"); return; }
  const data = momSource();
  if (!data || !data.segments.length){ momStatus("정리할 회의 기록이 없어요 — 회의를 먼저 진행하세요"); return; }
  const m = data.meta || {}, title = m.name || meetingName();
  const head = `회의: ${title}` + (m.startedAt?`\n일시: ${fmtClock(m.startedAt)}`:"") + (m.companies&&m.companies.length?`\n참여 회사: ${m.companies.join(", ")}`:"");
  momStatus("초안 생성 중… (회사별 입장으로 정리, 10~30초)"); $("momGen").disabled = true;
  try {
    const out = await claudeMoM(`${head}\n\n아래 회사별 발언을 MoM 초안으로 정리해줘.\n\n${momBundle(data)}`);
    $("momText").value = `# 회의록 초안 — ${title}\n\n${out}\n`;
    $("momSaveDocx").disabled = false; $("momSaveTxt").disabled = false;
    momStatus("초안 완료 — 검토·수정 후 저장하세요");
  } catch(e){ momStatus("생성 오류: " + e.message); }
  finally { $("momGen").disabled = false; }
}
function saveMoM(fmt){
  const text = $("momText").value.trim();
  if (!text){ momStatus("저장할 내용이 없어요"); return; }
  const base = `MoM_${momName()}`;
  if (fmt==="txt") download(`${base}.txt`, text);
  else download(`${base}.docx`, plainDocx(`회의록 — ${momName()}`, text));
  momStatus(`저장됨 (${fmt})`);
}
function openMoM(){
  $("momModal").hidden = false;
  const d = momSource();
  momStatus(d && d.segments.length ? `현재 회의 기록 ${d.segments.length}줄 준비됨 — '초안 생성'을 누르세요`
                                   : "현재 기록 없음 — 회의를 먼저 진행하세요");
}
function saveAudio(){
  if (!state.audioBlob) { setStatus("저장할 오디오가 없어요","err"); return; }
  const t = state.audioBlob.type;
  const ext = t.includes("mpeg") ? "mp3" : t.includes("ogg") ? "ogg" : "webm";
  download(`${meetingName()}.${ext}`, state.audioBlob);
  setStatus("오디오 저장됨", "");
}
function autosave(){
  if (state.segments.length) $("saveBtn").disabled = false;   // 회의 중에도 저장 가능
}

/* ---------- UI ---------- */
let curRow = null, lastSeg = null;
function renderSeg(seg) {
  const c = $("captions");
  const row = document.createElement("div"); row.className = "cap";
  const av = document.createElement("div"); av.className = "cap-av";
  const body = document.createElement("div"); body.className = "cap-body";
  const meta = document.createElement("div"); meta.className = "cap-meta clickable"; meta.title = "클릭: 화자 고르기/바꾸기";
  meta.onclick = (e) => { e.stopPropagation(); showSpeakerPicker(seg, meta); };
  const nameEl = document.createElement("span"); nameEl.className = "cap-name";
  const subEl = document.createElement("span"); subEl.className = "cap-sub";
  meta.appendChild(nameEl); meta.appendChild(subEl);
  const k = document.createElement("div"); k.className = "cap-ko" + (seg.plain ? " plain" : ""); k.textContent = seg.ko;
  body.appendChild(meta); body.appendChild(k);
  if (seg.en) { const e = document.createElement("div"); e.className = "cap-en"; e.textContent = seg.en; body.appendChild(e); }
  row.appendChild(av); row.appendChild(body);
  seg.capEl = row; seg.avEl = av; seg.nameEl = nameEl; seg.subEl = subEl; seg.tagEl = meta;
  // 같은 화자가 연속이면 아바타·이름 반복 없이 이어붙임(오터식 그룹)
  seg._cont = !!(lastSeg && lastSeg.speaker === seg.speaker && seg.speaker != null && !seg.override && !lastSeg.override);
  if (curRow) curRow.classList.remove("current");
  curRow = row; styleCap(seg); row.classList.add("current");
  lastSeg = seg;
  c.appendChild(row); c.scrollTop = c.scrollHeight;
}
function setRunningUI(running){   // 시작/정지 토글 버튼 한 개
  const ic=$("toggleIcon"), lbl=$("toggleLabel");
  if (running){ ic.classList.remove("ic-fill"); ic.innerHTML='<rect x="6" y="6" width="12" height="12" rx="1.5"/>'; lbl.textContent="정지"; }
  else { ic.classList.add("ic-fill"); ic.innerHTML='<path d="M7 5.5v13l11-6.5z"/>'; lbl.textContent="시작"; }
}
function setStatus(msg, kind){ $("status").textContent = msg;
  const p=$("statePill");
  if (kind==="live" || kind==="err"){ p.style.display=""; p.className="state-pill "+kind; p.textContent = kind==="live"?"LIVE":"오류"; }
  else { p.style.display="none"; p.textContent=""; } }
function applyFont(){ const ko=+$("fontRange").value;
  document.documentElement.style.setProperty("--cap-ko", ko+"px");
  document.documentElement.style.setProperty("--cap-en", Math.max(13,ko-3)+"px"); }

function openSettings(){ $("sonioxKey").value=cfg.soniox; $("anthropicKey").value=cfg.anthropic;
  $("meetingTitle").value=cfg.title; $("recordChk").checked=cfg.record;
  setChips("costPreset","cost",cfg.cost);
  $("settingsModal").hidden=false; }
function setChips(id, attr, val){ [...$(id).children].forEach(c=>c.classList.toggle("active", c.dataset[attr]===val)); }
function chipPick(id, attr){ let v=null; $(id).onclick=(e)=>{ const c=e.target.closest(".chip"); if(!c)return;
  [...$(id).children].forEach(x=>x.classList.remove("active")); c.classList.add("active"); };
}

/* ---------- 이벤트 바인딩 ---------- */
$("toggleBtn").onclick = () => (state.running ? stop() : start());
$("saveBtn").onclick = (e)=>{ e.stopPropagation(); if($("saveBtn").disabled) return;
  const ai=$("saveAudioItem"); ai.disabled=!state.audioBlob;
  ai.textContent = state.audioBlob ? "오디오 (.mp3)" : "오디오 (녹음 정지 후)";
  $("saveMenu").hidden = !$("saveMenu").hidden; };
$("saveMenu").onclick = (e)=>{ const b=e.target.closest("button[data-fmt]"); if(!b||b.disabled) return;
  $("saveMenu").hidden = true; saveFmt(b.dataset.fmt); };
document.addEventListener("click", (e)=>{ if(!e.target.closest(".save-wrap")) $("saveMenu").hidden = true; });
$("momBtn").onclick = openMoM;
$("momClose").onclick = ()=> $("momModal").hidden = true;
$("momGen").onclick = generateMoM;
$("momSaveDocx").onclick = ()=> saveMoM("docx");
$("momSaveTxt").onclick = ()=> saveMoM("txt");
$("momText").oninput = ()=>{ const has=!!$("momText").value.trim();
  $("momSaveDocx").disabled=!has; $("momSaveTxt").disabled=!has; };
$("fontRange").oninput = applyFont;
function requireAdmin(){
  if (adminUnlocked) return true;
  const pw = prompt("관리자 비밀번호를 입력하세요:");
  if (pw === null) return false;
  if (pw === ADMIN_PW){ adminUnlocked = true; return true; }
  setStatus("관리자 비밀번호가 틀렸습니다", "err");
  return false;
}
$("settingsBtn").onclick = () => { if (requireAdmin()) openSettings(); };
$("sourceSel").value = cfg.source;
$("sourceSel").onchange = () => { cfg.source = $("sourceSel").value; localStorage.setItem("tr_source", cfg.source); };
$("spkBtn").onclick = ()=>{ const p=$("spkPanel"); p.hidden=!p.hidden; };
$("spkAddBtn").onclick = ()=>{ $("spkPanel").hidden=false; ensureManualRow("", "미지정"); };
$("settingsClose").onclick = ()=> $("settingsModal").hidden=true;
chipPick("costPreset","cost");
$("settingsSave").onclick = ()=>{
  cfg.soniox=$("sonioxKey").value.trim(); cfg.anthropic=$("anthropicKey").value.trim();
  cfg.title=$("meetingTitle").value.trim();
  cfg.cost=($("costPreset").querySelector(".active")||{}).dataset?.cost||cfg.cost;
  cfg.record=$("recordChk").checked;
  localStorage.setItem("tr_soniox",cfg.soniox); localStorage.setItem("tr_anthropic",cfg.anthropic);
  localStorage.setItem("tr_title",cfg.title);
  localStorage.setItem("tr_cost",cfg.cost);
  localStorage.setItem("tr_record",cfg.record?"1":"0");
  buildPrompts();
  $("settingsModal").hidden=true; setStatus("설정 저장됨","");
};
$("themeBtn").onclick = ()=>{ const d=document.documentElement.getAttribute("data-theme")==="dark";
  if(d){document.documentElement.removeAttribute("data-theme");localStorage.setItem("smrhub-theme","light");}
  else{document.documentElement.setAttribute("data-theme","dark");localStorage.setItem("smrhub-theme","dark");} };

applyFont();
loadData();
// (개발 전용) ?dev=1 로 열었을 때만 시뮬레이션 훅 노출 — 팀 배포본에선 비노출
if (new URLSearchParams(location.search).has("dev")) window.__simSentence = onSentence;
