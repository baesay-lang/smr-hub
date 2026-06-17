/* ============================================================
   SMR HUB — shared UI: dark-mode toggle + mobile hamburger nav
   Injected into every page's <nav class="topnav">. Pure front-end.
   Theme is pre-applied by a tiny inline <head> snippet (no FOUC);
   this file adds the toggle buttons and wires the menu.
   Persists choice in localStorage('smrhub-theme'); falls back to
   prefers-color-scheme when unset.
   ============================================================ */
(function () {
  var DOC = document.documentElement;
  var KEY = 'smrhub-theme';

  var MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
  var SUN  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  var BARS  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>';
  var CLOSE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  function isDark() { return DOC.getAttribute('data-theme') === 'dark'; }

  function init() {
    var nav = document.querySelector('.topnav');
    if (!nav || nav.querySelector('.theme-toggle')) return;

    // ---- theme toggle ----
    var tbtn = document.createElement('button');
    tbtn.className = 'theme-toggle';
    tbtn.type = 'button';
    function paintTheme() {
      tbtn.innerHTML = isDark() ? SUN : MOON;
      var label = isDark() ? '라이트 모드로 전환' : '다크 모드로 전환';
      tbtn.setAttribute('aria-label', label);
      tbtn.title = label;
      tbtn.setAttribute('aria-pressed', isDark() ? 'true' : 'false');
    }
    paintTheme();
    tbtn.addEventListener('click', function () {
      var next = isDark() ? 'light' : 'dark';
      if (next === 'dark') DOC.setAttribute('data-theme', 'dark');
      else DOC.removeAttribute('data-theme');
      try { localStorage.setItem(KEY, next); } catch (e) {}
      paintTheme();
    });

    // ---- hamburger ----
    var hbtn = document.createElement('button');
    hbtn.className = 'nav-toggle';
    hbtn.type = 'button';
    hbtn.setAttribute('aria-label', '메뉴 열기/닫기');
    hbtn.setAttribute('aria-expanded', 'false');
    hbtn.innerHTML = BARS;
    function setOpen(open) {
      nav.classList.toggle('nav-open', open);
      hbtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      hbtn.innerHTML = open ? CLOSE : BARS;
    }
    hbtn.addEventListener('click', function (e) {
      e.stopPropagation();
      setOpen(!nav.classList.contains('nav-open'));
    });

    nav.appendChild(tbtn);
    nav.appendChild(hbtn);

    // close menu after picking a link, on outside click, or Esc
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a') && nav.classList.contains('nav-open')) setOpen(false);
    });
    document.addEventListener('click', function (e) {
      if (nav.classList.contains('nav-open') && !nav.contains(e.target)) setOpen(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('nav-open')) setOpen(false);
    });

    // keep system-theme changes live only while the user hasn't chosen explicitly
    try {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener('change', function (e) {
        var saved = null;
        try { saved = localStorage.getItem(KEY); } catch (x) {}
        if (saved) return;
        if (e.matches) DOC.setAttribute('data-theme', 'dark');
        else DOC.removeAttribute('data-theme');
        paintTheme();
      });
    } catch (e) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
