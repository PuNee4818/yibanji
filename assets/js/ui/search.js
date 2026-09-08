/* ============================================================
   一班集 · ui/search.js —— 搜索浮层
   ============================================================ */
(function(){
  'use strict';
  const YB = window.YB;
  const {$, esc, titleHTML, routeFor, favoriteMark} = YB;
  const searchPanel=$('#search-panel'), searchInput=$('#search-input'), results=$('#search-results');

  function articleText(a){return a.kind==='novel'?a.chapters.map(c=>c.title+' '+c.body.join(' ')).join(' '):a.body.join(' ')}

  function search(q){
    q=q.trim(); if(!q){results.innerHTML='<div class="search-empty">输入关键词</div>';return}
    const low=q.toLowerCase(); const hits=[];
    for(const a of YB.BOOK.articles){
      const raw=articleText(a);
      const hay=(a.title+' '+a.author+' '+a.category+' '+raw).toLowerCase();
      const at=hay.indexOf(low); if(at<0)continue;
      let snippet=''; const idx=raw.toLowerCase().indexOf(low);
      if(idx>=0)snippet=raw.slice(Math.max(0,idx-42),idx+q.length+78).replace(/\s+/g,' ');
      const titleHit=a.title.includes(q)||a.author.includes(q); hits.push({a,score:titleHit?0:1,snippet});
    }
    hits.sort((x,y)=>x.score-y.score||x.a.order-y.a.order);
    results.innerHTML=hits.slice(0,40).map(({a,snippet},i)=>`<a class="search-item enter" style="animation-delay:${Math.min(i,12)*26}ms" href="${routeFor(a)}"><strong>${titleHTML(a)}${favoriteMark(a,'search-fav-mark')}</strong><span class="smeta">${esc(a.author)} · ${esc(a.category)}</span>${snippet?`<p>${esc(snippet)}</p>`:''}</a>`).join('') || '<div class="search-empty">没有找到</div>';
  }
  function openSearch(){searchPanel.classList.add('open');document.body.classList.add('search-open');setTimeout(()=>searchInput.focus(),10);search('')}
  function closeSearch(){searchPanel.classList.remove('open');document.body.classList.remove('search-open');searchInput.value='';results.innerHTML=''}

  $('#search-btn').addEventListener('click',openSearch);
  $('#search-close').addEventListener('click',closeSearch);
  searchPanel.addEventListener('click',e=>{if(e.target===searchPanel)closeSearch()});
  searchInput.addEventListener('input',e=>search(e.target.value));

  YB.openSearch = openSearch;
  YB.closeSearch = closeSearch;
})();
