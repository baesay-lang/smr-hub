/* ============================================================
   SMR Hub — news detail modal (shared by index.html + SMR-news.html)
   Click a news item → modal shows the stored Korean summary + tags +
   "원문 보기 ↗" link. Pure front-end: uses data already in news-data.js,
   so it costs ZERO API (summaries are generated once at collection time).
   Usage: include after news-data.js, then call window.openNewsModal(item).
   ============================================================ */
(function () {
  var KEY = { '인허가': 1, '계약': 1 };
  function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }

  var css =
    '#nm-ov{position:fixed;inset:0;z-index:2147483300;background:rgba(15,23,42,.55);backdrop-filter:blur(3px);'
    +'display:flex;align-items:center;justify-content:center;padding:20px;}'
    +'#nm-ov[hidden]{display:none;}'
    +'#nm-card{position:relative;background:var(--surface,#fff);border:1px solid var(--border,#e5e8ee);'
    +'border-radius:var(--radius,12px);box-shadow:0 18px 50px rgba(15,23,42,.28);width:100%;max-width:580px;'
    +'max-height:85vh;overflow:auto;padding:24px 26px 22px;'
    +'font-family:"Pretendard",-apple-system,"Segoe UI","Malgun Gothic",sans-serif;}'
    +'#nm-x{position:absolute;top:11px;right:13px;background:none;border:none;font-size:24px;line-height:1;'
    +'color:var(--text-faint,#8b93a2);cursor:pointer;padding:2px 6px;}'
    +'#nm-x:hover{color:var(--text,#1a2230);}'
    +'.nm-date{font-size:12.5px;font-weight:700;color:var(--accent,#2563eb);font-variant-numeric:tabular-nums;}'
    +'.nm-title{font-size:20px;font-weight:700;line-height:1.38;margin:6px 0 10px;color:var(--text,#1a2230);padding-right:24px;}'
    +'.nm-tags{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;}'
    +'.nm-tags .tg{font-size:11px;font-weight:700;padding:3px 9px;border-radius:5px;background:var(--surface-2,#f1f3f7);'
    +'color:var(--text-dim,#5a6473);border:1px solid var(--border,#e5e8ee);}'
    +'.nm-tags .tg.key{background:var(--accent-weak,#eef3ff);color:var(--accent-strong,#1d4ed8);border-color:var(--accent-weak-2,#d7e3fe);}'
    +'.nm-sum{font-size:14.5px;line-height:1.75;color:var(--text,#1a2230);white-space:pre-line;}'
    +'.nm-src{font-size:12px;color:var(--text-faint,#8b93a2);margin-top:14px;}'
    +'.nm-actions{display:flex;gap:9px;margin-top:18px;}'
    +'.nm-btn{display:inline-flex;align-items:center;justify-content:center;font:600 14px/1 inherit;padding:11px 16px;'
    +'border-radius:8px;cursor:pointer;text-decoration:none;border:1px solid transparent;}'
    +'a.nm-btn{background:var(--accent,#2563eb);color:#fff;flex:1;}'
    +'a.nm-btn:hover{background:var(--accent-strong,#1d4ed8);}'
    +'.nm-btn.ghost{background:var(--surface,#fff);color:var(--text-dim,#5a6473);border-color:var(--border-strong,#d2d7e0);}'
    +'.nm-btn.ghost:hover{background:var(--surface-2,#f1f3f7);}'
    +'@media(max-width:520px){#nm-card{padding:20px 18px;}.nm-title{font-size:18px;}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var ov = document.createElement('div'); ov.id = 'nm-ov'; ov.hidden = true;
  ov.innerHTML =
    '<div id="nm-card" role="dialog" aria-modal="true" aria-label="뉴스 상세">'
    + '<button id="nm-x" aria-label="닫기">&times;</button>'
    + '<div class="nm-date" id="nm-date"></div>'
    + '<div class="nm-title" id="nm-title"></div>'
    + '<div class="nm-tags" id="nm-tags"></div>'
    + '<div class="nm-sum" id="nm-sum"></div>'
    + '<div class="nm-src" id="nm-src"></div>'
    + '<div class="nm-actions">'
    +   '<a id="nm-link" class="nm-btn" target="_blank" rel="noopener">원문 보기 ↗</a>'
    +   '<button id="nm-close" class="nm-btn ghost">닫기</button>'
    + '</div>'
    + '</div>';
  document.body.appendChild(ov);

  var $ = function(id){ return document.getElementById(id); };
  var elDate=$('nm-date'), elTitle=$('nm-title'), elTags=$('nm-tags'),
      elSum=$('nm-sum'), elSrc=$('nm-src'), elLink=$('nm-link');

  function tagHTML(n){
    var h = '<span class="tg'+(KEY[n.cat]?' key':'')+'">'+esc(n.cat)+'</span>';
    if (n.type && n.type !== 'General') h += '<span class="tg">'+esc(n.type)+'</span>';
    if (n.dev) h += '<span class="tg">'+esc(n.dev)+'</span>';
    if (n.region) h += '<span class="tg">'+esc(n.region)+'</span>';
    return h;
  }

  function open(n){
    if (!n) return;
    elDate.textContent = n.date || '';
    elTitle.textContent = n.title || '';
    elTags.innerHTML = tagHTML(n);
    elSum.textContent = (n.summaryLong || n.summary || '').trim() || '요약이 아직 없습니다.';
    elSrc.textContent = n.source ? ('출처 · ' + n.source) : '';
    if (n.url){ elLink.href = n.url; elLink.style.display = ''; } else { elLink.removeAttribute('href'); elLink.style.display = 'none'; }
    ov.hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function close(){ ov.hidden = true; document.body.style.overflow = ''; }

  $('nm-x').addEventListener('click', close);
  $('nm-close').addEventListener('click', close);
  ov.addEventListener('click', function(e){ if (e.target === ov) close(); });
  document.addEventListener('keydown', function(e){ if (e.key === 'Escape' && !ov.hidden) close(); });

  window.openNewsModal = open;
})();
