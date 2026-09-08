/* ============================================================
   一班集 · ui/immersive.js —— 沉浸模式（chrome 自动隐藏 / 底部翻页）
   ============================================================ */
(function(){
  'use strict';
  const YB = window.YB;
  const {$, state} = YB;
  let chromeTimer=null;

  function navTargets(a,chapter,section){
    if(a.kind==='novel'){
      const n=a.chapters.length;
      return {pos:`${chapter} / ${n}`,hasPrev:chapter>1,hasNext:chapter<n,
        go(d){location.hash=YB.routeFor(a,chapter+d).slice(1)}};
    }
    const secs=YB.getSections(a);
    if(!secs.length) return null;
    const n=secs.length, cur=Math.min(Math.max(section||0,0),n);
    return {pos:`${Math.max(cur,1)} / ${n}`,hasPrev:cur>1,hasNext:cur<n,
      go(d){const t=cur+d; if(t>=1&&t<=n) location.hash=YB.routeFor(a,t).slice(1)}};
  }
  function removeImmersiveUI(){
    $('#imx-bar')?.remove(); $('#imx-nav')?.remove();
  }
  function refreshImmersiveUI(a,chapter,section){
    removeImmersiveUI();
    if(!state.immersive || !a) return;
    const bar=document.createElement('div');
    bar.id='imx-bar'; bar.className='imx-bar';
    bar.innerHTML=`<button class="imx-btn" id="imx-fav" aria-label="收藏此篇" title="收藏此篇">☆</button><button class="imx-btn" id="imx-settings" aria-label="阅读设置" title="阅读设置">Aa</button><button class="imx-btn" id="imx-theme" aria-label="切换夜间模式" title="切换夜间模式">◐</button><button class="imx-btn" id="imx-exit" aria-label="退出沉浸模式" title="退出沉浸模式 (Esc)">✕</button>`;
    document.body.append(bar);
    const favBtn=$('#imx-fav');
    if(favBtn){
      favBtn.textContent = YB.isFavorite(a) ? '★' : '☆';
      favBtn.classList.toggle('on', YB.isFavorite(a));
      favBtn.addEventListener('click',()=>YB.toggleFav(a.id));
    }
    $('#imx-exit').addEventListener('click',()=>setImmersive(false));
    $('#imx-theme').addEventListener('click',YB.toggleTheme);
    $('#imx-settings').addEventListener('click',e=>{e.stopPropagation();$('#settings-panel').classList.toggle('open');scheduleChrome()});
    const t=navTargets(a,chapter,section);
    if(t){
      const nav=document.createElement('div');
      nav.id='imx-nav'; nav.className='imx-nav';
      nav.innerHTML=`<button id="imx-prev" aria-label="上一${a.kind==='novel'?'章':'节'}" ${t.hasPrev?'':'disabled'}>‹</button><span class="imx-pos">${t.pos}</span><button id="imx-next" aria-label="下一${a.kind==='novel'?'章':'节'}" ${t.hasNext?'':'disabled'}>›</button>`;
      document.body.append(nav);
      $('#imx-prev').addEventListener('click',()=>t.go(-1));
      $('#imx-next').addEventListener('click',()=>t.go(1));
    }
    scheduleChrome();
  }
  function setImmersive(on){
    if(on && !window._currentRead){ YB.toast('请先打开一篇文章'); return; }
    state.immersive=on;
    document.body.classList.toggle('immersive',on);
    document.body.classList.remove('chrome-hidden');
    clearTimeout(chromeTimer);
    const cur=window._currentRead;
    if(on && cur) refreshImmersiveUI(cur.a,cur.chapter,cur.section);
    if(!on) removeImmersiveUI();
    if(on) YB.toast('已进入沉浸模式，Esc 或右上角 ✕ 退出');
  }
  function scheduleChrome(){
    document.body.classList.remove('chrome-hidden');
    clearTimeout(chromeTimer);
    if(!state.immersive) return;
    chromeTimer=setTimeout(()=>{
      if(state.immersive && !$('#settings-panel').classList.contains('open') && !document.body.classList.contains('search-open')) document.body.classList.add('chrome-hidden');
    },2800);
  }
  ['pointermove','pointerdown','keydown','scroll'].forEach(ev=>window.addEventListener(ev,scheduleChrome,{passive:true}));
  // 指针靠近上下边缘时提前唤回 chrome，比等任何 pointermove 更跟手
  window.addEventListener('pointermove',e=>{
    if(!state.immersive) return;
    if((e.clientY>innerHeight-90 || e.clientY<90) && document.body.classList.contains('chrome-hidden')) scheduleChrome();
  },{passive:true});

  YB.refreshImmersiveUI = refreshImmersiveUI;
  YB.setImmersive = setImmersive;
})();
