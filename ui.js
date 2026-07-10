/* ============================================================
   SMR HUB — shared UI (single source of truth)
   - Builds the grouped top navigation (대표군 dropdowns) into <nav class="topnav">
   - Dark-mode toggle (persists in localStorage 'smrhub-theme')
   - Mobile hamburger
   Edit the GROUPS array below to add/rename/reorder nav — one place, all pages.
   Pages ship an (empty) <nav class="topnav"> that this script fills; a <noscript>
   brand link is the no-JS fallback.
   ============================================================ */
(function () {
  var DOC = document.documentElement;
  var KEY = 'smrhub-theme';

  // ---- single source of truth for navigation ----
  var BRAND = { t: 'SMR HUB', href: 'index.html' };
  var GROUPS = [
    { label: '현황', items: [
      { t: '뉴스', href: 'SMR-news.html' },
      { t: '프로젝트 맵', href: 'SMR-map.html' },
      { t: '개발 연표', href: 'SMR-timeline.html' } ] },
    { label: '기술', items: [
      { t: '개발사', href: 'SMR-developers.html' },
      { t: '노형 분류', href: 'SMR-reactor-types.html' },
      { t: '카탈로그', href: 'SMR-catalogue.html' },
      { t: '세계 원전 DB', href: 'SMR-npp-db.html' },
      { t: '연료 공급망', href: 'SMR-fuel-supply.html' } ],
      /* deep: 홈 바로가기 카드에만 노출되는 심화 페이지 (nav 드롭다운에는 안 나옴) */
      deep: [
      { t: 'X-energy / Xe-100 상세', href: 'SMR-dev-xenergy.html' },
      { t: 'HTGR 역사 · 발표 덱', href: 'SMR-htgr-history.html' } ] },
    { label: '규제', items: [
      { t: '인허가 트랙', href: 'SMR-licensing-tracks.html' },
      { t: 'CFR 레퍼런스', href: 'SMR-reference.html' } ] },
    { label: '사업·한국', items: [
      { t: '사업 구조', href: 'SMR-asia-structure.html' },
      { t: '한국 기업', href: 'SMR-korea-players.html' } ] },
    { label: '도구', items: [
      { t: '실시간 번역 🔒', href: 'translator/index.html' },
      { t: 'LCOE 계산기', href: 'LCOE_Calculator.html' },
      { t: '용어집', href: 'SMR-glossary.html' } ] }
  ];

  // ---- site-wide "데이터 기준" stamp (footer에 자동 삽입) ----
  // 대규모 사실 갱신(단계·마일스톤 검증) 후 이 날짜를 올릴 것
  var ASOF = '2026-07';

  function currentFile() { return (location.pathname.split('/').pop() || 'index.html'); }
  // returns {g: groupIndex, item: href} for the active page, or null
  function activeFor(file) {
    for (var i = 0; i < GROUPS.length; i++)
      for (var j = 0; j < GROUPS[i].items.length; j++)
        if (GROUPS[i].items[j].href === file) return { g: i, item: file };
    // detail/aux pages → highlight the 기술 group, anchored to 개발사
    if (/^SMR-dev-/.test(file) || /^SMR-htgr/.test(file)) return { g: 1, item: 'SMR-developers.html' };
    return null;
  }

  var MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
  var SUN  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  var BARS  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>';
  var CLOSE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  var CHEV  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';

  function isDark() { return DOC.getAttribute('data-theme') === 'dark'; }

  function build(nav) {
    var file = currentFile();
    var active = activeFor(file);

    nav.innerHTML = '';
    nav.classList.add('topnav-grouped');

    // brand
    var brand = document.createElement('a');
    brand.className = 'brand'; brand.href = BRAND.href; brand.textContent = BRAND.t;
    nav.appendChild(brand);

    // grouped links
    var wrap = document.createElement('div'); wrap.className = 'nav-groups';
    GROUPS.forEach(function (grp, gi) {
      var g = document.createElement('div'); g.className = 'nav-group';
      if (active && active.g === gi) g.classList.add('active');
      var btn = document.createElement('button');
      btn.className = 'nav-gbtn'; btn.type = 'button';
      btn.setAttribute('aria-haspopup', 'true'); btn.setAttribute('aria-expanded', 'false');
      btn.innerHTML = grp.label + ' <span class="nav-chev" aria-hidden="true">' + CHEV + '</span>';
      var menu = document.createElement('div'); menu.className = 'nav-menu';
      grp.items.forEach(function (it) {
        var a = document.createElement('a'); a.href = it.href; a.textContent = it.t;
        if (active && active.item === it.href) a.className = 'cur';
        menu.appendChild(a);
      });
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var wasOpen = g.classList.contains('open');
        closeGroups();
        if (!wasOpen) { g.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); }
      });
      g.appendChild(btn); g.appendChild(menu);
      wrap.appendChild(g);
    });
    nav.appendChild(wrap);

    function closeGroups() {
      Array.prototype.forEach.call(nav.querySelectorAll('.nav-group.open'), function (x) {
        x.classList.remove('open');
        var b = x.querySelector('.nav-gbtn'); if (b) b.setAttribute('aria-expanded', 'false');
      });
    }

    // theme toggle
    var tbtn = document.createElement('button'); tbtn.className = 'theme-toggle'; tbtn.type = 'button';
    function paintTheme() {
      tbtn.innerHTML = isDark() ? SUN : MOON;
      var l = isDark() ? '라이트 모드로 전환' : '다크 모드로 전환';
      tbtn.setAttribute('aria-label', l); tbtn.title = l; tbtn.setAttribute('aria-pressed', isDark() ? 'true' : 'false');
    }
    paintTheme();
    tbtn.addEventListener('click', function () {
      var next = isDark() ? 'light' : 'dark';
      if (next === 'dark') DOC.setAttribute('data-theme', 'dark'); else DOC.removeAttribute('data-theme');
      try { localStorage.setItem(KEY, next); } catch (e) {}
      paintTheme();
    });
    nav.appendChild(tbtn);

    // hamburger
    var hbtn = document.createElement('button'); hbtn.className = 'nav-toggle'; hbtn.type = 'button';
    hbtn.setAttribute('aria-label', '메뉴 열기/닫기'); hbtn.setAttribute('aria-expanded', 'false'); hbtn.innerHTML = BARS;
    function setOpen(open) {
      nav.classList.toggle('nav-open', open);
      hbtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      hbtn.innerHTML = open ? CLOSE : BARS;
      if (!open) closeGroups();
    }
    hbtn.addEventListener('click', function (e) { e.stopPropagation(); setOpen(!nav.classList.contains('nav-open')); });
    nav.appendChild(hbtn);

    // close on link pick / outside / Esc
    nav.addEventListener('click', function (e) { if (e.target.closest('.nav-menu a')) setOpen(false); });
    document.addEventListener('click', function (e) {
      if (!nav.contains(e.target)) { closeGroups(); if (nav.classList.contains('nav-open')) setOpen(false); }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { closeGroups(); if (nav.classList.contains('nav-open')) setOpen(false); }
    });

    // live system-theme changes (only while user hasn't chosen explicitly)
    try {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener('change', function (e) {
        var s = null; try { s = localStorage.getItem(KEY); } catch (x) {}
        if (s) return;
        if (e.matches) DOC.setAttribute('data-theme', 'dark'); else DOC.removeAttribute('data-theme');
        paintTheme();
      });
    } catch (e) {}
  }

  // 홈 '바로가기' — nav와 같은 GROUPS에서 5개 대표군 카드를 생성 (#homeGroups가 있는 페이지만)
  function buildHomeTiles() {
    var host = document.getElementById('homeGroups');
    if (!host || host.getAttribute('data-built')) return;
    host.setAttribute('data-built', '1');
    var html = '';
    GROUPS.forEach(function (g) {
      html += '<div class="gtile"><div class="gt-h">' + g.label + '</div>';
      g.items.forEach(function (it) { html += '<a href="' + it.href + '">' + it.t + '</a>'; });
      (g.deep || []).forEach(function (it) { html += '<a class="gt-deep" href="' + it.href + '">' + it.t + ' <span aria-hidden="true">↳</span></a>'; });
      html += '</div>';
    });
    host.innerHTML = html;
  }

  // footer 하단에 표준 스탬프 한 줄 삽입 (모든 페이지 공통 — '살아있는 사이트' 신호)
  function stampFooter() {
    var f = document.querySelector('footer');
    if (!f || f.querySelector('.site-stamp')) return;
    var d = document.createElement('div');
    d.className = 'site-stamp';
    d.style.cssText = 'margin-top:10px;padding-top:9px;border-top:1px solid var(--border);font-size:11px;color:var(--text-faint);';
    var txt = 'SMR HUB · 데이터 기준 ' + ASOF + ' · 공개 출처 검증';
    if (window.SMR_UPDATED) txt += ' · 뉴스 자동수집 ' + window.SMR_UPDATED;
    d.textContent = txt;
    f.appendChild(d);
  }

  function init() {
    var nav = document.querySelector('.topnav');
    if (!nav || nav.getAttribute('data-built')) return;
    nav.setAttribute('data-built', '1');
    build(nav);
    buildHomeTiles();
    stampFooter();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
