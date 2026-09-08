/* ============================================================
   一班集 · core/context.js —— 全局命名空间与共享基础
   状态 / 数据索引 / 收藏 / 工具函数 / 入场动效 / 进度条
   模块间通过 window.YB 通信；跨模块引用一律在调用时经 YB 解析，
   因此各模块的加载顺序只要求：context 最先、app.js 最后。
   ============================================================ */
window.YB = (function(){
  'use strict';
  const BOOK = window.BOOK_DATA;
  const $ = (s,root=document)=>root.querySelector(s);
  const $$ = (s,root=document)=>[...root.querySelectorAll(s)];
  const FAVORITES = window.YB_FAVORITES;
  if(!FAVORITES) throw new Error('收藏模块未加载');
  FAVORITES.prune(BOOK.articles.map(a=>a.id));

  const articleMap = Object.fromEntries(BOOK.articles.map(a=>[a.id,a]));
  const catMap = Object.fromEntries(BOOK.categories.map(c=>[c.name,c]));

  const state = {
    theme: localStorage.getItem('yb_theme') || 'light',
    font: +(localStorage.getItem('yb_font') || 0),
    line: localStorage.getItem('yb_line') || 'normal',
    width: localStorage.getItem('yb_width') || 'normal',
    face: localStorage.getItem('yb_face') || 'serif',
    paper: localStorage.getItem('yb_paper') || 'rice',
    dropcap: localStorage.getItem('yb_dropcap') !== 'off',
    railOpen: new Set(),
    immersive: false
  };

  // 个别作品使用无编号的小标题。这里仅登记原文确有的小标题，不人工拆段。
  const MANUAL_SECTION_TITLES = BOOK.sectionHints || {};

  /* ---------- 分卷印色与卷别水印字 ---------- */
  const VOLUME_SEAL = {
    '卷首':{key:'shou',ch:'首'},'故园':{key:'guyuan',ch:'故'},'笑谈':{key:'xiaotan',ch:'笑'},
    '诗笺':{key:'shijian',ch:'诗'},'志异':{key:'zhiyi',ch:'异'},'迷梦':{key:'mimeng',ch:'梦'},
    '天外':{key:'tianwai',ch:'天'},'剪刀':{key:'jiandao',ch:'剪'},'卷末':{key:'mo',ch:'末'}
  };
  const sealOf = name => VOLUME_SEAL[name] || {key:'shou',ch:'集'};
  const sealAttr = name => ` data-seal="${sealOf(name).key}"`;
  const rev = (i, step=60, cap=8) => ` data-reveal style="--d:${Math.min(i,cap)*step}ms"`;

  /* ---------- 纯工具 ---------- */
  function esc(s=''){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
  function fmtChars(n){ return n>=10000 ? `${(n/10000).toFixed(1)}万字` : `${n.toLocaleString()}字`; }
  function categoryIndex(name){return BOOK.categories.findIndex(c=>c.name===name)+1;}
  function toast(t){const el=$('#toast');el.textContent=t;el.classList.add('show');clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove('show'),1500)}
  function lastRead(){try{return JSON.parse(localStorage.getItem('yb_last')||'null')}catch{return null}}

  /* ---------- 收藏 ---------- */
  function isFavorite(aOrId){ return FAVORITES.has(typeof aOrId==='string'?aOrId:aOrId?.id); }
  function favoriteArticles(){ return FAVORITES.list().map(id=>articleMap[id]).filter(Boolean).reverse(); }
  function favoriteMark(a, cls){ return isFavorite(a) ? `<span class="${cls}" aria-label="已收藏" title="已收藏">★</span>` : ''; }
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
  /* 收藏星标弹跳 */
  function popStar(added){
    if(!added) return;
    const fire=el=>{ if(!el) return; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); setTimeout(()=>el.classList.remove('pop'),520); };
    fire($('#favorites-btn .favorites-header-icon'));
    setTimeout(()=>{ fire($('#fav-btn .rt-glyph')); fire($('#inline-fav')); },20);
  }

  /* ---------- 结构识别与小标题 ---------- */
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
  function hasVerseLeadNote(a){ return a?.kind==='verse' && Array.isArray(a.body) && /^(?:自评|题记|附记|按)[:：]/.test((a.body[0]||'').trim()); }
  function getSections(a){
    if(a.kind==='novel'){
      return a.chapters.map((c,i)=>({index:i+1,title:c.title,bodyIndex:null,kind:'chapter'}));
    }
    if(!a.body) return [];
    const manual=MANUAL_SECTION_TITLES[a.id];
    const out=[];
    a.body.forEach((p,i)=>{
      const t=(p||'').trim();
      if(manual?.includes(t) || numberedSectionLine(t)) out.push({index:out.length+1,title:sectionTitleFromLine(t),bodyIndex:i,kind:'anchor'});
    });
    return out.length>=2 ? out : [];
  }
  function isStructured(a){return getSections(a).length>0;}
  function unitLabel(a){
    const n=getSections(a).length;
    if(!n) return '';
    return a.kind==='novel'?`${n}章`:`${n}节`;
  }

  /* ---------- 路由与进度 ---------- */
  function routeFor(a, part){
    if(a.kind==='novel') return `#/read/${a.id}/${part||1}`;
    if(part && isStructured(a)) return `#/read/${a.id}/section/${part}`;
    return `#/read/${a.id}`;
  }
  function resumeRoute(a,chapter=1){ return a.kind==='novel' ? `${routeFor(a,chapter)}/resume` : `${routeFor(a)}/resume`; }
  function saveLast(a,chapter=1){localStorage.setItem('yb_last', JSON.stringify({id:a.id,chapter:a.kind==='novel'?chapter:1,ts:Date.now()}));}
  function updateProgress(){
    const max=document.documentElement.scrollHeight-innerHeight;const p=max>0?scrollY/max:0;
    const bar=$('#scroll-progress');
    bar.style.width=`${Math.max(0,Math.min(1,p))*100}%`;
    bar.classList.toggle('pulse', p>0.995);
  }

  /* ---------- 入场动效 ---------- */
  let revealObserver=null;
  function setupReveal(root=document){
    const nodes=$$('[data-reveal]',root).filter(el=>!el.classList.contains('revealed'));
    if(!nodes.length) return;
    if(!('IntersectionObserver' in window)){ nodes.forEach(el=>el.classList.add('revealed')); return; }
    if(!revealObserver){
      revealObserver=new IntersectionObserver((entries,obs)=>{
        entries.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('revealed'); obs.unobserve(e.target); } });
      },{threshold:.1,rootMargin:'0px 0px -6% 0px'});
    }
    nodes.forEach(el=>revealObserver.observe(el));
    // 自愈：若观察器因故未触发，凡已进入视口的元素一律补上，杜绝内容永久隐藏
    setTimeout(()=>{
      $$('[data-reveal]',root).forEach(el=>{
        if(el.classList.contains('revealed')) return;
        const r=el.getBoundingClientRect();
        if(r.top < innerHeight && r.bottom > 0) el.classList.add('revealed');
      });
    },900);
  }
  window.addEventListener('beforeprint',()=>$$('[data-reveal]').forEach(el=>el.classList.add('revealed')));

  return {
    BOOK,$,$$,state,FAVORITES,articleMap,catMap,
    VOLUME_SEAL,sealOf,sealAttr,rev,
    esc,fmtChars,categoryIndex,toast,lastRead,
    isFavorite,favoriteArticles,favoriteMark,updateFavoriteBadge,popStar,
    numberedSectionLine,sectionTitleFromLine,titleHTML,hasInlinePreface,hasVerseLeadNote,
    getSections,isStructured,unitLabel,routeFor,resumeRoute,saveLast,
    updateProgress,setupReveal
  };
})();
