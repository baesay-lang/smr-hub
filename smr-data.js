/* ============================================================
   SMR HUB — single source of truth for developer/project FACTS
   (stage, tracks, projects, milestones, map coords)

   Consumed by:
   - SMR-timeline.html  (lanes = SMR_PROJECTS, uses ms[])
   - SMR-map.html       (markers = SMR_PROJECTS with .map coords)
   - SMR-developers.html(cards' mini-pipe/stage-label synced from SMR_DEVS)

   ★ 단계·마일스톤이 바뀌면 이 파일만 고치면 맵·연표·개발사 카드가
     함께 갱신됨. (개발사 카드의 서술형 '인허가 상황' 본문과
     인허가 트랙 페이지의 트랙별 배지는 수동 관리 — 뉘앙스가 트랙별로
     달라 자동화 제외)

   stage: 1 사전협의·설계 / 2 설계심사·인증 / 3 건설허가 심사 /
          4 건설허가 발급 / 5 건설 중 / 6 가동
   track (timeline filter): nrc50 | nrc52 | intl | kr | pre
   map.trk (map filter):    p50 | p52 | cnsc | pre
   ms[].s: done | target | neg      ms[].t: 소수 연도 (2026-03 → 2026.2)
   ============================================================ */

/* ---- 개발사 레벨 (13개사): 카드 단계 칩의 단일 소스 ---- */
window.SMR_DEVS = {
  gehitachi:    { name:'GE Hitachi',      stage:5, label:'5 · 건설 중' },
  terrapower:   { name:'TerraPower',      stage:5, label:'5 · 건설 중' },
  kairos:       { name:'Kairos Power',    stage:5, label:'5 · 실증로 건설 중' },
  xenergy:      { name:'X-energy',        stage:3, label:'3 · 건설허가 심사' },
  holtec:       { name:'Holtec',          stage:3, label:'3 · 건설허가 심사' },
  nuscale:      { name:'NuScale',         stage:2, label:'2 · 설계인증 완료' },
  rollsroyce:   { name:'Rolls-Royce',     stage:2, label:'2 · 설계심사(GDA) 최종' },
  oklo:         { name:'Oklo',            stage:2, label:'2 · COL 재도전' },
  arc:          { name:'ARC-100',         stage:2, label:'2 · 설계심사(VDR) 완료' },
  smart:        { name:'SMART100',        stage:2, label:'2 · 표준설계인가 완료' },
  westinghouse: { name:'Westinghouse',    stage:1, label:'1 · 사전협의' },
  ismr:         { name:'i-SMR',           stage:2, label:'2 · 표준설계인가 심사' },
  seaborg:      { name:'Seaborg',         stage:1, label:'1 · 개념·초기 R&D' }
};

/* ---- 프로젝트 레벨 (16레인, 개발사당 최대 2) ----
   공통: dev(표시명) id(개발사 anchor) proj cc type stage track ms[]
   맵 마커가 있는 프로젝트만 map:{pid,name,loc,trk,x,y,lx,ly,sum} 보유 */
window.SMR_PROJECTS = [
  { dev:'GE Hitachi', id:'gehitachi', proj:'Darlington (OPG)', cc:'CA', type:'BWR', stage:5, track:'intl',
    map:{ pid:'darlington', name:'BWRX-300 — Darlington (OPG)', loc:'온타리오, 캐나다', trk:'cnsc', x:752, y:156, lx:8, ly:-8,
      sum:'<b>북미 최초 상용 SMR 건설.</b> OPG Darlington 신규원전 부지에 BWRX-300 1호기 핵 콘크리트 타설·건설 중. CNSC 건설허가 보유.' },
    ms:[
      { t:2025.27, code:'건설허가', full:'캐나다 CNSC 건설허가(LTC) 발급 (2025.4) — 핵 콘크리트 타설·건설 착수', s:'done' },
      { t:2026.15, code:'굴착완료', full:'1호기 수직갱(shaft) 굴착 완료 (2026 초) — 원자로 건물 기초 공사 진행', s:'done' },
      { t:2030.92, code:'가동', full:'Darlington 1호기 완공 목표 (2030년말)', s:'target' } ] },

  { dev:'GE Hitachi', id:'gehitachi', proj:'Clinch River (TVA)', cc:'US', type:'BWR', stage:3, track:'nrc50',
    map:{ pid:'clinch', name:'BWRX-300 — TVA Clinch River', loc:'오크리지, 테네시', trk:'p50', x:655, y:316, lx:-6, ly:-10,
      sum:'TVA가 Clinch River 부지에 BWRX-300 건설허가(CP) 신청 — NRC 심사 중(~2026.12 목표). 미국 내 첫 BWRX-300.' },
    ms:[
      { t:2025.6, code:'CP신청', full:'미국 TVA Clinch River, Part 50 건설허가(CP) 신청·도케팅 (2025)', s:'done' },
      { t:2026.95, code:'심사', full:'CP 심사 완료 목표 (~2026.12)', s:'target' } ] },

  { dev:'Kairos Power', id:'kairos', proj:'Hermes (Oak Ridge)', cc:'US', type:'FHR', stage:5, track:'nrc50',
    map:{ pid:'hermes', name:'Hermes 실증로 — Oak Ridge', loc:'오크리지, 테네시', trk:'p50', x:668, y:336, lx:10, ly:12,
      sum:'불소염 냉각 고온로(FHR). Hermes 실증로 건설 중 + <b>Hermes 2 발전로 착공(2026.4)</b> — 단계적 실증(Hermes→Hermes 2) 전략. 구글·TVA 공급.' },
    ms:[
      { t:2023.7, code:'CP발급', full:'Hermes 실증로 Part 50 건설허가 발급 (2023) — 첫 비경수로 CP', s:'done' },
      { t:2025.4, code:'건설', full:'Oak Ridge에서 Hermes 실증로 건설 진행', s:'done' },
      { t:2026.30, code:'H2 착공', full:'Hermes 2 기공식·착공 (2026.4) — Google·TVA 공급, 첫 상업급 Gen IV 발전로 건설', s:'done' } ] },

  { dev:'TerraPower', id:'terrapower', proj:'Natrium (Kemmerer)', cc:'US', type:'SFR', stage:5, track:'nrc50',
    map:{ pid:'natrium', name:'Natrium — Kemmerer', loc:'케머러, 와이오밍', trk:'p50', x:264, y:204, lx:10, ly:4,
      sum:'소듐냉각 고속로(SFR)+용융염 저장(345MWe). 석탄화력 부지 전환. 건설허가 발급(2026.3) → <b>2026.4 본격 착공</b> — 미국 첫 상업용 비경수로 건설.' },
    ms:[
      { t:2024.17, code:'CP신청', full:'Natrium Part 50 건설허가(CP) 신청 (2024.3)', s:'done' },
      { t:2026.2, code:'CP발급', full:'건설허가(CP) 발급 (2026.3) — 첫 상업용 비경수로 CP', s:'done' },
      { t:2026.31, code:'착공', full:'Kemmerer 1호기 본격 착공 (2026.4) — 미국 첫 상업용(유틸리티급) 비경수로 건설 개시', s:'done' },
      { t:2028.0, code:'OL·FID', full:'운영허가(OL) 신청·최종투자결정(FID) 예정 (2028 전후)', s:'target' } ] },

  { dev:'X-energy', id:'xenergy', link:'SMR-dev-xenergy.html', proj:'Dow · Long Mott', cc:'US', type:'HTGR', stage:3, track:'nrc50',
    map:{ pid:'longmott', name:'Xe-100 — Long Mott (Dow)', loc:'시드리프트, 텍사스', trk:'p50', x:474, y:472, lx:10, ly:4,
      sum:'Dow 화학공장(UCC Seadrift)에 Xe-100 4기 — <b>산업 공정열+전력</b> 동시 공급. <b>환경평가(EA)·FONSI 완료(2026.5)</b>, CP ~2026말 발급 가능. 첫 산업용 HTGR.' },
    ms:[
      { t:2025.4, code:'CP신청', full:'Dow Long Mott(Seadrift, TX) Part 50 건설허가 신청·도케팅 (2025)', s:'done' },
      { t:2026.38, code:'환경평가', full:'NRC 환경평가(EA)·FONSI 발표 (2026.5) — 일정 단축으로 조기 완료', s:'done' },
      { t:2026.95, code:'CP발급', full:'건설허가(CP) 발급 목표 (~2026말, NRC 단축 심사)', s:'target' },
      { t:2030.0, code:'가동', full:'Dow Seadrift 가동 목표 (2030 전후)', s:'target' } ] },

  { dev:'X-energy', id:'xenergy', link:'SMR-dev-xenergy.html', proj:'Energy Northwest', cc:'US', type:'HTGR', stage:1, track:'pre',
    map:{ pid:'richland', name:'Xe-100 — Energy Northwest', loc:'리치랜드, 워싱턴', trk:'pre', x:132, y:114, lx:10, ly:-6,
      sum:'Amazon 투자 기반 — Energy Northwest 부지에 Xe-100 최대 12기 계획. NRC 신청 전 <b>사전협의·부지작업 단계</b>.' },
    ms:[
      { t:2024.8, code:'사전협의', full:'Energy Northwest(WA) 부지 — Amazon 투자 기반 사전협의·부지작업 (2024)', s:'done' },
      { t:2031.0, code:'가동', full:'Xe-100 최대 12기 가동 목표 (2030년대 초)', s:'target' } ] },

  { dev:'Holtec', id:'holtec', proj:'Palisades · Pioneer', cc:'US', type:'PWR', stage:3, track:'nrc50',
    map:{ pid:'palisades', name:'SMR-300 — Palisades', loc:'코버트, 미시간', trk:'p50', x:626, y:200, lx:-6, ly:-10,
      sum:'재가동한 Palisades 원전 부지 인접에 SMR-300 2기 추진. CP 접수(2026.2) — 기존 원전 부지 활용 전략.' },
    ms:[
      { t:2026.12, code:'CP접수', full:'Palisades Pioneer 1&2 건설허가(CP) 접수 (2026.2)', s:'done' },
      { t:2027.4, code:'심사', full:'안전·환경평가 완료 목표 (2027 상반기)', s:'target' },
      { t:2030.0, code:'가동', full:'SMR-300 가동 목표 (2030)', s:'target' } ] },

  { dev:'NuScale', id:'nuscale', proj:'VOYGR · US600/460', cc:'US', type:'PWR', stage:2, track:'nrc52',
    ms:[
      { t:2023.05, code:'DC', full:'US600 설계인증(DC) 취득 (2023) — 첫 SMR 설계인증', s:'done' },
      { t:2025.4, code:'SDA', full:'출력증강 US460(77MWe×6) 표준설계승인(SDA) 발급 (2025.5)', s:'done' } ] },

  { dev:'Rolls-Royce', id:'rollsroyce', proj:'UK SMR · Wylfa', cc:'UK', type:'PWR', stage:2, track:'intl',
    ms:[
      { t:2025.5, code:'GBE-N', full:'Great British Energy-Nuclear 우선 기술 선정, 부지 Wylfa', s:'done' },
      { t:2026.28, code:'건설계약', full:'영국 정부–Rolls-Royce SMR, Wylfa 3기 건설 계약 체결 (2026.4) — 즉시 착수', s:'done' },
      { t:2026.6, code:'GDA완료', full:'영국 GDA Step 3 완료 예정 (2026.8)', s:'target' } ] },

  { dev:'Oklo', id:'oklo', proj:'Aurora (INL)', cc:'US', type:'SFR', stage:2, track:'nrc52',
    map:{ pid:'aurora', name:'Aurora — INL', loc:'아이다호 국립연구소', trk:'p52', x:229, y:170, lx:10, ly:-6,
      sum:'소듐냉각 고속로(75MWe, EBR-II 계열). 2022년 COLA 기각 후 <b>단계형 재신청</b> 진행 — Part 52 경로.' },
    ms:[
      { t:2022.05, code:'기각', full:'첫 COLA 기각 (2022.1, without prejudice)', s:'neg' },
      { t:2025.5, code:'재도전', full:'단계형 COLA 재도전 — NRC readiness 평가 완료, INL', s:'done' },
      { t:2026.38, code:'PDC승인', full:'NRC 주요설계기준(PDC) 토픽보고서 승인 (2026.5) — Aurora 인허가 경로 확정', s:'done' } ] },

  { dev:'ARC-100', id:'arc', proj:'Point Lepreau', cc:'CA', type:'SFR', stage:2, track:'intl',
    ms:[
      { t:2025.5, code:'VDR완료', full:'CNSC 벤더설계심사(VDR) Phase 2 완료 (2025.7)', s:'done' },
      { t:2027.0, code:'건설허가', full:'건설허가(LTC) 신청 목표 (2027)', s:'target' },
      { t:2030.6, code:'가동', full:'1호기 가동 목표 (2030년대 초)', s:'target' } ] },

  { dev:'SMART100', id:'smart', proj:'SMART100 (원조 2012)', cc:'KR', type:'PWR', stage:2, track:'kr',
    ms:[
      { t:2024.7, code:'SDA', full:'SMART100 표준설계인가 취득 (2024.9) · SMART 원조 SDA는 2012(세계 최초)', s:'done' } ] },

  { dev:'Westinghouse', id:'westinghouse', proj:'AP300', cc:'US', type:'PWR', stage:1, track:'nrc52',
    ms:[
      { t:2023.4, code:'규제plan', full:'AP300 규제 engagement plan 제출 (2023.5)', s:'done' },
      { t:2027.0, code:'DC', full:'AP300 설계인증(DC) 목표 (2027)', s:'target' } ] },

  { dev:'Westinghouse', id:'westinghouse', proj:'eVinci (마이크로)', cc:'US', type:'Micro', stage:1, track:'pre',
    ms:[
      { t:2024.92, code:'I&C', full:'eVinci 계측제어(I&C) 플랫폼 승인 (2024.12)', s:'done' },
      { t:2025.3, code:'설계기준', full:'eVinci 주요설계기준 토픽보고서 승인 (2025.4)', s:'done' } ] },

  { dev:'i-SMR', id:'ismr', proj:'혁신형 i-SMR', cc:'KR', type:'PWR', stage:2, track:'kr',
    ms:[
      { t:2023.5, code:'출범', full:'국책 혁신형 i-SMR 개발사업 출범 (2023)', s:'done' },
      { t:2026.15, code:'SDA신청', full:'표준설계인가(SDA) 공식 신청 (2026.2.27) — 170MWe×4 = 680MWe, 원안위 심사 착수', s:'done' },
      { t:2028.0, code:'SDA', full:'표준설계인가(SDA) 취득 목표 (2028)', s:'target' } ] },

  { dev:'Seaborg', id:'seaborg', proj:'CMSR · 부유식', cc:'DK', type:'MSR', stage:1, track:'intl',
    ms:[
      { t:2026.0, code:'(구)시제', full:'(구)상용 프로토타입 목표 2026 — 연기됨. HALEU 수급 리스크로 LEU·흑연 감속 설계로 변경', s:'target' },
      { t:2031.7, code:'운전', full:'첫 원자로 2030년대 초반 목표로 연기 (CEO 공표) — Power Barge 시리즈 생산은 2030년대 중반', s:'target' } ] }
];
