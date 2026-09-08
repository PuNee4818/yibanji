/* ============================================================
   一班集 · app.js —— 路由 / 全局动作 / 键盘与滚动
   前置模块（core/context.js → render/* → ui/*）都挂载到 window.YB，
   本文件最后加载并启动应用。
   ============================================================ */
(() => {
  'use strict';
  const YB = window.YB;
  const { $, $$, state } = YB;

  /* ---------- 顶栏 ---------- */
  $('#top-nav').innerHTML = YB.BOOK.categories.filter(c=>!['卷首','卷末'].includes(c.name)).map(c=>`<a href="#/section/${encodeURIComponent(c.name)}">${YB.esc(c.name)}</a>`).join('');
  function markTopNav(name){
    $$('#top-nav a').forEach(x=>x.classList.toggle('current',!!name && x.textContent===name));
  }
  $('#favorites-btn').addEventListener('click',()=>{ location.hash='#/favorites'; });
  YB.FAVORITES.subscribe(YB.updateFavoriteBadge);
  YB.updateFavoriteBadge();

  /* ---------- 路由 ---------- */
  function parseRoute(){
    const h=location.hash || '#/home'; const parts=h.replace(/^#\/?/,'').split('/').map(decodeURIComponent);
    if(parts[0]==='read'){
      if(parts[2]==='section') return {type:'read',id:parts[1],chapter:1,section:+(parts[3]||0),resume:parts[4]==='resume'};
      if(parts[2]==='resume') return {type:'read',id:parts[1],chapter:1,section:0,resume:true};
      return {type:'read',id:parts[1],chapter:+(parts[2]||1),section:0,resume:parts[3]==='resume'};
    }
    if(parts[0]==='section')return {type:'section',name:parts[1]};
    if(parts[0]==='favorites')return {type:'favorites'};
    return {type:'home'};
  }
  function currentRoute(){ return parseRoute(); }

  function router(){
    const r=parseRoute();
    if(r.type==='read') YB.renderArticle(r.id,r.chapter||1,false,r.resume,r.section||0);
    else{
      if(state.immersive) YB.setImmersive(false);
      if(r.type==='section') YB.renderSection(r.name);
      else if(r.type==='favorites') YB.renderFavorites();
      else YB.renderHome();
    }
    YB.closeDrawer();YB.closeSearch();
  }

  /* ---------- 全局动作 ---------- */
  function toggleFav(id){
    const added=YB.FAVORITES.toggle(id);
    YB.toast(added?'已收藏':'已取消收藏');
    YB.updateFavoriteBadge();
    YB.popStar(added);
    const cur=window._currentRead;
    if(cur) YB.renderArticle(cur.a.id,cur.chapter,true,false,cur.section||0);
    else{
      const r=parseRoute();
      if(r.type==='favorites') YB.renderFavorites();
      else if(r.type==='home') YB.renderHome();
    }
  }
  function copyLink(){
    const url=location.href;
    if(navigator.clipboard?.writeText){navigator.clipboard.writeText(url).then(()=>YB.toast('链接已复制')).catch(()=>YB.toast('请从地址栏复制链接'));}
    else YB.toast('请从地址栏复制链接');
  }

  /* ---------- 键盘 ---------- */
  document.addEventListener('keydown',e=>{
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();YB.openSearch()}
    if(e.key==='Escape'){
      const settings=$('#settings-panel');
      if(settings.classList.contains('open')) settings.classList.remove('open');
      else if(document.body.classList.contains('search-open')) YB.closeSearch();
      else if($('#drawer').classList.contains('open')) YB.closeDrawer();
      else if(state.immersive) YB.setImmersive(false);
    }
    const cur=window._currentRead;
    if(cur && !document.body.classList.contains('search-open') && ['ArrowLeft','ArrowRight'].includes(e.key) && !/^(INPUT|TEXTAREA)$/.test(e.target.tagName)){
      const {a,chapter,section}=cur;
      let target=null;
      if(a.kind==='novel'){
        const nc=chapter+(e.key==='ArrowRight'?1:-1);
        if(nc>=1&&nc<=a.chapters.length) target=YB.routeFor(a,nc);
      }else{
        const secs=YB.getSections(a);
        if(secs.length){
          const n=secs.length, ns=(section||0)+(e.key==='ArrowRight'?1:-1);
          if(ns>=1&&ns<=n) target=YB.routeFor(a,ns);
        }
      }
      if(target) location.hash=target.slice(1);
    }
  });

  /* ---------- 滚动进度与续读位置 ---------- */
  let scrollTimer=null;
  window.addEventListener('scroll',()=>{YB.updateProgress();if(window._currentRead){clearTimeout(scrollTimer);scrollTimer=setTimeout(()=>localStorage.setItem(window._currentRead.savedKey,scrollY),120)}},{passive:true});
  window.addEventListener('beforeunload',()=>{if(window._currentRead)localStorage.setItem(window._currentRead.savedKey,scrollY)});
  window.addEventListener('hashchange',router);

  /* ---------- 挂载与启动 ---------- */
  YB.markTopNav = markTopNav;
  YB.parseRoute = parseRoute;
  YB.currentRoute = currentRoute;
  YB.router = router;
  YB.toggleFav = toggleFav;
  YB.copyLink = copyLink;

  document.documentElement.dataset.theme = state.theme;
  YB.applyReadingPrefs();
  router();
})();
