(() => {
  const BOOK = window.BOOK_DATA;
  const $ = (s,root=document)=>root.querySelector(s);
  const $$ = (s,root=document)=>[...root.querySelectorAll(s)];
  const app = $('#app');
  const articleMap = Object.fromEntries(BOOK.articles.map(a=>[a.id,a]));
  const catMap = Object.fromEntries(BOOK.categories.map(c=>[c.name,c]));
  const FAVORITES = window.YB_FAVORITES;
  if(!FAVORITES) throw new Error('收藏模块未加载');
  FAVORITES.prune(BOOK.articles.map(a=>a.id));

  const state = {
    theme: localStorage.getItem('yb_theme') || 'light',
    font: +(localStorage.getItem('yb_font') || 0),
    line: localStorage.getItem('yb_line') || 'normal',
    width: localStorage.getItem('yb_width') || 'normal',
    railOpen: new Set()
  };

  // 个别作品使用无编号的小标题。这里仅登记原文确有的小标题，不人工拆段。
  const MANUAL_SECTION_TITLES = BOOK.sectionHints || {};

  document.documentElement.dataset.theme = state.theme;
  applyReadingPrefs();

  function applyReadingPrefs(){
    const root=document.documentElement;
    root.style.setProperty('--reading-size', `${19 + state.font}px`);
    const line = state.line==='compact'?1.72:state.line==='loose'?2.16:1.95;
    root.style.setProperty('--reading-line', line);
    const width = state.width==='narrow'?650:state.width==='wide'?880:760;
    root.style.setProperty('--reading-width', `${width}px`);
  }
  function fmtChars(n){ return n>=10000 ? `${(n/10000).toFixed(1)}万字` : `${n.toLocaleString()}字`; }
  function esc(s=''){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
  function categoryIndex(name){return BOOK.categories.findIndex(c=>c.name===name)+1;}
  function toast(t){const el=$('#toast');el.textContent=t;el.classList.add('show');clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove('show'),1500)}
  function lastRead(){try{return JSON.parse(localStorage.getItem('yb_last')||'null')}catch{return null}}
  function isFavorite(aOrId){ return FAVORITES.has(typeof aOrId==='string'?aOrId:aOrId?.id); }
  function favoriteArticles(){
    return FAVORITES.list().map(id=>articleMap[id]).filter(Boolean).reverse();
  }
  function favoriteMark(a, cls='favorite-mini-mark'){
    return isFavorite(a) ? `<span class="${cls}" aria-label="已收藏" title="已收藏">★</span>` : '';
  }
  function updateFavoriteBadge(){
    const btn=$('#favorites-btn'), count=$('#favorites-count'), icon=btn?.querySelector('.favorites-header-icon');
    if(!btn || !count) return;
    const n=favoriteArticles().length;
    count.textContent=String(n);
    count.hidden=n===0;
    btn.classList.toggle('has-favorites',n>0);
    if(icon) icon.textContent=n>0?'★':'☆';
    btn.setAttribute('aria-label',n>0?`打开收藏夹，已收藏 ${n} 篇`:'打开收藏夹');
  }

  function numberedSectionLine(text){
    const t=(text||'').trim();
    if(!t || t.length>28) return false;
    return /^(?:[一二三四五六七八九十百]+(?:[、.．]|\s{1,3}))/.test(t);
  }

  function sectionTitleFromLine(text){
    return (text||'').trim().replace(/^([一二三四五六七八九十百]+)、\s*/, '$1').replace(/\s+/g,' ');
  }

  function titleHTML(a){
    const raw=(a?.title||'').trim();
    const m=raw.match(/^(.*?)(并序)$/);
    if(!m) return esc(raw);
    return `${esc(m[1])}<span class="title-suffix">${esc(m[2])}</span>`;
  }

  function hasInlinePreface(a){ return /并序$/.test((a?.title||'').trim()) && Array.isArray(a.body) && a.body.length>0; }

  function getSections(a){
    if(a.kind==='novel'){
      return a.chapters.map((c,i)=>({index:i+1,title:c.title,bodyIndex:null,kind:'chapter'}));
    }
    if(!a.body) return [];
    const manual=MANUAL_SECTION_TITLES[a.id];
    const out=[];
    a.body.forEach((p,i)=>{
      const t=(p||'').trim();
      const isManual=manual?.includes(t);
      const isNumbered=numberedSectionLine(t);
      if(isManual || isNumbered) out.push({index:out.length+1,title:sectionTitleFromLine(t),bodyIndex:i,kind:'anchor'});
    });
    return out.length>=2 ? out : [];
  }

  function isStructured(a){return getSections(a).length>0;}
  function unitLabel(a){
    const n=getSections(a).length;
    if(!n) return '';
    return a.kind==='novel'?`${n}章`:`${n}节`;
  }
  function routeFor(a, part){
    if(a.kind==='novel') return `#/read/${a.id}/${part||1}`;
    if(part && isStructured(a)) return `#/read/${a.id}/section/${part}`;
    return `#/read/${a.id}`;
  }
  function resumeRoute(a,chapter=1){ return a.kind==='novel' ? `${routeFor(a,chapter)}/resume` : `${routeFor(a)}/resume`; }
  function saveLast(a,chapter=1){localStorage.setItem('yb_last', JSON.stringify({id:a.id,chapter:a.kind==='novel'?chapter:1,ts:Date.now()}));}

  // 顶栏卷目
  $('#top-nav').innerHTML = BOOK.categories.filter(c=>!['卷首','卷末'].includes(c.name)).map(c=>`<a href="#/section/${encodeURIComponent(c.name)}">${esc(c.name)}</a>`).join('');
  $('#favorites-btn').addEventListener('click',()=>{ location.hash='#/favorites'; });
  FAVORITES.subscribe(updateFavoriteBadge);
  updateFavoriteBadge();

  function currentRoute(){ return parseRoute(); }

  function drawerWork(a,current){
    const sections=getSections(a);
    const active=current?.type==='read' && current.id===a.id;
    if(!sections.length){
      return `<a class="drawer-work-link ${active?'current':''}" href="${routeFor(a)}"><span class="drawer-work-title">${titleHTML(a)}${favoriteMark(a,'drawer-fav-mark')}</span><small>${esc(a.author||'')}</small></a>`;
    }
    const open=active || state.railOpen.has(`drawer:${a.id}`);
    const sectionLinks=sections.map(s=>{
      const cur=active && ((a.kind==='novel'?(current.chapter||1):(current.section||0))===s.index);
      return `<a class="drawer-sub-link ${cur?'current':''}" href="${routeFor(a,s.index)}"><span>${String(s.index).padStart(2,'0')}</span>${esc(s.title)}</a>`;
    }).join('');
    return `<div class="drawer-work ${open?'open':''}" data-drawer-work="${a.id}"><div class="drawer-work-row"><button class="tree-toggle" data-drawer-toggle="${a.id}" aria-label="展开或收起《${esc(a.title)}》章节" aria-expanded="${open}">⌄</button><a class="drawer-work-main ${active?'current':''}" href="${routeFor(a)}"><span class="drawer-work-title">${titleHTML(a)}${favoriteMark(a,'drawer-fav-mark')}</span><small>${esc(a.author||'')}</small></a></div><div class="drawer-sublist">${sectionLinks}</div></div>`;
  }

  function renderDrawer(route=currentRoute()){
    const favCount=favoriteArticles().length;
    $('#drawer').innerHTML=`<div class="drawer-title"><a href="#/home">一班集</a><button class="drawer-home" data-drawer-close aria-label="关闭目录">×</button></div><a class="drawer-favorites-entry ${route?.type==='favorites'?'current':''}" href="#/favorites"><span>★ 收藏夹</span><small>${favCount}</small></a>`+BOOK.categories.map(c=>{
      const arts=c.articles.map(id=>articleMap[id]).filter(Boolean);
      const catActive=route?.type==='read' && articleMap[route.id]?.category===c.name;
      return `<div class="drawer-section"><a class="drawer-section-title ${catActive?'current':''}" href="#/section/${encodeURIComponent(c.name)}">${esc(c.name)}</a>${arts.map(a=>drawerWork(a,route)).join('')}</div>`
    }).join('');
    $$('[data-drawer-toggle]').forEach(btn=>btn.addEventListener('click',e=>{
      e.preventDefault(); e.stopPropagation();
      const id=btn.dataset.drawerToggle, key=`drawer:${id}`;
      const wrap=btn.closest('.drawer-work');
      const next=!wrap.classList.contains('open');
      wrap.classList.toggle('open',next); btn.setAttribute('aria-expanded',String(next));
      if(next) state.railOpen.add(key); else state.railOpen.delete(key);
    }));
    $$('[data-drawer-close]').forEach(x=>x.addEventListener('click',closeDrawer));
    $$('#drawer a').forEach(a=>a.addEventListener('click',closeDrawer));
  }

  function renderHomeFavorites(){
    const arts=favoriteArticles();
    if(!arts.length){
      return `<section class="favorites-home"><div class="favorites-home-head"><div><span class="favorites-kicker">BOOKMARKS</span><h2>收藏夹</h2></div><a href="#/favorites">打开收藏夹 →</a></div><div class="favorites-empty-home"><span>☆</span><p>还没有收藏文章。阅读时点击“收藏”后，会在这里留下书签。</p></div></section>`;
    }
    const cards=arts.slice(0,6).map(a=>`<a class="favorite-mini-card" href="${routeFor(a)}"><span class="favorite-mini-star">★</span><div><h3>${titleHTML(a)}</h3><p>${esc(a.author||'')} · ${esc(a.category)}</p></div><span class="favorite-mini-arrow">→</span></a>`).join('');
    return `<section class="favorites-home"><div class="favorites-home-head"><div><span class="favorites-kicker">BOOKMARKS · ${arts.length}</span><h2>我的收藏</h2></div><a href="#/favorites">查看全部 →</a></div><div class="favorites-home-grid">${cards}</div></section>`;
  }

  function renderHome(){
    document.title='一班集';
    window._currentRead=null;
    const lr=lastRead();
    let cont='';
    if(lr && articleMap[lr.id]){
      const a=articleMap[lr.id], ch=a.kind==='novel'?(lr.chapter||1):null;
      const suffix=ch?` · 第${ch}章`:'';
      cont=`<div class="continue-box"><div class="continue-label">继续阅读</div><a class="continue-link" href="${resumeRoute(a,ch)}"><span>${esc(a.title)}${suffix}</span><span>继续 →</span></a></div>`;
    }
    const categoryBlocks=BOOK.categories.map((c,ci)=>{
      const arts=c.articles.map(id=>articleMap[id]).filter(Boolean);
      return `<div class="category-break"><span class="num">${String(ci+1).padStart(2,'0')}</span><h2>${esc(c.name)}</h2><div class="line"></div></div>`+arts.map((a,ai)=>{
        const featured=a.id==='tianhuaban';
        const u=unitLabel(a); const meta=`${u?u+' · ':''}${fmtChars(a.chars)}`;
        const fav=isFavorite(a);
        return `<a class="work-card ${featured?'featured':''} ${fav?'is-favorite':''}" href="${routeFor(a)}">${fav?'<span class="work-favorite-mark">★ 已收藏</span>':''}<div class="card-no">${String(ai+1).padStart(2,'0')} / ${String(arts.length).padStart(2,'0')}</div><h3>${titleHTML(a)}</h3><div class="card-by">${esc(a.author||'')}</div><div class="card-meta">${meta}</div></a>`;
      }).join('')
    }).join('');
    app.innerHTML=`<section class="hero"><div class="hero-grid"><div class="cover-block"><div><div class="issue-kicker">CLASS ONE · COLLECTION</div><h1 class="cover-title">一班集</h1></div><div><div class="cover-meta"><span>第二版</span><span>${BOOK.articles.length} 篇</span><span>${BOOK.categories.length} 卷</span></div>${cont}</div></div><div class="dedication"><div class="dedication-mark">※</div>${BOOK.dedication.map(x=>`<p>${esc(x)}</p>`).join('')}</div></div></section>${renderHomeFavorites()}<section class="section-index"><div class="section-heading"><h2>目录</h2><span class="count">CONTENTS</span></div><div class="mag-grid">${categoryBlocks}</div></section>`;
    window.scrollTo(0,0); updateProgress(); renderDrawer({type:'home'});
  }

  function renderSection(name){
    const c=catMap[name]; if(!c){return renderHome()}
    window._currentRead=null;
    const arts=c.articles.map(id=>articleMap[id]).filter(Boolean);
    document.title=`${name}｜一班集`;
    app.innerHTML=`<section class="section-page"><nav class="page-breadcrumb"><a href="#/home">一班集</a><span>／</span><strong>${esc(name)}</strong></nav><header class="section-page-head"><h1>${esc(name)}</h1><p>${String(categoryIndex(name)).padStart(2,'0')}</p></header><div class="section-list">${arts.map((a,i)=>{const u=unitLabel(a);return `<a href="${routeFor(a)}"><span class="idx">${String(i+1).padStart(2,'0')}</span><span class="ttl">${titleHTML(a)}${favoriteMark(a,'section-fav-mark')}</span><span class="auth">${esc(a.author||'')}</span><span class="len">${u?u+' · ':''}${fmtChars(a.chars)}</span></a>`}).join('')}</div></section>`;
    window.scrollTo(0,0);updateProgress(); renderDrawer({type:'section',name});
  }

  function looksLikeSectionLine(text){ return numberedSectionLine(text); }
  function paraHTML(p){return `<p class="${looksLikeSectionLine(p)?'section-line':''}">${esc(p)}</p>`}

  function renderProseBody(a){
    const sections=getSections(a);
    const byIndex=new Map(sections.map(s=>[s.bodyIndex,s]));
    const prefaced=hasInlinePreface(a);
    return a.body.map((p,i)=>{
      const s=byIndex.get(i);
      if(s){
        return `<h2 class="story-section-title" id="story-section-${a.id}-${s.index}" data-section-index="${s.index}"><span>${esc(s.title)}</span></h2>`;
      }
      if(prefaced && i===0){
        return `<p class="work-preface">${esc(p)}</p>`;
      }
      return paraHTML(p);
    }).join('');
  }

  function renderEndMatter(a){
    let html='';
    if(Array.isArray(a.notes) && a.notes.length){
      html += `<aside class="work-notes"><div class="work-notes-title">注释</div>${a.notes.map(n=>`<p>${esc(n)}</p>`).join('')}</aside>`;
    }
    if(a.colophon && (a.colophon.signature || a.colophon.date)){
      html += `<footer class="work-colophon">${a.colophon.signature?`<div class="colophon-signature">${esc(a.colophon.signature)}</div>`:''}${a.colophon.date?`<div class="colophon-date">${esc(a.colophon.date)}</div>`:''}</footer>`;
    }
    return html;
  }

  function railWork(a,currentA,chapter,section){
    const sections=getSections(a); const active=a.id===currentA.id;
    const key=`rail:${a.id}`; const open=active || state.railOpen.has(key);
    if(!sections.length){ return `<div class="rail-work simple"><a class="rail-work-main ${active?'current':''}" href="${routeFor(a)}">${titleHTML(a)}${favoriteMark(a,'rail-fav-mark')}</a></div>`; }
    const subs=sections.map(s=>{
      const cur=active && (a.kind==='novel'?chapter:section)===s.index;
      return `<a class="rail-sub-link ${cur?'current':''}" href="${routeFor(a,s.index)}"><span>${String(s.index).padStart(2,'0')}</span><em>${esc(s.title)}</em></a>`;
    }).join('');
    return `<div class="rail-work ${open?'open':''}" data-rail-work="${a.id}"><div class="rail-work-row"><button class="tree-toggle" data-rail-toggle="${a.id}" aria-label="展开或收起《${esc(a.title)}》章节" aria-expanded="${open}">⌄</button><a class="rail-work-main ${active?'current':''}" href="${routeFor(a)}">${titleHTML(a)}${favoriteMark(a,'rail-fav-mark')}</a><small>${unitLabel(a)}</small></div><div class="rail-sublist">${subs}</div></div>`;
  }

  function readingRail(a,chapter,section){
    const cat=catMap[a.category];
    const catArts=cat.articles.map(id=>articleMap[id]).filter(Boolean);
    return `<aside class="left-rail"><div class="rail-nav"><a class="rail-back" href="#/section/${encodeURIComponent(a.category)}">← ${esc(a.category)}目录</a><a class="rail-all" href="#/home">一班集总目录</a></div><div class="rail-label">本卷作品</div><div class="rail-tree">${catArts.map(x=>railWork(x,a,chapter,section)).join('')}</div></aside>`;
  }

  function bindRailToggles(){
    $$('[data-rail-toggle]').forEach(btn=>btn.addEventListener('click',e=>{
      e.preventDefault();e.stopPropagation();
      const id=btn.dataset.railToggle,key=`rail:${id}`;
      const wrap=btn.closest('.rail-work'); const next=!wrap.classList.contains('open');
      wrap.classList.toggle('open',next); btn.setAttribute('aria-expanded',String(next));
      if(next) state.railOpen.add(key); else state.railOpen.delete(key);
    }));
  }

  function rightRail(a, chapter){
    const secs=getSections(a);
    const val=a.kind==='novel'?`${chapter}/${secs.length}`:fmtChars(a.chars).replace('字','');
    const label=a.kind==='novel'?'章节':'字数';
    const fav=isFavorite(a);
    return `<aside class="right-rail"><div class="reading-stat">${val}</div><div class="reading-stat-label">${label}</div><div class="mini-rule"></div><button id="fav-btn" class="${fav?'fav-active':''}">${fav?'★ 已收藏':'☆ 收藏此篇'}</button><button id="copy-btn">复制链接</button></aside>`;
  }

  function breadcrumb(a,chapter,section){
    let tail='';
    if(a.kind==='novel') tail=`<span>／</span><strong>${esc(a.chapters[chapter-1].title)}</strong>`;
    else if(section){ const s=getSections(a)[section-1]; if(s) tail=`<span>／</span><strong>${esc(s.title)}</strong>`; }
    return `<nav class="page-breadcrumb reader-breadcrumb"><a href="#/home">一班集</a><span>／</span><a href="#/section/${encodeURIComponent(a.category)}">${esc(a.category)}</a><span>／</span><a href="${routeFor(a)}">${titleHTML(a)}</a>${tail}</nav>`;
  }

  function renderArticle(id, chapter=1, fromPop=false, resume=false, section=0){
    const a=articleMap[id]; if(!a){return renderHome()}
    const sections=getSections(a);
    chapter=Math.max(1,Math.min(chapter,a.kind==='novel'?a.chapters.length:1));
    section=Math.max(0,Math.min(section,sections.length));
    document.title=`${a.title}｜一班集`;
    saveLast(a,chapter);
    const u=unitLabel(a);
    const meta = `<span>${esc(a.author||'')}</span><span>${esc(a.category)}</span><span>${u?u+' · ':''}${fmtChars(a.chars)}</span>`;
    let body='';
    if(a.kind==='novel'){
      const c=a.chapters[chapter-1];
      const prev=chapter>1?routeFor(a,chapter-1):`#/section/${encodeURIComponent(a.category)}`;
      const next=chapter<a.chapters.length?routeFor(a,chapter+1):`#/section/${encodeURIComponent(a.category)}`;
      const prevText=chapter>1?esc(a.chapters[chapter-2].title):esc(a.category);
      const nextText=chapter<a.chapters.length?esc(a.chapters[chapter].title):esc(a.category);
      body=`<div class="chapter-head"><div class="chapter-number">${String(chapter).padStart(2,'0')}</div><div><small>第 ${chapter} / ${a.chapters.length} 章</small><h2>${esc(c.title)}</h2></div></div><article class="prose-body">${c.body.map(paraHTML).join('')}</article><nav class="chapter-nav"><a href="${prev}"><span>${chapter>1?'上一章':'返回本卷'}</span>${prevText}</a><a href="${next}"><span>${chapter<a.chapters.length?'下一章':'返回本卷'}</span>${nextText}</a></nav>`;
    } else {
      body=`<article class="prose-body ${a.kind==='verse'?'verse':''}">${renderProseBody(a)}</article>`;
    }
    const subtitle=a.subtitle?`<div class="article-subtitle">${esc(a.subtitle)}</div>`:'';
    const endMatter=renderEndMatter(a);
    app.innerHTML=`<div class="read-shell">${readingRail(a,chapter,section)}<main class="reader">${breadcrumb(a,chapter,section)}<header class="article-head"><div class="article-kicker">${esc(a.category)} · ${String(categoryIndex(a.category)).padStart(2,'0')}</div><h1 class="article-title">${titleHTML(a)}</h1>${subtitle}<div class="article-meta">${meta}<div class="article-tools"><span class="tool-link ${isFavorite(a)?'fav-active':''}" id="inline-fav">${isFavorite(a)?'★ 已收藏':'☆ 收藏'}</span><span class="tool-link" id="inline-copy">复制链接</span></div></div></header>${body}${endMatter}</main>${rightRail(a,chapter)}</div>`;
    const bind=(id,fn)=>{const el=$(id);if(el)el.addEventListener('click',fn)};
    bind('#fav-btn',()=>toggleFav(a.id));bind('#inline-fav',()=>toggleFav(a.id));bind('#copy-btn',copyLink);bind('#inline-copy',copyLink);
    bindRailToggles(); renderDrawer({type:'read',id:a.id,chapter,section});
    const rail=$('.left-rail'); const railCurrent=rail && $('.rail-sub-link.current',rail);
    if(rail && railCurrent) rail.scrollTop=Math.max(0,railCurrent.offsetTop-rail.clientHeight*0.42);
    if(!fromPop){window.scrollTo(0,0)}
    updateProgress();
    const savedKey=`yb_scroll_${a.id}_${a.kind==='novel'?chapter:1}`;
    if(resume){
      const pos=+(localStorage.getItem(savedKey)||0);
      if(pos>80) setTimeout(()=>window.scrollTo(0,pos),0);
      history.replaceState(null,'',routeFor(a,chapter));
    } else if(a.kind!=='novel' && section>0){
      const target=$(`#story-section-${a.id}-${section}`);
      if(target) setTimeout(()=>target.scrollIntoView({block:'start'}),0);
    }
    window._currentRead={a,chapter,section,savedKey};
  }

  function toggleFav(id){
    const added=FAVORITES.toggle(id);
    toast(added?'已收藏':'已取消收藏');
    updateFavoriteBadge();
    const cur=window._currentRead;
    if(cur) renderArticle(cur.a.id,cur.chapter,true,false,cur.section||0);
    else{
      const r=parseRoute();
      if(r.type==='favorites') renderFavorites();
      else if(r.type==='home') renderHome();
    }
  }
  function copyLink(){
    const url=location.href;
    if(navigator.clipboard?.writeText){navigator.clipboard.writeText(url).then(()=>toast('链接已复制')).catch(()=>toast('请从地址栏复制链接'));}
    else toast('请从地址栏复制链接');
  }

  function renderFavorites(){
    document.title='收藏夹｜一班集';
    window._currentRead=null;
    const arts=favoriteArticles();
    const rows=arts.map((a,i)=>{
      const u=unitLabel(a);
      return `<div class="favorite-list-row" data-favorite-row="${a.id}"><a class="favorite-list-main" href="${routeFor(a)}"><span class="idx">${String(i+1).padStart(2,'0')}</span><span class="favorite-list-copy"><strong>${titleHTML(a)}</strong><small>${esc(a.author||'')} · ${esc(a.category)} · ${u?u+' · ':''}${fmtChars(a.chars)}</small></span><span class="favorite-list-arrow">→</span></a><button class="favorite-remove" data-favorite-remove="${a.id}" aria-label="取消收藏《${esc(a.title)}》">取消收藏</button></div>`;
    }).join('');
    const empty=`<div class="favorites-page-empty"><div>☆</div><h2>收藏夹还是空的</h2><p>在任何文章阅读页点击“收藏”，文章就会出现在这里，并在目录中显示星标。</p><a href="#/home">返回目录</a></div>`;
    app.innerHTML=`<section class="favorites-page"><nav class="page-breadcrumb"><a href="#/home">一班集</a><span>／</span><strong>收藏夹</strong></nav><header class="favorites-page-head"><div><span>BOOKMARKS</span><h1>收藏夹</h1></div><p>${arts.length} 篇</p></header>${arts.length?`<div class="favorites-page-list">${rows}</div>`:empty}</section>`;
    $$('[data-favorite-remove]').forEach(btn=>btn.addEventListener('click',()=>{
      FAVORITES.remove(btn.dataset.favoriteRemove);
      updateFavoriteBadge();
      toast('已取消收藏');
      renderFavorites();
    }));
    window.scrollTo(0,0); updateProgress(); renderDrawer({type:'favorites'});
  }

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
  function router(){
    const r=parseRoute();
    if(r.type==='read') renderArticle(r.id,r.chapter||1,false,r.resume,r.section||0);
    else if(r.type==='section') renderSection(r.name);
    else if(r.type==='favorites') renderFavorites();
    else renderHome();
    closeDrawer();closeSearch();
  }

  // search
  const searchPanel=$('#search-panel'), searchInput=$('#search-input'), results=$('#search-results');
  function articleText(a){return a.kind==='novel'?a.chapters.map(c=>c.title+' '+c.body.join(' ')).join(' '):a.body.join(' ')}
  function search(q){
    q=q.trim(); if(!q){results.innerHTML='<div class="search-empty">输入关键词</div>';return}
    const low=q.toLowerCase(); const hits=[];
    for(const a of BOOK.articles){
      const hay=(a.title+' '+a.author+' '+a.category+' '+articleText(a)).toLowerCase();
      const at=hay.indexOf(low); if(at<0)continue;
      const raw=articleText(a); let snippet=''; const idx=raw.toLowerCase().indexOf(low);
      if(idx>=0)snippet=raw.slice(Math.max(0,idx-42),idx+q.length+78).replace(/\s+/g,' ');
      const titleHit=a.title.includes(q)||a.author.includes(q); hits.push({a,score:titleHit?0:1,snippet});
    }
    hits.sort((x,y)=>x.score-y.score||x.a.order-y.a.order);
    results.innerHTML=hits.slice(0,40).map(({a,snippet})=>`<a class="search-item" href="${routeFor(a)}"><strong>${titleHTML(a)}${favoriteMark(a,'search-fav-mark')}</strong><span class="smeta">${esc(a.author)} · ${esc(a.category)}</span>${snippet?`<p>${esc(snippet)}</p>`:''}</a>`).join('') || '<div class="search-empty">没有找到</div>';
  }
  function openSearch(){searchPanel.classList.add('open');document.body.classList.add('search-open');setTimeout(()=>searchInput.focus(),10);search('')}
  function closeSearch(){searchPanel.classList.remove('open');document.body.classList.remove('search-open');searchInput.value='';results.innerHTML=''}
  $('#search-btn').addEventListener('click',openSearch);$('#search-close').addEventListener('click',closeSearch);searchPanel.addEventListener('click',e=>{if(e.target===searchPanel)closeSearch()});searchInput.addEventListener('input',e=>search(e.target.value));

  // drawer
  const drawer=$('#drawer'), backdrop=$('#drawer-backdrop');
  function openDrawer(){renderDrawer(currentRoute());drawer.classList.add('open');backdrop.classList.add('open');const cur=$('.drawer-sub-link.current',drawer)||$('.drawer-work-link.current',drawer)||$('.drawer-work-main.current',drawer);if(cur)setTimeout(()=>{drawer.scrollTop=Math.max(0,cur.offsetTop-drawer.clientHeight*0.35)},0)}
  function closeDrawer(){drawer.classList.remove('open');backdrop.classList.remove('open')}
  $('#menu-btn').addEventListener('click',openDrawer);backdrop.addEventListener('click',closeDrawer);

  // settings/theme
  $('#theme-btn').addEventListener('click',()=>{state.theme=state.theme==='light'?'dark':'light';localStorage.setItem('yb_theme',state.theme);document.documentElement.dataset.theme=state.theme});
  const settings=$('#settings-panel');$('#settings-btn').addEventListener('click',e=>{e.stopPropagation();settings.classList.toggle('open')});document.addEventListener('click',e=>{if(!settings.contains(e.target) && e.target!==$('#settings-btn'))settings.classList.remove('open')});
  $$('[data-font]',settings).forEach(b=>b.addEventListener('click',()=>{state.font=Math.max(-3,Math.min(5,state.font + (+b.dataset.font)));localStorage.setItem('yb_font',state.font);applyReadingPrefs()}));
  $$('[data-line]',settings).forEach(b=>b.addEventListener('click',()=>{state.line=b.dataset.line;localStorage.setItem('yb_line',state.line);applyReadingPrefs()}));
  $$('[data-width]',settings).forEach(b=>b.addEventListener('click',()=>{state.width=b.dataset.width;localStorage.setItem('yb_width',state.width);applyReadingPrefs()}));
  $('#reset-reading').addEventListener('click',()=>{state.font=0;state.line='normal';state.width='normal';['yb_font','yb_line','yb_width'].forEach(k=>localStorage.removeItem(k));applyReadingPrefs();toast('已恢复默认')});

  // progress + scroll persistence
  function updateProgress(){
    const max=document.documentElement.scrollHeight-innerHeight;const p=max>0?scrollY/max:0;$('#scroll-progress').style.width=`${Math.max(0,Math.min(1,p))*100}%`;
  }
  let scrollTimer=null;window.addEventListener('scroll',()=>{updateProgress();if(window._currentRead){clearTimeout(scrollTimer);scrollTimer=setTimeout(()=>localStorage.setItem(window._currentRead.savedKey,scrollY),120)}} ,{passive:true});
  window.addEventListener('beforeunload',()=>{if(window._currentRead)localStorage.setItem(window._currentRead.savedKey,scrollY)});
  window.addEventListener('hashchange',router);
  document.addEventListener('keydown',e=>{
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openSearch()}
    if(e.key==='Escape'){closeSearch();closeDrawer();settings.classList.remove('open')}
    if(window._currentRead && window._currentRead.a.kind==='novel' && !searchPanel.classList.contains('open') && ['ArrowLeft','ArrowRight'].includes(e.key)){
      const {a,chapter}=window._currentRead; if(e.key==='ArrowLeft'&&chapter>1)location.hash=routeFor(a,chapter-1).slice(1); if(e.key==='ArrowRight'&&chapter<a.chapters.length)location.hash=routeFor(a,chapter+1).slice(1);
    }
  });

  router();
})();
