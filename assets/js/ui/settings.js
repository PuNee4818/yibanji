/* ============================================================
   一班集 · ui/settings.js —— 阅读设置 / 纸色 / 主题切换
   ============================================================ */
(function(){
  'use strict';
  const YB = window.YB;
  const {state, $} = YB;
  const settings=$('#settings-panel');

  function applyReadingPrefs(){
    const root=document.documentElement;
    root.style.setProperty('--reading-size', `${19 + state.font}px`);
    const line = state.line==='compact'?1.72:state.line==='loose'?2.16:1.95;
    root.style.setProperty('--reading-line', line);
    const width = state.width==='narrow'?650:state.width==='wide'?880:760;
    root.style.setProperty('--reading-width', `${width}px`);
    const face = state.face==='kai' ? 'var(--kai)' : state.face==='sans' ? 'var(--ui)' : 'var(--serif)';
    root.style.setProperty('--body-font', face);
    root.dataset.paper = state.paper;
    const meta=document.querySelector('meta[name="theme-color"]');
    if(meta) meta.setAttribute('content', state.theme==='dark' ? '#181510'
      : state.paper==='xuan' ? '#faf7f0' : state.paper==='sepia' ? '#efe1c2' : '#f3ecdb');
    syncSettingButtons();
  }
  function syncSettingButtons(){
    const s=settings; if(!s) return;
    YB.$$('[data-line]',s).forEach(b=>b.classList.toggle('active',b.dataset.line===state.line));
    YB.$$('[data-width]',s).forEach(b=>b.classList.toggle('active',b.dataset.width===state.width));
    YB.$$('[data-face]',s).forEach(b=>b.classList.toggle('active',b.dataset.face===state.face));
    YB.$$('[data-paper]',s).forEach(b=>b.classList.toggle('active',b.dataset.paper===state.paper));
    const dc=$('#toggle-dropcap');
    if(dc){ dc.textContent=state.dropcap?'开':'关'; dc.classList.toggle('active',state.dropcap); }
  }
  function toggleTheme(){
    state.theme=state.theme==='light'?'dark':'light';
    localStorage.setItem('yb_theme',state.theme);
    document.documentElement.dataset.theme=state.theme;
    applyReadingPrefs();
  }

  $('#theme-btn').addEventListener('click',toggleTheme);
  $('#settings-btn').addEventListener('click',e=>{e.stopPropagation();settings.classList.toggle('open')});
  document.addEventListener('click',e=>{
    const trigger=e.target===$('#settings-btn')||e.target.closest?.('#imx-settings');
    if(!trigger && !settings.contains(e.target)) settings.classList.remove('open');
  });
  YB.$$('[data-font]',settings).forEach(b=>b.addEventListener('click',()=>{state.font=Math.max(-3,Math.min(5,state.font + (+b.dataset.font)));localStorage.setItem('yb_font',state.font);applyReadingPrefs()}));
  YB.$$('[data-line]',settings).forEach(b=>b.addEventListener('click',()=>{state.line=b.dataset.line;localStorage.setItem('yb_line',state.line);applyReadingPrefs()}));
  YB.$$('[data-width]',settings).forEach(b=>b.addEventListener('click',()=>{state.width=b.dataset.width;localStorage.setItem('yb_width',state.width);applyReadingPrefs()}));
  YB.$$('[data-face]',settings).forEach(b=>b.addEventListener('click',()=>{state.face=b.dataset.face;localStorage.setItem('yb_face',state.face);applyReadingPrefs()}));
  YB.$$('[data-paper]',settings).forEach(b=>b.addEventListener('click',()=>{state.paper=b.dataset.paper;localStorage.setItem('yb_paper',state.paper);applyReadingPrefs()}));
  $('#toggle-dropcap').addEventListener('click',()=>{
    state.dropcap=!state.dropcap;
    state.dropcap?localStorage.removeItem('yb_dropcap'):localStorage.setItem('yb_dropcap','off');
    applyReadingPrefs();
    const cur=window._currentRead; if(cur) YB.renderArticle(cur.a.id,cur.chapter,true,false,cur.section||0);
  });
  $('#reset-reading').addEventListener('click',()=>{state.font=0;state.line='normal';state.width='normal';state.face='serif';state.paper='rice';state.dropcap=true;['yb_font','yb_line','yb_width','yb_face','yb_paper','yb_dropcap'].forEach(k=>localStorage.removeItem(k));applyReadingPrefs();const cur=window._currentRead;if(cur)YB.renderArticle(cur.a.id,cur.chapter,true,false,cur.section||0);YB.toast('已恢复默认')});
  $('#enter-immersive').addEventListener('click',()=>{settings.classList.remove('open');YB.setImmersive(true)});

  YB.applyReadingPrefs = applyReadingPrefs;
  YB.syncSettingButtons = syncSettingButtons;
  YB.toggleTheme = toggleTheme;
})();
