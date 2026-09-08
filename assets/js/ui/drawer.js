/* ============================================================
   一班集 · ui/drawer.js —— 抽屉目录
   ============================================================ */
(function(){
  'use strict';
  const YB = window.YB;
  const {$, $$, esc, titleHTML, routeFor, getSections, favoriteMark} = YB;

  function drawerWork(a,current){
    const sections=getSections(a);
    const active=current?.type==='read' && current.id===a.id;
    if(!sections.length){
      return `<a class="drawer-work-link ${active?'current':''}" href="${routeFor(a)}"><span class="drawer-work-title">${titleHTML(a)}${favoriteMark(a,'drawer-fav-mark')}</span><small>${esc(a.author||'')}</small></a>`;
    }
    const open=active || YB.state.railOpen.has(`drawer:${a.id}`);
    const sectionLinks=sections.map(s=>{
      const cur=active && ((a.kind==='novel'?(current.chapter||1):(current.section||0))===s.index);
      return `<a class="drawer-sub-link ${cur?'current':''}" href="${routeFor(a,s.index)}"><span>${String(s.index).padStart(2,'0')}</span>${esc(s.title)}</a>`;
    }).join('');
    return `<div class="drawer-work ${open?'open':''}" data-drawer-work="${a.id}"><div class="drawer-work-row"><button class="tree-toggle" data-drawer-toggle="${a.id}" aria-label="展开或收起《${esc(a.title)}》章节" aria-expanded="${open}">⌄</button><a class="drawer-work-main ${active?'current':''}" href="${routeFor(a)}"><span class="drawer-work-title">${titleHTML(a)}${favoriteMark(a,'drawer-fav-mark')}</span><small>${esc(a.author||'')}</small></a></div><div class="drawer-sublist">${sectionLinks}</div></div>`;
  }

  function renderDrawer(route){
    route = route || (YB.currentRoute ? YB.currentRoute() : {type:'home'});
    const favCount=YB.favoriteArticles().length;
    $('#drawer').innerHTML=`<div class="drawer-title"><a href="#/home">一班集</a><button class="drawer-home" data-drawer-close aria-label="关闭目录">×</button></div><a class="drawer-favorites-entry ${route?.type==='favorites'?'current':''}" href="#/favorites"><span>★ 收藏夹</span><small>${favCount}</small></a>`+YB.BOOK.categories.map(c=>{
      const arts=c.articles.map(id=>YB.articleMap[id]).filter(Boolean);
      const catActive=route?.type==='read' && YB.articleMap[route.id]?.category===c.name;
      return `<div class="drawer-section"><a class="drawer-section-title ${catActive?'current':''}" href="#/section/${encodeURIComponent(c.name)}">${esc(c.name)}</a>${arts.map(a=>drawerWork(a,route)).join('')}</div>`
    }).join('');
    $$('[data-drawer-toggle]').forEach(btn=>btn.addEventListener('click',e=>{
      e.preventDefault(); e.stopPropagation();
      const id=btn.dataset.drawerToggle, key=`drawer:${id}`;
      const wrap=btn.closest('.drawer-work');
      const next=!wrap.classList.contains('open');
      wrap.classList.toggle('open',next); btn.setAttribute('aria-expanded',String(next));
      if(next) YB.state.railOpen.add(key); else YB.state.railOpen.delete(key);
    }));
    $$('[data-drawer-close]').forEach(x=>x.addEventListener('click',closeDrawer));
    $$('#drawer a').forEach(a=>a.addEventListener('click',closeDrawer));
  }

  const drawer=$('#drawer'), backdrop=$('#drawer-backdrop');
  function openDrawer(){
    renderDrawer(YB.currentRoute ? YB.currentRoute() : {type:'home'});
    drawer.classList.add('open');backdrop.classList.add('open');
    const cur=$('.drawer-sub-link.current',drawer)||$('.drawer-work-link.current',drawer)||$('.drawer-work-main.current',drawer);
    if(cur)setTimeout(()=>{drawer.scrollTop=Math.max(0,cur.offsetTop-drawer.clientHeight*0.35)},0)
  }
  function closeDrawer(){drawer.classList.remove('open');backdrop.classList.remove('open')}

  $('#menu-btn').addEventListener('click',openDrawer);
  backdrop.addEventListener('click',closeDrawer);

  YB.renderDrawer = renderDrawer;
  YB.openDrawer = openDrawer;
  YB.closeDrawer = closeDrawer;
})();
