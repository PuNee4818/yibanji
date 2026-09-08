/* ============================================================
   一班集 · render/section.js —— 卷目页
   ============================================================ */
(function(){
  'use strict';
  const YB = window.YB;
  const {$, esc, titleHTML, routeFor, fmtChars, unitLabel, rev, favoriteMark, categoryIndex} = YB;

  function renderSection(name){
    const c=YB.catMap[name]; if(!c){return YB.renderHome()}
    window._currentRead=null;
    YB.markTopNav(name);
    const arts=c.articles.map(id=>YB.articleMap[id]).filter(Boolean);
    document.title=`${name}｜一班集`;
    const s=YB.sealOf(name);
    $('#app').innerHTML=`<section class="section-page"><nav class="page-breadcrumb"><a href="#/home">一班集</a><span>／</span><strong>${esc(name)}</strong></nav><header class="section-page-head"${YB.sealAttr(name)}><div${rev(0,0)}><h1>${esc(name)}</h1></div><div${rev(1,70)}><p>${String(categoryIndex(name)).padStart(2,'0')}</p><span class="seal seal-oval" style="margin-top:14px">${s.ch}</span></div></header><div class="section-list">${arts.map((a,i)=>{const u=unitLabel(a);return `<a${rev(i,35,10)} href="${routeFor(a)}"><span class="idx">${String(i+1).padStart(2,'0')}</span><span class="ttl">${titleHTML(a)}${favoriteMark(a,'section-fav-mark')}</span><span class="auth">${esc(a.author||'')}</span><span class="len">${u?u+' · ':''}${fmtChars(a.chars)}</span></a>`}).join('')}</div></section>`;
    window.scrollTo(0,0); YB.updateProgress(); YB.renderDrawer({type:'section',name}); YB.setupReveal();
  }

  YB.renderSection = renderSection;
})();
