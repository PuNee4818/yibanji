/* ============================================================
   一班集 · render/reader.js —— 阅读页（左栏 / 右栏 / 篇章 / 长篇章节）
   ============================================================ */
(function(){
  'use strict';
  const YB = window.YB;
  const {$, $$, esc, titleHTML, routeFor, fmtChars, unitLabel, rev, favoriteMark, categoryIndex, sealAttr, getSections, updateProgress, setupReveal} = YB;

  let lastNovelChapter=null;

  /* ---------- 左栏：本卷作品树 ---------- */
  function railWork(a,currentA,chapter,section){
    const sections=getSections(a); const active=a.id===currentA.id;
    const key=`rail:${a.id}`; const open=active || YB.state.railOpen.has(key);
    if(!sections.length){ return `<div class="rail-work simple"><a class="rail-work-main ${active?'current':''}" href="${routeFor(a)}">${titleHTML(a)}${favoriteMark(a,'rail-fav-mark')}</a></div>`; }
    const subs=sections.map(s=>{
      const cur=active && (a.kind==='novel'?chapter:section)===s.index;
      return `<a class="rail-sub-link ${cur?'current':''}" href="${routeFor(a,s.index)}"><span>${String(s.index).padStart(2,'0')}</span><em>${esc(s.title)}</em></a>`;
    }).join('');
    return `<div class="rail-work ${open?'open':''}" data-rail-work="${a.id}"><div class="rail-work-row"><button class="tree-toggle" data-rail-toggle="${a.id}" aria-label="展开或收起《${esc(a.title)}》章节" aria-expanded="${open}">⌄</button><a class="rail-work-main ${active?'current':''}" href="${routeFor(a)}">${titleHTML(a)}${favoriteMark(a,'rail-fav-mark')}</a><small>${unitLabel(a)}</small></div><div class="rail-sublist">${subs}</div></div>`;
  }

  function readingRail(a,chapter,section){
    const cat=YB.catMap[a.category];
    const catArts=cat.articles.map(id=>YB.articleMap[id]).filter(Boolean);
    return `<aside class="left-rail"><div class="rail-nav"><a class="rail-back" href="#/section/${encodeURIComponent(a.category)}">← ${esc(a.category)}目录</a><a class="rail-all" href="#/home">一班集总目录</a></div><div class="rail-label">本卷作品</div><div class="rail-tree">${catArts.map(x=>railWork(x,a,chapter,section)).join('')}</div></aside>`;
  }

  function bindRailToggles(){
    $$('[data-rail-toggle]').forEach(btn=>btn.addEventListener('click',e=>{
      e.preventDefault();e.stopPropagation();
      const id=btn.dataset.railToggle,key=`rail:${id}`;
      const wrap=btn.closest('.rail-work'); const next=!wrap.classList.contains('open');
      wrap.classList.toggle('open',next); btn.setAttribute('aria-expanded',String(next));
      if(next) YB.state.railOpen.add(key); else YB.state.railOpen.delete(key);
    }));
  }

  /* ---------- 右栏：竖排"书口"工具条 ---------- */
  function rightRail(a){
    const fav=YB.isFavorite(a);
    return `<aside class="right-rail"><div class="rail-vertical">
      <button id="fav-btn" class="rail-tool ${fav?'fav-active':''}" title="收藏此篇"><span class="rt-glyph">${fav?'★':'☆'}</span><span class="rt-label">收藏</span></button>
      <button id="export-btn" class="rail-tool" title="导出 PDF"><span class="rt-glyph">印</span><span class="rt-label">导出</span></button>
      <button id="immerse-btn" class="rail-tool" title="沉浸模式"><span class="rt-glyph">隐</span><span class="rt-label">沉浸</span></button>
      <button id="copy-btn" class="rail-tool" title="复制链接"><span class="rt-glyph">链</span><span class="rt-label">分享</span></button>
    </div></aside>`;
  }

  function breadcrumb(a,chapter,section){
    let tail='';
    if(a.kind==='novel') tail=`<span>／</span><strong>${esc(a.chapters[chapter-1].title)}</strong>`;
    else if(section){ const s=getSections(a)[section-1]; if(s) tail=`<span>／</span><strong>${esc(s.title)}</strong>`; }
    return `<nav class="page-breadcrumb reader-breadcrumb"><a href="#/home">一班集</a><span>／</span><a href="#/section/${encodeURIComponent(a.category)}">${esc(a.category)}</a><span>／</span><a href="${routeFor(a)}">${titleHTML(a)}</a>${tail}</nav>`;
  }

  /* ---------- 主渲染 ---------- */
  function renderArticle(id, chapter=1, fromPop=false, resume=false, section=0){
    const a=YB.articleMap[id]; if(!a){return YB.renderHome()}
    const sections=getSections(a);
    chapter=Math.max(1,Math.min(chapter,a.kind==='novel'?a.chapters.length:1));
    section=Math.max(0,Math.min(section,sections.length));
    document.title=`${a.title}｜一班集`;
    YB.saveLast(a,chapter);
    YB.markTopNav(a.category);
    const u=unitLabel(a);
    const meta = `<span>${esc(a.author||'')}</span><span>${esc(a.category)}</span><span>${u?u+' · ':''}${fmtChars(a.chars)}</span>`;
    let body='';
    if(a.kind==='novel'){
      const c=a.chapters[chapter-1];
      const prev=chapter>1?routeFor(a,chapter-1):`#/section/${encodeURIComponent(a.category)}`;
      const next=chapter<a.chapters.length?routeFor(a,chapter+1):`#/section/${encodeURIComponent(a.category)}`;
      const prevText=chapter>1?esc(a.chapters[chapter-2].title):esc(a.category);
      const nextText=chapter<a.chapters.length?esc(a.chapters[chapter].title):esc(a.category);
      const map=a.chapters.map((ch,i)=>`<a class="cm-dot ${i+1===chapter?'current':''}" href="${routeFor(a,i+1)}" aria-label="第 ${i+1} 章 ${esc(ch.title)}" title="第 ${i+1} 章 · ${esc(ch.title)}">${i+1}</a>`).join('');
      body=`<div class="chapter-head" data-reveal><div class="chapter-number">${String(chapter).padStart(2,'0')}</div><div><small>第 ${chapter} / ${a.chapters.length} 章</small><h2>${esc(c.title)}</h2></div></div><nav class="chapter-map" aria-label="章节地图">${map}</nav><article class="prose-body">${c.body.map(YB.paraHTML).join('')}</article><nav class="chapter-nav"><a href="${prev}"><span>${chapter>1?'上一章':'返回本卷'}</span>${prevText}</a><a href="${next}"><span>${chapter<a.chapters.length?'下一章':'返回本卷'}</span>${nextText}</a></nav>`;
    } else {
      const dc = YB.state.dropcap && a.kind!=='verse' ? ' dropcap' : '';
      body=`<article class="prose-body ${a.kind==='verse'?'verse':''}${dc}">${YB.renderProseBody(a)}</article>`;
    }
    // 翻章方向：决定内容从哪一侧淡入
    let enterCls='';
    if(!fromPop && a.kind==='novel' && lastNovelChapter!==null && lastNovelChapter!==chapter){
      enterCls = chapter>lastNovelChapter ? ' enter-next' : ' enter-prev';
    }
    lastNovelChapter = a.kind==='novel' ? chapter : null;
    const subtitle=a.subtitle?`<div class="article-subtitle"${rev(2,80)}>${esc(a.subtitle)}</div>`:'';
    const endMatter=YB.renderEndMatter(a);
    $('#app').innerHTML=`<div class="read-shell">${readingRail(a,chapter,section)}<main class="reader${enterCls}">${breadcrumb(a,chapter,section)}<header class="article-head"${sealAttr(a.category)}><div class="article-kicker"${rev(0,0)}>${esc(a.category)} · ${String(categoryIndex(a.category)).padStart(2,'0')}</div><h1 class="article-title"${rev(1,80)}>${titleHTML(a)}</h1>${subtitle}<div class="article-meta"${rev(3,80)}>${meta}<div class="article-tools"><span class="tool-link ${YB.isFavorite(a)?'fav-active':''}" id="inline-fav">${YB.isFavorite(a)?'★ 已收藏':'☆ 收藏'}</span><span class="tool-link" id="inline-export">导出</span><span class="tool-link" id="inline-immersive">沉浸</span><span class="tool-link" id="inline-copy">分享</span></div></div></header>${body}${endMatter}</main>${rightRail(a)}</div>`;
    const bind=(sel,fn)=>{const el=$(sel);if(el)el.addEventListener('click',fn)};
    bind('#fav-btn',()=>YB.toggleFav(a.id));bind('#inline-fav',()=>YB.toggleFav(a.id));
    bind('#copy-btn',YB.copyLink);bind('#inline-copy',YB.copyLink);
    bind('#export-btn',()=>YB.openPrint(a));bind('#inline-export',()=>YB.openPrint(a));
    bind('#immerse-btn',()=>YB.setImmersive(true));bind('#inline-immersive',()=>YB.setImmersive(true));
    bindRailToggles(); YB.renderDrawer({type:'read',id:a.id,chapter,section});
    YB.refreshImmersiveUI(a,chapter,section);
    const rail=$('.left-rail'); const railCurrent=rail && $('.rail-sub-link.current',rail);
    if(rail && railCurrent) rail.scrollTop=Math.max(0,railCurrent.offsetTop-rail.clientHeight*0.42);
    if(!fromPop){window.scrollTo(0,0)}
    updateProgress(); setupReveal();
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

  YB.renderArticle = renderArticle;
})();
