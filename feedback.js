/* ============================================================
   SMR Hub — tester feedback widget (Formspree-backed)
   1) Create a form at https://formspree.io  → copy its endpoint
   2) Replace REPLACE_ME below with your form id (the part after /f/)
   Loaded on every page via <script src="feedback.js" defer></script>
   ============================================================ */
(function () {
  var ENDPOINT = 'https://formspree.io/f/xeewllzn';   // Formspree form id
  var SHOW_NOTICE = true;   // ← 상단 'TESTING' 배너 표시 (정식 오픈 시 false 로 변경)

  var C = { acc:'#2563eb', accD:'#1d4ed8', accW:'#eef3ff', accW2:'#d7e3fe',
            sf:'#ffffff', sf2:'#f1f3f7', bd:'#e5e8ee', bdS:'#d2d7e0',
            tx:'#1a2230', dim:'#5a6473', faint:'#8b93a2' };

  var css =
  '#fb-btn{position:fixed;right:18px;bottom:18px;z-index:2147483600;display:inline-flex;align-items:center;gap:7px;'
  +'background:'+C.acc+';color:#fff;font:600 13.5px/1 "Pretendard",-apple-system,"Segoe UI","Malgun Gothic",sans-serif;'
  +'padding:11px 15px;border-radius:24px;box-shadow:0 4px 14px rgba(37,99,235,.34);cursor:pointer;border:none;}'
  +'#fb-btn:hover{background:'+C.accD+';}'
  +'#fb-btn svg{width:16px;height:16px;}'
  +'#fb-panel{position:fixed;right:18px;bottom:70px;z-index:2147483600;width:330px;max-width:calc(100vw - 36px);'
  +'background:'+C.sf+';border:1px solid '+C.bd+';border-radius:12px;box-shadow:0 10px 34px rgba(20,28,46,.20);'
  +'font-family:"Pretendard",-apple-system,"Segoe UI","Malgun Gothic",sans-serif;color:'+C.tx+';padding:14px 15px 15px;}'
  +'#fb-panel[hidden]{display:none;}'
  +'.fb-head{display:flex;align-items:center;gap:8px;margin-bottom:9px;}'
  +'.fb-head b{font-size:14.5px;font-weight:700;}'
  +'.fb-x{margin-left:auto;background:none;border:none;font-size:18px;line-height:1;color:'+C.faint+';cursor:pointer;padding:0 2px;}'
  +'.fb-x:hover{color:'+C.tx+';}'
  +'.fb-page{font-size:11.5px;color:'+C.faint+';margin-bottom:9px;word-break:break-all;}'
  +'.fb-locrow{display:flex;align-items:center;gap:8px;margin-bottom:8px;}'
  +'.fb-pick{flex:0 0 auto;background:'+C.sf+';border:1px solid '+C.bdS+';color:'+C.accD+';font:600 12px/1 inherit;'
  +'padding:7px 11px;border-radius:7px;cursor:pointer;white-space:nowrap;}'
  +'.fb-pick:hover{background:'+C.accW+';border-color:'+C.acc+';}'
  +'.fb-pick.on{background:'+C.acc+';color:#fff;border-color:'+C.acc+';}'
  +'.fb-loc{flex:1;min-width:0;font-size:12px;color:'+C.dim+';background:'+C.sf2+';border:1px solid '+C.bd+';'
  +'border-radius:7px;padding:7px 9px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}'
  +'#fb-panel textarea,#fb-panel input.fb-name{width:100%;box-sizing:border-box;font:14px/1.5 inherit;color:'+C.tx+';'
  +'background:'+C.sf+';border:1px solid '+C.bdS+';border-radius:8px;padding:9px 11px;outline:none;}'
  +'#fb-panel textarea{min-height:84px;resize:vertical;margin-bottom:8px;}'
  +'#fb-panel textarea:focus,#fb-panel input.fb-name:focus{border-color:'+C.acc+';box-shadow:0 0 0 3px '+C.accW+';}'
  +'.fb-name{margin-bottom:10px;}'
  +'.fb-send{width:100%;background:'+C.acc+';color:#fff;border:none;font:600 14px/1 inherit;padding:11px;border-radius:8px;cursor:pointer;}'
  +'.fb-send:hover{background:'+C.accD+';}'
  +'.fb-send:disabled{opacity:.6;cursor:default;}'
  +'.fb-msg{font-size:12.5px;margin-top:9px;line-height:1.5;}'
  +'.fb-msg.ok{color:'+C.accD+';}.fb-msg.err{color:#b42318;}'
  +'#fb-notice{font-family:"Pretendard",-apple-system,"Segoe UI","Malgun Gothic",sans-serif;font-size:13px;'
  +'color:#b45309;background:#fffbeb;border-bottom:1px solid #fae3bf;padding:8px 16px;text-align:center;'
  +'line-height:1.55;cursor:pointer;}'
  +'#fb-notice:hover{background:#fff6e0;}'
  +'#fb-notice b{color:#92400e;}'
  +'#fb-notice .fb-tag{display:inline-block;background:#d97706;color:#fff;font-size:10px;font-weight:700;'
  +'letter-spacing:.05em;padding:2px 7px;border-radius:4px;margin-right:8px;vertical-align:1px;}'
  +'#fb-hl{position:fixed;z-index:2147483500;pointer-events:none;border:2px solid '+C.acc+';background:rgba(37,99,235,.10);'
  +'border-radius:4px;display:none;transition:all .04s linear;}'
  +'body.fb-picking,body.fb-picking *{cursor:crosshair!important;}';

  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var root = document.createElement('div');
  root.innerHTML =
    '<button id="fb-btn" aria-label="의견 남기기">'
    + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>'
    + '의견</button>'
    + '<div id="fb-panel" hidden>'
    + '<div class="fb-head"><b>이 페이지에 의견</b><button class="fb-x" aria-label="닫기">&times;</button></div>'
    + '<div class="fb-page" id="fb-page"></div>'
    + '<div class="fb-locrow"><button class="fb-pick" id="fb-pick">위치 지정</button><span class="fb-loc" id="fb-loc" title="">페이지 전체</span></div>'
    + '<textarea id="fb-comment" placeholder="무엇이 좋거나 고쳤으면 하나요? 자유롭게 적어주세요."></textarea>'
    + '<input class="fb-name" id="fb-name" placeholder="이름/닉네임 (선택)" autocomplete="off">'
    + '<input id="fb-gotcha" name="_gotcha" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true">'
    + '<button class="fb-send" id="fb-send">보내기</button>'
    + '<div class="fb-msg" id="fb-msg"></div>'
    + '</div>'
    + '<div id="fb-hl"></div>';
  document.body.appendChild(root);

  var $ = function (id) { return document.getElementById(id); };
  var btn=$('fb-btn'), panel=$('fb-panel'), hl=$('fb-hl'),
      pageEl=$('fb-page'), locEl=$('fb-loc'), pickBtn=$('fb-pick'),
      comment=$('fb-comment'), nameEl=$('fb-name'), sendBtn=$('fb-send'), msg=$('fb-msg');

  pageEl.textContent = '페이지: ' + document.title;
  var loc = null;   // captured location object

  function openPanel(){ panel.hidden=false; comment.focus(); }
  function closePanel(){ panel.hidden=true; stopPick(); }
  btn.addEventListener('click', function(){ panel.hidden ? openPanel() : closePanel(); });
  root.querySelector('.fb-x').addEventListener('click', closePanel);

  /* ---- testing notice bar (top of every page; toggle via SHOW_NOTICE) ---- */
  if (SHOW_NOTICE) {
    var notice = document.createElement('div');
    notice.id = 'fb-notice';
    notice.innerHTML = '<span class="fb-tag">TESTING</span>현재 테스트 중인 초안입니다 · 의견·오류·제안 무엇이든 우측 하단 <b>‘의견’</b> 버튼으로 보내주세요';
    notice.addEventListener('click', openPanel);
    var nav = document.querySelector('.topnav');
    if (nav && nav.parentNode) { nav.parentNode.insertBefore(notice, nav.nextSibling); }
    else { document.body.insertBefore(notice, document.body.firstChild); }
  }

  /* ---- location picker ---- */
  var picking=false;
  function cssPath(el){
    var parts=[];
    while(el && el.nodeType===1 && parts.length<4 && el.id!=='fb-panel'){
      var s=el.tagName.toLowerCase();
      if(el.id){ s+='#'+el.id; parts.unshift(s); break; }
      if(el.className && typeof el.className==='string'){ var c=el.className.trim().split(/\s+/).slice(0,2).join('.'); if(c) s+='.'+c; }
      parts.unshift(s); el=el.parentElement;
    }
    return parts.join(' > ');
  }
  function nearestHeading(el){
    var n=el;
    while(n && n!==document.body){
      var h=n.querySelector? null:null;
      // look at previous siblings / ancestors for a heading
      var p=n;
      while(p){ if(/^H[1-3]$/.test(p.tagName)||/(sec-head|section-title|track-title|sub-h|reg-head|kicker)/.test(p.className||'')) return (p.innerText||'').trim().slice(0,50); p=p.previousElementSibling; }
      n=n.parentElement;
    }
    return '';
  }
  function startPick(){
    picking=true; pickBtn.classList.add('on'); pickBtn.textContent='취소';
    document.body.classList.add('fb-picking'); panel.style.opacity='.35';
  }
  function stopPick(){
    picking=false; pickBtn.classList.remove('on'); pickBtn.textContent='위치 지정';
    document.body.classList.remove('fb-picking'); hl.style.display='none'; panel.style.opacity='';
  }
  pickBtn.addEventListener('click', function(e){ e.preventDefault(); picking?stopPick():startPick(); });

  document.addEventListener('mousemove', function(e){
    if(!picking) return;
    var el=document.elementFromPoint(e.clientX,e.clientY);
    if(!el||root.contains(el)){ hl.style.display='none'; return; }
    var r=el.getBoundingClientRect();
    hl.style.display='block'; hl.style.left=r.left+'px'; hl.style.top=r.top+'px';
    hl.style.width=r.width+'px'; hl.style.height=r.height+'px';
  }, true);

  document.addEventListener('click', function(e){
    if(!picking) return;
    var el=document.elementFromPoint(e.clientX,e.clientY);
    if(!el||root.contains(el)) return;
    e.preventDefault(); e.stopPropagation();
    var text=(el.innerText||el.textContent||'').replace(/\s+/g,' ').trim().slice(0,90);
    var heading=nearestHeading(el);
    loc={ text:text, heading:heading, selector:cssPath(el), scrollY:Math.round(window.scrollY) };
    var label=(heading?'['+heading+'] ':'')+(text||el.tagName.toLowerCase());
    locEl.textContent=label; locEl.title=label;
    stopPick();
  }, true);

  /* ---- submit ---- */
  sendBtn.addEventListener('click', function(){
    var text=comment.value.trim();
    if(!text){ msg.className='fb-msg err'; msg.textContent='의견 내용을 입력해 주세요.'; comment.focus(); return; }
    if($('fb-gotcha').value){ return; }   // honeypot
    if(ENDPOINT.indexOf('REPLACE_ME')!==-1){ msg.className='fb-msg err'; msg.textContent='(설정 필요) Formspree 엔드포인트가 아직 등록되지 않았어요.'; return; }

    sendBtn.disabled=true; msg.className='fb-msg'; msg.textContent='보내는 중…';
    var payload={
      _subject:'[SMR허브 의견] '+document.title,
      페이지:document.title,
      URL:location.href,
      위치: loc ? ((loc.heading?'['+loc.heading+'] ':'')+loc.text) : '페이지 전체',
      위치_상세: loc ? (loc.selector+' · scrollY '+loc.scrollY) : '',
      의견:text,
      작성자: nameEl.value.trim()||'익명',
      시각: new Date().toLocaleString('ko-KR'),
      화면: window.innerWidth+'×'+window.innerHeight
    };
    fetch(ENDPOINT,{ method:'POST', headers:{'Content-Type':'application/json','Accept':'application/json'}, body:JSON.stringify(payload) })
      .then(function(r){ return r.json().then(function(j){ return {ok:r.ok,j:j}; }); })
      .then(function(res){
        if(res.ok){
          msg.className='fb-msg ok'; msg.textContent='감사합니다! 의견이 전달됐어요.';
          comment.value=''; nameEl.value=''; loc=null; locEl.textContent='페이지 전체'; locEl.title='';
          setTimeout(closePanel, 1400);
        } else {
          msg.className='fb-msg err'; msg.textContent='전송 실패: '+((res.j&&res.j.errors&&res.j.errors[0]&&res.j.errors[0].message)||'잠시 후 다시 시도해 주세요.');
        }
      })
      .catch(function(){ msg.className='fb-msg err'; msg.textContent='네트워크 오류 — 잠시 후 다시 시도해 주세요.'; })
      .finally(function(){ sendBtn.disabled=false; });
  });

  document.addEventListener('keydown', function(e){ if(e.key==='Escape'){ if(picking) stopPick(); else if(!panel.hidden) closePanel(); } });
})();
