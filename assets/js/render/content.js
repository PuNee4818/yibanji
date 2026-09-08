/* ============================================================
   一班集 · render/content.js —— 正文渲染（段落 / 小标题 / 注释落款）
   ============================================================ */
(function(){
  'use strict';
  const YB = window.YB;
  const {esc, getSections, numberedSectionLine, hasInlinePreface, hasVerseLeadNote, sealAttr} = YB;

  function paraHTML(p){return `<p class="${numberedSectionLine(p)?'section-line':''}">${esc(p)}</p>`}

  function renderProseBody(a){
    const sections=getSections(a);
    const byIndex=new Map(sections.map(s=>[s.bodyIndex,s]));
    const prefaced=hasInlinePreface(a);
    const leadNote=hasVerseLeadNote(a);
    return a.body.map((p,i)=>{
      const s=byIndex.get(i);
      if(s){
        return `<h2 class="story-section-title" id="story-section-${a.id}-${s.index}" data-section-index="${s.index}" data-reveal><span>${esc(s.title)}</span></h2>`;
      }
      if((prefaced || leadNote) && i===0){
        return `<p class="work-preface${leadNote?' work-author-note':''}">${esc(p)}</p>`;
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
      html += `<footer class="work-colophon"${sealAttr(a.category)}><div>${a.colophon.signature?`<div class="colophon-signature">${esc(a.colophon.signature)}</div>`:''}${a.colophon.date?`<div class="colophon-date">${esc(a.colophon.date)}</div>`:''}</div><span class="seal seal-name colophon-seal">印</span></footer>`;
    }
    return html;
  }

  YB.paraHTML = paraHTML;
  YB.renderProseBody = renderProseBody;
  YB.renderEndMatter = renderEndMatter;
})();
