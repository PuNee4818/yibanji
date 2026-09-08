/* ============================================================
   一班集 · render/home.js —— 首页（封面 / 刊头带 / 收藏条 / 目录）
   ============================================================ */
(function(){
  'use strict';
  const YB = window.YB;
  const {BOOK, $, esc, titleHTML, routeFor, resumeRoute, fmtChars, unitLabel, rev, isFavorite, favoriteArticles, lastRead, updateProgress, setupReveal} = YB;

  function renderHomeFavorites(){
    const arts=favoriteArticles();
    if(!arts.length){
      return `<section class="favorites-home"><div class="favorites-home-head"><div><span class="favorites-kicker">收 藏</span><h2>收藏夹</h2></div><a href="#/favorites">打开收藏夹 →</a></div><div class="favorites-empty-home"><span>☆</span><p>还没有收藏文章。阅读时点击"收藏"后，会在这里留下书签。</p></div></section>`;
    }
    const cards=arts.slice(0,6).map(a=>`<a class="favorite-mini-card" href="${routeFor(a)}"><span class="favorite-mini-star">★</span><div><h3>${titleHTML(a)}</h3><p>${esc(a.author||'')} · ${esc(a.category)}</p></div><span class="favorite-mini-arrow">→</span></a>`).join('');
    return `<section class="favorites-home"><div class="favorites-home-head"><div><span class="favorites-kicker">收 藏 · ${arts.length}</span><h2>我的收藏</h2></div><a href="#/favorites">查看全部 →</a></div><div class="favorites-home-grid">${cards}</div></section>`;
  }

  function renderHome(){
    document.title='一班集';
    window._currentRead=null;
    YB.markTopNav('');
    const lr=lastRead();
    let cont='';
    if(lr && YB.articleMap[lr.id]){
      const a=YB.articleMap[lr.id], ch=a.kind==='novel'?(lr.chapter||1):null;
      const suffix=ch?` · 第${ch}章`:'';
      cont=`<a class="continue-link" href="${resumeRoute(a,ch)}"><em>续读</em><span>《${esc(a.title)}》${suffix}</span><i>→</i></a>`;
    }
    const categoryBlocks=BOOK.categories.map((c,ci)=>{
      const arts=c.articles.map(id=>YB.articleMap[id]).filter(Boolean);
      return `<div class="category-break"${YB.sealAttr(c.name)}${rev(ci,45,4)}><span class="num">${String(ci+1).padStart(2,'0')}</span><h2>${esc(c.name)}</h2><div class="line"></div></div>`+arts.map((a,ai)=>{
        const featured=a.id==='tianhuaban';
        const u=unitLabel(a); const meta=`${u?u+' · ':''}${fmtChars(a.chars)}`;
        const fav=isFavorite(a);
        return `<a class="work-card ${featured?'featured':''} ${fav?'is-favorite':''}"${YB.sealAttr(c.name)}${rev(ai)} href="${routeFor(a)}">${fav?'<span class="work-favorite-mark">★ 已收藏</span>':''}<div class="card-no">${String(ai+1).padStart(2,'0')} / ${String(arts.length).padStart(2,'0')}</div><h3>${titleHTML(a)}</h3><div class="card-by">${esc(a.author||'')}</div><div class="card-meta">${meta}</div></a>`;
      }).join('')
    }).join('');
    // 刊头规则带：只有文字与统计，印章装饰已按设计删去
    const masthead=`<div class="masthead"><div class="masthead-rule"${rev(0,0)}><span class="mr-text">本刊目录</span><span class="mr-meta">凡 ${BOOK.articles.length} 篇 · ${BOOK.categories.length} 卷</span></div></div>`;
    $('#app').innerHTML=`<section class="hero"><div class="hero-grid"><div class="cover-block"${rev(0,0)}><div><div class="issue-kicker">卷首语</div><h1 class="cover-title">一班集</h1></div><div><div class="cover-meta"><span>第二版</span><span>${BOOK.articles.length} 篇</span><span>${BOOK.categories.length} 卷</span></div>${cont}</div></div><div class="dedication"${rev(2,80)}><div class="dedication-mark">※</div>${BOOK.dedication.map(x=>`<p>${esc(x)}</p>`).join('')}</div></div></section>${masthead}${renderHomeFavorites()}<section class="section-index"><div class="section-heading"><h2>目录</h2><span class="count">凡 ${BOOK.articles.length} 篇</span></div><div class="mag-grid">${categoryBlocks}</div></section>`;
    window.scrollTo(0,0); updateProgress(); YB.renderDrawer({type:'home'}); setupReveal();
  }

  YB.renderHomeFavorites = renderHomeFavorites;
  YB.renderHome = renderHome;
})();
