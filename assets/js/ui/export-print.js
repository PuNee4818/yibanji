/* ============================================================
   一班集 · ui/export-print.js —— 导出 PDF（打印）
   ============================================================ */
(function(){
  'use strict';
  const YB = window.YB;
  const {$, esc, titleHTML, categoryIndex} = YB;

  function printHead(a){
    return `<header class="p-head"><div class="p-kicker">一班集 · 第二版｜${esc(a.category)} · ${String(categoryIndex(a.category)).padStart(2,'0')}</div><h1>${titleHTML(a)}</h1>${a.subtitle?`<div class="p-sub">${esc(a.subtitle)}</div>`:''}<div class="p-authorline">${esc(a.author||'')}</div></header>`;
  }
  function openPrint(a){
    const root=$('#print-root');
    let inner=printHead(a);
    if(a.kind==='novel'){
      inner+=a.chapters.map(c=>`<section class="p-chapter"><header class="chapter-head"><div class="chapter-number">${String(c.index).padStart(2,'0')}</div><div><small>第 ${c.index} 章 · 共 ${a.chapters.length} 章</small><h2>${esc(c.title)}</h2></div></header><article class="prose-body">${c.body.map(YB.paraHTML).join('')}</article></section>`).join('');
    }else{
      inner+=`<article class="prose-body ${a.kind==='verse'?'verse':''}">${YB.renderProseBody(a)}</article>${YB.renderEndMatter(a)}`;
    }
    root.innerHTML=`<div class="print-doc">${inner}</div>`;
    const cleanup=()=>{
      document.body.classList.remove('printing');
      root.innerHTML='';
      window.removeEventListener('afterprint',cleanup);
    };
    window.addEventListener('afterprint',cleanup);
    document.body.classList.add('printing');
    YB.toast('在打印面板中选择"另存为 PDF"即可下载');
    setTimeout(()=>window.print(),80);
  }

  YB.openPrint = openPrint;
})();
