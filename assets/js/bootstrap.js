/* Bootstrap: validate assembled modular content before the reader starts. */
(function(){
  'use strict';
  try{
    const manifest=window.YB_CONTENT_MANIFEST;
    window.BOOK_DATA=window.YB_CONTENT.finalize(window.YB_BOOK_META);
    if(window.BOOK_DATA.articles.length!==manifest.expectedArticles){
      throw new Error(`文章数量校验失败：${window.BOOK_DATA.articles.length}/${manifest.expectedArticles}`);
    }
    document.documentElement.dataset.appReady='true';
  }catch(err){
    console.error(err);
    window.YB_BOOT_ERROR=err;
    document.addEventListener('DOMContentLoaded',()=>{
      const app=document.getElementById('app');
      if(app) app.innerHTML=`<section class="fatal-error"><h1>内容加载失败</h1><p>${String(err.message||err)}</p><p>请确认网页文件夹结构完整，不要只复制 index.html。</p></section>`;
    });
  }
})();
