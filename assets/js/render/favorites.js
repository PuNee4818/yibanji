/* ============================================================
   一班集 · render/favorites.js —— 收藏夹页
   ============================================================ */
(function(){
  'use strict';
  const YB = window.YB;
  const {$, $$, esc, titleHTML, routeFor, fmtChars, unitLabel, rev, favoriteArticles} = YB;

  function renderFavorites(){
    document.title='收藏夹｜一班集';
    window._currentRead=null;
    YB.markTopNav('');
    const arts=favoriteArticles();
    const rows=arts.map((a,i)=>{
      const u=unitLabel(a);
      return `<div class="favorite-list-row"${rev(i,35,10)} data-favorite-row="${a.id}"><a class="favorite-list-main" href="${routeFor(a)}"><span class="idx">${String(i+1).padStart(2,'0')}</span><span class="favorite-list-copy"><strong>${titleHTML(a)}</strong><small>${esc(a.author||'')} · ${esc(a.category)} · ${u?u+' · ':''}${fmtChars(a.chars)}</small></span><span class="favorite-list-arrow">→</span></a><button class="favorite-remove" data-favorite-remove="${a.id}" aria-label="取消收藏《${esc(a.title)}》">取消收藏</button></div>`;
    }).join('');
    const empty=`<div class="favorites-page-empty"><div>☆</div><h2>收藏夹还是空的</h2><p>在任何文章阅读页点击"收藏"，文章就会出现在这里，并在目录中显示星标。</p><a href="#/home">返回目录</a></div>`;
    $('#app').innerHTML=`<section class="favorites-page"><nav class="page-breadcrumb"><a href="#/home">一班集</a><span>／</span><strong>收藏夹</strong></nav><header class="favorites-page-head"><div><span>收藏夹</span><h1>我的收藏</h1></div><p>${arts.length} 篇</p></header>${arts.length?`<div class="favorites-page-list">${rows}</div>`:empty}</section>`;
    $$('[data-favorite-remove]').forEach(btn=>btn.addEventListener('click',()=>{
      YB.FAVORITES.remove(btn.dataset.favoriteRemove);
      YB.updateFavoriteBadge();
      YB.toast('已取消收藏');
      renderFavorites();
    }));
    window.scrollTo(0,0); YB.updateProgress(); YB.renderDrawer({type:'favorites'}); YB.setupReveal();
  }

  YB.renderFavorites = renderFavorites;
})();
