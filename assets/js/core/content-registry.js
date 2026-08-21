/* Content registry: validates and assembles modular work files. */
(function(global){
  'use strict';
  const records = new Map();
  const chapterIds = new Map();
  const fail = (message) => { throw new Error(`[一班集·内容校验] ${message}`); };

  function register(article){
    if(!article || typeof article !== 'object') fail('文章数据不是对象');
    if(!article.id) fail('文章缺少 id');
    if(!article.title) fail(`${article.id} 缺少标题`);
    if(records.has(article.id)) fail(`文章 id 重复：${article.id}`);
    const normalized = {...article};
    if(normalized.kind === 'novel' && !Array.isArray(normalized.chapters)) normalized.chapters=[];
    records.set(normalized.id, normalized);
  }

  function registerChapter(articleId, chapter){
    const article=records.get(articleId);
    if(!article) fail(`章节所属文章尚未注册：${articleId}`);
    if(article.kind !== 'novel') fail(`${articleId} 不是章节型长篇`);
    if(!chapter || !chapter.title || !Array.isArray(chapter.body)) fail(`${articleId} 存在无效章节`);
    const seen=chapterIds.get(articleId) || new Set();
    const key=String(chapter.index ?? chapter.title);
    if(seen.has(key)) fail(`${articleId} 章节重复：${key}`);
    seen.add(key); chapterIds.set(articleId,seen);
    article.chapters.push({...chapter});
  }

  function finalize(meta){
    if(!meta || !Array.isArray(meta.categories)) fail('书籍元数据缺失');
    const expected=[];
    meta.categories.forEach(category=>{
      (category.articles||[]).forEach(id=>expected.push({id,category:category.name}));
    });
    const expectedIds=new Set(expected.map(x=>x.id));
    expected.forEach(({id,category})=>{
      const a=records.get(id);
      if(!a) fail(`目录引用了未加载文章：${id}`);
      if(a.category !== category) fail(`${id} 的卷目为「${a.category}」，目录要求「${category}」`);
    });
    records.forEach((a,id)=>{ if(!expectedIds.has(id)) fail(`文章未出现在目录：${id}`); });
    records.forEach(a=>{
      if(a.kind==='novel'){
        a.chapters.sort((x,y)=>(x.index||0)-(y.index||0));
        a.chapters.forEach((c,i)=>{ if(c.index==null) c.index=i+1; });
      }
    });
    const articles=[...records.values()].sort((a,b)=>(a.order||0)-(b.order||0));
    return {...meta,articles};
  }

  global.YB_CONTENT=Object.freeze({register,registerChapter,finalize,count:()=>records.size});
})(window);
