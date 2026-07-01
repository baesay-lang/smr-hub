/* ============================================================
   SMR HUB — news detail modal (shared by all pages)
   Flow: 요약(summary) → 전문(AI 상세해설: 한국어 + English + 용어주석, lazy-loaded
   from articles/<id>.json) → 원문(original link).
   Pure front-end. The 전문 is a transformative AI explainer (NOT a copy of the
   source article) generated at collection time; original is one click away.
   Include after news-data.js, then call window.openNewsModal(item).
   ============================================================ */
(function () {
  var KEY = { '인허가': 1, '계약': 1 };
  function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function paras(txt){ return String(txt||'').split(/\n{2,}|\n/).map(function(p){return p.trim();}).filter(Boolean).map(function(p){ return '<p>'+esc(p)+'</p>'; }).join(''); }

  var css =
    '#nm-ov{position:fixed;inset:0;z-index:2147483300;background:rgba(15,23,42,.55);backdrop-filter:blur(3px);'
    +'display:flex;align-items:center;justify-content:center;padding:20px;}'
    +'#nm-ov[hidden]{display:none;}'
    +'#nm-card{position:relative;background:var(--surface,#fff);border:1px solid var(--border,#e5e8ee);'
    +'border-radius:var(--radius,12px);box-shadow:0 18px 50px rgba(15,23,42,.28);width:100%;max-width:600px;'
    +'max-height:86vh;overflow:auto;padding:24px 26px 22px;'
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
    +'.nm-tags .tg.op{background:#fef2f2;color:#b91c1c;border-color:#fbcaca;}'
    +'#nm-op[hidden]{display:none;}'
    +'.nm-sumlabel,.nm-sec{font-size:10.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--text-faint,#8b93a2);margin:0 0 5px;}'
    +'.nm-sum{font-size:14.5px;line-height:1.75;color:var(--text,#1a2230);white-space:pre-line;}'
    +'.nm-more{margin-top:16px;width:100%;background:var(--surface-2,#f1f3f7);border:1px solid var(--border-strong,#d2d7e0);'
    +'color:var(--accent-strong,#1d4ed8);font:600 13.5px/1 inherit;padding:11px;border-radius:8px;cursor:pointer;}'
    +'.nm-more:hover{background:var(--accent-weak,#eef3ff);border-color:var(--accent,#2563eb);}'
    +'.nm-more[hidden]{display:none;}'
    +'#nm-detail{margin-top:12px;}'
    +'#nm-detail[hidden]{display:none;}'
    +'.nm-sec{margin:16px 0 7px;padding-bottom:4px;border-bottom:1px solid var(--border,#e5e8ee);}'
    +'#nm-detail p{font-size:14px;line-height:1.8;color:var(--text,#1a2230);margin:0 0 10px;}'
    +'#nm-detail .en p{color:var(--text-dim,#5a6473);font-size:13.5px;line-height:1.75;}'
    +'.nm-terms{display:flex;flex-direction:column;gap:8px;}'
    +'.nm-term{font-size:13px;line-height:1.55;color:var(--text-dim,#5a6473);}'
    +'.nm-term b{color:var(--accent-strong,#1d4ed8);font-weight:700;}'
    +'.nm-load{font-size:13px;color:var(--text-faint,#8b93a2);padding:10px 0;}'
    +'.nm-note{font-size:12px;line-height:1.55;color:#92400e;background:#fffbeb;border:1px solid #fae3bf;'
    +'border-radius:7px;padding:8px 11px;margin:2px 0 12px;}'
    +'.nm-note b{color:#92400e;}'
    +'.nm-src{font-size:12px;color:var(--text-faint,#8b93a2);margin-top:16px;}'
    +'.nm-actions{display:flex;gap:9px;margin-top:14px;}'
    +'.nm-btn{display:inline-flex;align-items:center;justify-content:center;font:600 14px/1 inherit;padding:11px 16px;'
    +'border-radius:8px;cursor:pointer;text-decoration:none;border:1px solid transparent;}'
    +'a.nm-btn{background:var(--accent,#2563eb);color:#fff;flex:1;}'
    +'a.nm-btn:hover{background:var(--accent-strong,#1d4ed8);}'
    +'.nm-btn.ghost{background:var(--surface,#fff);color:var(--text-dim,#5a6473);border-color:var(--border-strong,#d2d7e0);}'
    +'.nm-btn.ghost:hover{background:var(--surface-2,#f1f3f7);}'
    +'#nm-share{background:var(--accent-weak,#eef3ff);color:var(--accent-strong,#1d4ed8);border-color:var(--accent-weak-2,#d7e3fe);}'
    +'#nm-share:hover{background:var(--accent,#2563eb);color:#fff;border-color:var(--accent,#2563eb);}'
    +'#nm-toast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:2147483601;'
    +'background:#1a2230;color:#fff;font:600 13px/1.55 "Pretendard",-apple-system,"Segoe UI","Malgun Gothic",sans-serif;'
    +'padding:11px 16px;border-radius:9px;box-shadow:0 6px 22px rgba(0,0,0,.3);max-width:88vw;text-align:center;}'
    +'#nm-toast[hidden]{display:none;}'
    +'@media(max-width:520px){#nm-card{padding:20px 18px;}.nm-title{font-size:18px;}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var ov = document.createElement('div'); ov.id = 'nm-ov'; ov.hidden = true;
  ov.innerHTML =
    '<div id="nm-card" role="dialog" aria-modal="true" aria-label="뉴스 상세">'
    + '<button id="nm-x" aria-label="닫기">&times;</button>'
    + '<div class="nm-date" id="nm-date"></div>'
    + '<div class="nm-title" id="nm-title"></div>'
    + '<div class="nm-tags" id="nm-tags"></div>'
    + '<div class="nm-note" id="nm-op" hidden>ⓘ <b>미확인·추측성 보도</b>입니다 — 공식 확인된 사실이 아닐 수 있으니 원문과 후속 보도를 함께 확인하세요.</div>'
    + '<div class="nm-sumlabel">요약</div>'
    + '<div class="nm-sum" id="nm-sum"></div>'
    + '<button class="nm-more" id="nm-more" hidden>자세히 보기 ▾</button>'
    + '<div id="nm-detail" hidden></div>'
    + '<div class="nm-src" id="nm-src"></div>'
    + '<div class="nm-actions">'
    +   '<a id="nm-link" class="nm-btn" target="_blank" rel="noopener">원문 보기 ↗</a>'
    +   '<button id="nm-copy" class="nm-btn ghost">링크 복사</button>'
    +   '<button id="nm-share" class="nm-btn">메일 공유</button>'
    +   '<button id="nm-close" class="nm-btn ghost">닫기</button>'
    + '</div>'
    + '</div>';
  document.body.appendChild(ov);

  var $ = function(id){ return document.getElementById(id); };
  var elDate=$('nm-date'), elTitle=$('nm-title'), elTags=$('nm-tags'), elSum=$('nm-sum'),
      elSrc=$('nm-src'), elLink=$('nm-link'), moreBtn=$('nm-more'), detailEl=$('nm-detail');

  var cache = {};      // id -> detail object
  var curId = null, curItem = null;
  var lastFocused = null;   // element to restore focus to on close (a11y)

  function tagHTML(n){
    var h = '<span class="tg'+(KEY[n.cat]?' key':'')+'">'+esc(n.cat)+'</span>';
    if (n.type && n.type !== 'General') h += '<span class="tg">'+esc(n.type)+'</span>';
    if (n.dev) h += '<span class="tg">'+esc(n.dev)+'</span>';
    if (n.region) h += '<span class="tg">'+esc(n.region)+'</span>';
    if (n.op) h += '<span class="tg op">추측·미확인</span>';
    return h;
  }

  function termsHtml(terms){
    return terms.map(function(t){ return '<div class="nm-term"><b>'+esc(t.t)+'</b> — '+esc(t.d)+'</div>'; }).join('');
  }
  function isKoreanItem(n){
    if (!n) return false;
    if (n.ko) return true;                                    // source-language flag (Korean outlet) — set by tracker
    if (n.region === 'KR') return true;                       // Korean-topic articles are Korean-language sources
    if (/[가-힣]/.test(n.source||'')) return true;
    var h=''; try { h = new URL(n.url).hostname; } catch(e) { h = String(n.url||''); }
    return /\.kr$/.test(h) || /\.co\.kr/.test(h);
  }
  function fullHtml(d){
    var html = '';
    if (d && d.detailKo) html += '<div class="nm-sec">전문 · 한국어</div>' + paras(d.detailKo);
    if (d && d.detailEn && !isKoreanItem(curItem)) html += '<div class="nm-sec">Full text · English</div><div class="en">' + paras(d.detailEn) + '</div>';
    if (d && d.terms && d.terms.length) html += '<div class="nm-sec">주요 용어</div><div class="nm-terms">' + termsHtml(d.terms) + '</div>';
    return html || '<div class="nm-load">추가 정보가 없습니다.</div>';
  }
  function summaryExtrasHtml(d){
    // summary-only (e.g. Google News): the top 요약 already covers the content; just add the
    // policy notice + glossary (no English version, no duplicate Korean summary).
    var html = '<div class="nm-note">ⓘ 이 기사는 제공처(예: 구글뉴스) 정책상 <b>원문 전문</b>을 싣지 못합니다. 위 <b>요약</b>이 핵심 정리이며, 전체 내용은 아래 <b>원문 보기</b>에서 확인하세요.</div>';
    if (d && d.terms && d.terms.length) html += '<div class="nm-sec">주요 용어</div><div class="nm-terms">' + termsHtml(d.terms) + '</div>';
    return html;
  }
  function applyDetail(id, d){
    if (id !== curId) return;
    if (!d){ detailEl.innerHTML = '<div class="nm-load">추가 정보를 불러오지 못했어요 — 아래 <b>원문 보기</b>를 참고하세요.</div>'; detailEl.hidden = false; moreBtn.hidden = true; return; }
    // use stored grounded flag if present, else fall back to URL (Google News redirect = summary-only)
    var grounded = (typeof d.grounded === 'boolean') ? d.grounded : (((d.url || (curItem && curItem.url) || '').indexOf('news.google')) < 0);
    if (grounded){
      detailEl.innerHTML = fullHtml(d); detailEl.hidden = true;     // full text behind "전문 보기"
      moreBtn.hidden = false; moreBtn.textContent = '전문 보기 ▾';
    } else {
      detailEl.innerHTML = summaryExtrasHtml(d); detailEl.hidden = false;   // shown inline, no button
      moreBtn.hidden = true;
    }
  }
  function loadOnOpen(id){
    if (cache[id]) { applyDetail(id, cache[id]); return; }
    fetch('articles/' + id + '.json', { cache: 'no-cache' })
      .then(function(r){ if(!r.ok) throw 0; return r.json(); })
      .then(function(d){ cache[id] = d; applyDetail(id, d); })
      .catch(function(){ applyDetail(id, null); });
  }

  moreBtn.addEventListener('click', function(){
    var show = detailEl.hidden;
    detailEl.hidden = !show;
    moreBtn.textContent = show ? '접기 ▲' : '전문 보기 ▾';
  });

  function open(n){
    if (!n) return;
    lastFocused = document.activeElement;
    elDate.textContent = n.date || '';
    elTitle.textContent = n.title || '';
    elTags.innerHTML = tagHTML(n);
    var opEl = document.getElementById('nm-op'); if (opEl) opEl.hidden = !n.op;
    elSum.textContent = (n.summaryLong || n.summary || '').trim() || '요약이 아직 없습니다.';
    elSrc.textContent = n.source ? ('출처 · ' + n.source) : '';
    if (n.url){ elLink.href = n.url; elLink.style.display = ''; } else { elLink.removeAttribute('href'); elLink.style.display = 'none'; }
    var copyBtn = document.getElementById('nm-copy'); if (copyBtn) copyBtn.style.display = n.url ? '' : 'none';
    // 전문/요약 영역 — 열 때 상세 JSON을 받아 grounded면 "전문 보기" 버튼, 아니면 안내+용어 인라인 표시
    curItem = n;
    curId = n.id || null;
    detailEl.hidden = true; detailEl.innerHTML = '';
    moreBtn.hidden = true;
    if (curId) loadOnOpen(curId);
    ov.hidden = false;
    document.body.style.overflow = 'hidden';
    if (ov.querySelector('#nm-card')) ov.querySelector('#nm-card').scrollTop = 0;
    var xb = document.getElementById('nm-x'); if (xb) xb.focus();   // move focus into dialog
  }
  function close(){
    ov.hidden = true; document.body.style.overflow = '';
    if (lastFocused && typeof lastFocused.focus === 'function') { try { lastFocused.focus(); } catch (e) {} }
  }

  /* ---- 메일 공유 ---- */
  function buildShare(n){
    var subject = '[기사공유] ' + (n.title || '');
    var body = '안녕하세요,\r\n\r\n'
      + (n.title || '해당') + ' 관련 기사 공유 드립니다.\r\n\r\n'
      + '• 요약:\r\n' + (n.summaryLong || n.summary || '').trim() + '\r\n\r\n'
      + '• 원본: ' + (n.url || '') + '\r\n\r\n감사합니다.\r\n';
    return { subject: subject, body: body };
  }
  function fallbackCopy(t){
    try { var ta=document.createElement('textarea'); ta.value=t; ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); } catch(e){}
  }
  function copyText(t){
    // async writeText can REJECT (e.g. document not focused) — catch it and fall back so the
    // returned promise always resolves (toast must still fire)
    if (navigator.clipboard && navigator.clipboard.writeText){
      return navigator.clipboard.writeText(t).catch(function(){ fallbackCopy(t); });
    }
    fallbackCopy(t); return Promise.resolve();
  }
  var toastEl=null, toastTimer=null;
  function toast(msg){
    if (!toastEl){ toastEl=document.createElement('div'); toastEl.id='nm-toast'; toastEl.hidden=true; document.body.appendChild(toastEl); }
    toastEl.textContent=msg; toastEl.hidden=false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer=setTimeout(function(){ toastEl.hidden=true; }, 5000);
  }
  function share(n){
    if (!n) return;
    var m = buildShare(n);
    copyText(m.subject + '\r\n\r\n' + m.body);   // always copy as a safety net
    var mailto = 'mailto:?subject=' + encodeURIComponent(m.subject) + '&body=' + encodeURIComponent(m.body);
    var a = document.createElement('a'); a.href = mailto; document.body.appendChild(a); a.click(); setTimeout(function(){ a.remove(); }, 0);
    toast('내용을 클립보드에 복사했습니다 — 메일이 안 열리면 본문에 붙여넣기(Ctrl+V) 하세요.');
  }
  $('nm-share').addEventListener('click', function(){ share(curItem); });

  /* ---- 링크 복사 ---- */
  function copyLink(n){
    if (!n || !n.url) return;
    // pure clipboard copy — predictable for a button labelled 복사. (Native share sheet은 의도적으로
    // 쓰지 않음: 데스크톱 navigator.share가 깨진 공유창을 띄우는 문제가 있었음. 공유는 '메일 공유' 담당.)
    copyText(n.url).then(function(){ toast('기사 링크를 복사했습니다.'); });
  }
  $('nm-copy').addEventListener('click', function(){ copyLink(curItem); });

  $('nm-x').addEventListener('click', close);
  $('nm-close').addEventListener('click', close);
  ov.addEventListener('click', function(e){ if (e.target === ov) close(); });
  document.addEventListener('keydown', function(e){ if (e.key === 'Escape' && !ov.hidden) close(); });

  // trap Tab focus within the open dialog
  ov.addEventListener('keydown', function(e){
    if (e.key !== 'Tab' || ov.hidden) return;
    var f = Array.prototype.slice.call(ov.querySelectorAll('button, a[href], input, [tabindex]'))
      .filter(function(el){ return !el.disabled && el.offsetParent !== null && el.getAttribute('tabindex') !== '-1'; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
  });

  window.openNewsModal = open;
  // 국내(한국어 출처·한국 주제) 여부 — index/뉴스페이지가 같은 기준으로 국내/해외를 나누게 공용 노출
  window.smrIsKorean = isKoreanItem;
})();
