/* ============================================================
   SMR News data — single source for SMR-news.html
   Auto-tracking (GitHub Actions, phase 2) will regenerate THIS file.
   Schema per item:
     date   : "YYYY-MM-DD" | "YYYY-MM" | "YYYY"
     title  : string (KR)
     summary: string (KR)
     cat    : 인허가 | 계약 | 투자 | 기술 | 정책      (인허가·계약 = 주요)
     type   : General | PWR | BWR | SFR | HTGR | FHR | MSR | Micro
     dev    : developer / org (string)
     region : "US" | "KR" | "UK" | "CA" | "DK" | "US·UK" ...
     source : source name
     url    : link (optional, "" if none)
   ============================================================ */
window.SMR_NEWS = [
  { date:"2026-06-04", title:"X-energy 2026년 1분기 실적 — 파이프라인 144기·11.5GWe", summary:"상장(Nasdaq: XE) 후 분기 공시. 미국·영국 합산 144기, 약 11.5 GWe 파이프라인(고객 권리 전량 행사 가정).", cat:"투자", type:"HTGR", dev:"X-energy", region:"US·UK", source:"X-energy IR", url:"https://x-energy.com/news/x-energy-reports-first-quarter-2026-results/" },
  { date:"2026-05", title:"NRC, Dow(Long Mott) Xe-100 환경평가(EA) 완료", summary:"건설허가 신청의 일부로 NRC가 약식 EA 완료 — 상업 첨단로 첫 사례. CP 승인은 2027 Q1 예상.", cat:"인허가", type:"HTGR", dev:"X-energy", region:"US", source:"NRC Long Mott", url:"https://www.nrc.gov/reactors/new-reactors/advanced/who-were-working-with/applicant-projects/long-mott" },
  { date:"2026-04-29", title:"NRC Part 53(첨단로 전용 트랙) 발효", summary:"위험정보·성능기반·기술포괄 신규 인허가 트랙 발효. 현재 신청자 0건 — 향후 비경수로 SMR의 대안 트랙.", cat:"정책", type:"General", dev:"NRC", region:"US", source:"Federal Register 2026-06048", url:"https://www.ecfr.gov" },
  { date:"2026-03", title:"TerraPower Natrium 건설허가(CP) 발급 — 첫 상업 비경수로 CP", summary:"NRC가 와이오밍 Kemmerer Natrium에 건설허가 발급. 40여 년 만의 상업용 Gen-IV/비경수로 CP.", cat:"인허가", type:"SFR", dev:"TerraPower", region:"US", source:"DOE", url:"https://www.energy.gov/ne/articles/nrc-issues-construction-permit-terrapowers-natrium-advanced-reactor" },
  { date:"2026-02", title:"Holtec, Palisades SMR-300(Pioneer) 건설허가 신청 NRC 접수", summary:"미시간 Palisades 부지 쌍둥이 SMR-300 CP 신청 접수. 제한작업승인(LWA) 포함, 안전·환경평가 2027 상반기 목표.", cat:"인허가", type:"PWR", dev:"Holtec", region:"US", source:"ANS", url:"https://www.ans.org/news/article-7673/holtec-submits-partial-construction-permit-application-for-smrs-at-palisades/" },
  { date:"2025-12", title:"NRC, Natrium 안전심사 조기 완료(예산 11% 절감)", summary:"TerraPower Natrium 안전심사를 일정보다 앞서 완료 — 2026.3 CP 발급으로 이어짐.", cat:"인허가", type:"SFR", dev:"TerraPower", region:"US", source:"ANS", url:"https://www.ans.org/news/article-7818/nrc-approves-terrapower-construction-permit/" },
  { date:"2025-11", title:"X-energy, TRISO-X 연료 조사시험 개시 + TX-1 착공", summary:"INL 첨단시험로(ATR) 연료 조사시험 시작, 테네시 Oak Ridge TX-1 연료제조시설 건설 착수.", cat:"기술", type:"HTGR", dev:"X-energy", region:"US", source:"X-energy TRISO-X", url:"https://x-energy.com/triso-x-fuel/" },
  { date:"2025-09", title:"Centrica–X-energy 공동개발협약(JDA) — 영국 6GW, Hartlepool 우선부지", summary:"英 최초 첨단모듈로 배치 JDA. 영국 내 6GW 추진, 1차 부지 Hartlepool, 2026 본격화 목표.", cat:"계약", type:"HTGR", dev:"X-energy", region:"UK", source:"Centrica", url:"https://www.centrica.com/media-centre/news/2025/centrica-and-x-energy-agree-to-deploy-uk-s-first-advanced-modular-reactors/" },
  { date:"2025-08-25", title:"X-energy·Amazon·KHNP·두산에너빌리티 4자 전략적 협력", summary:"AI 인프라용 첨단원자력 확대 — 원자로 설계·공급망·건설·투자·운영·글로벌 공동배치. 한국(KHNP·두산) 공급망 편입.", cat:"계약", type:"HTGR", dev:"X-energy", region:"US·KR", source:"BusinessWire", url:"https://www.businesswire.com/news/home/20250825430061/en/" },
  { date:"2025-08", title:"X-energy, TX-1 연료시설 건설사로 Clark Construction 선정", summary:"테네시 Oak Ridge TX-1 TRISO-X 시설 건설사 선정.", cat:"계약", type:"HTGR", dev:"X-energy", region:"US", source:"X-energy", url:"https://x-energy.com/news-releases" },
  { date:"2025-07", title:"TVA Clinch River BWRX-300, NRC 건설허가 도케팅(17개월 심사)", summary:"미국 첫 BWRX-300 CP 신청 도케팅. ~2026.12 심사 완료 목표.", cat:"인허가", type:"BWR", dev:"GE-Hitachi", region:"US", source:"Federal Register", url:"https://www.federalregister.gov/documents/2025/07/01/2025-11037/tennessee-valley-authority-clinch-river-nuclear-site-construction-permit-application" },
  { date:"2025-07", title:"ARC-100, 캐나다 CNSC 벤더설계심사(VDR) Phase 2 완료", summary:"\"근본적 인허가 장벽 없음\" 판정. NB Power가 부지준비허가 신청, 건설허가 신청 목표 2027.", cat:"인허가", type:"SFR", dev:"ARC", region:"CA", source:"WNN", url:"https://www.world-nuclear-news.org/articles/arc-100-completes-canadian-regulatory-design-review" },
  { date:"2025-05", title:"두산에너빌리티, X-energy 16기분 주기기 예약 + 창원 SMR 공장", summary:"RPV 등 NSSS 주기기 16세트 예약. 11GW 파이프라인 대응 위해 창원 SMR 전용 제작공장 신설 약정.", cat:"계약", type:"HTGR", dev:"두산에너빌리티", region:"KR", source:"POWER", url:"https://www.powermag.com/x-energy-doosan-lock-in-16-unit-xe-100-component-reservation-as-doosan-commits-to-new-smr-factory/" },
  { date:"2025-04", title:"캐나다 OPG, BWRX-300 건설허가 발급·핵 콘크리트 타설(북미 최초)", summary:"CNSC가 OPG Darlington에 건설허가 발급, 원자로건물 기초공사 착수 — 세계 최초 BWRX-300 건설. 운영허가 신청도 제출.", cat:"인허가", type:"BWR", dev:"GE-Hitachi", region:"CA", source:"GE Vernova", url:"https://www.gevernova.com/news/press-releases/ge-vernova-hitachi-bwrx-300-small-modular-reactor-approved-construction-province-ontario-opg" },
  { date:"2025-04", title:"Seaborg→Saltfoss 사명 변경, 초기 연료 LEU로 전환", summary:"덴마크 해상 부유식 용융염로(CMSR) 개발사. HALEU 공급 리스크로 초기 연료를 LEU로(감속재 흑연으로) 변경.", cat:"기술", type:"MSR", dev:"Seaborg/Saltfoss", region:"DK", source:"WNN", url:"https://world-nuclear-news.org/Articles/Seaborg-switches-fuel-plans-due-to-HALEU-supply-is" },
  { date:"2025-04", title:"Westinghouse eVinci, NRC 주요설계기준 토픽보고서 승인", summary:"히트파이프 마이크로로 eVinci 사전협의 마일스톤(앞서 2024.12 I&C 플랫폼 승인 — 첫 마이크로로).", cat:"기술", type:"Micro", dev:"Westinghouse", region:"US", source:"WNN", url:"https://www.world-nuclear-news.org/articles/pre-licensing-milestone-for-evinci" },
  { date:"2025-03", title:"Dow·X-energy, Long Mott Xe-100 건설허가(CP) 신청 제출", summary:"Seadrift(텍사스) 부지 Xe-100 4기 CP 신청 — Dow 화학공장 공정열·전력. 산업체 첫 첨단로 CP 신청.", cat:"인허가", type:"HTGR", dev:"X-energy", region:"US", source:"POWER", url:"https://www.powermag.com/dow-and-x-energy-advance-landmark-nuclear-project-in-texas-with-construction-permit-filing/" },
  { date:"2025", title:"Rolls-Royce SMR, 영국 GBE-N 우선기술 선정 — Wylfa 부지", summary:"Great British Energy-Nuclear 우선협상 기술로 선정, 부지 Wylfa(최대 3기). 2026.4 site-specific 계약.", cat:"계약", type:"PWR", dev:"Rolls-Royce", region:"UK", source:"WNN", url:"https://www.world-nuclear-news.org/articles/rolls-royce-smr-progresses-to-final-step-of-uk-ass" },
  { date:"2025", title:"Rolls-Royce SMR, 영국 GDA 최종단계(Step 3) 진입", summary:"SMR 중 유일하게 GDA 최종단계 도달, ~2026.8 완료 예정(총 53개월).", cat:"인허가", type:"PWR", dev:"Rolls-Royce", region:"UK", source:"Rolls-Royce SMR", url:"https://www.rolls-royce-smr.com/our-progress" },
  { date:"2024-09", title:"SMART100 표준설계인가 취득(한국)", summary:"KAERI SMART100이 한국 표준설계인가 취득. 사우디 수출·현대ENG 협력 추진.", cat:"인허가", type:"PWR", dev:"SMART/KAERI", region:"KR", source:"KAERI", url:"https://kaeri.re.kr/board/view?linkId=12112&menuId=MENU00326" },
  { date:"2024", title:"Amazon, X-energy에 5억 달러 투자 + Energy Northwest 배치", summary:"Amazon Series C-1 약 5억$ 투자, 워싱턴주 Energy Northwest와 Xe-100 배치 합의(데이터센터 전원).", cat:"투자", type:"HTGR", dev:"X-energy", region:"US", source:"X-energy", url:"https://en.wikipedia.org/wiki/X-energy" },
  { date:"2024", title:"Kairos Power–Google, 첨단로 전력공급 계약(PPA) 체결", summary:"Kairos KP-FHR(Hermes 계열) 전력을 구글에 공급하는 PPA — 빅테크 첫 첨단로 전력계약 중 하나.", cat:"계약", type:"FHR", dev:"Kairos Power", region:"US", source:"Kairos Power", url:"" },
  { date:"2023-01", title:"NuScale US600(77MWe) 설계인증(DC) 취득", summary:"NRC 설계인증을 받은 첫 SMR. 이후 출력증강형 US460 표준설계승인(SDA) 추가 심사.", cat:"인허가", type:"PWR", dev:"NuScale", region:"US", source:"Federal Register", url:"https://www.federalregister.gov/documents/2023/01/19/2023-00729/nuscale-small-modular-reactor-design-certification" }
];
