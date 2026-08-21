// Usage: node tools/check-content.js
const fs=require('fs'), path=require('path'), vm=require('vm');
const ROOT=path.resolve(__dirname,'..');
const window={}; const ctx=vm.createContext({window,console});
function run(rel){vm.runInContext(fs.readFileSync(path.join(ROOT,rel),'utf8'),ctx,{filename:rel});}
run('assets/js/core/content-registry.js'); run('data/book-meta.js'); run('data/content-manifest.js');
for(const f of window.YB_CONTENT_MANIFEST.files) run(f);
const book=window.YB_CONTENT.finalize(window.YB_BOOK_META);
if(book.articles.length!==window.YB_CONTENT_MANIFEST.expectedArticles) throw new Error('Article count mismatch');

const added={
  x_wanfangjie:{author:'王俊舾',category:'故园'},
  x_zhaji:{author:'王俊舾',category:'笑谈'},
  x_gouyade:{author:'王俊舾',category:'笑谈'}
};
for(const [id,expect] of Object.entries(added)){
  const a=book.articles.find(x=>x.id===id);
  if(!a) throw new Error(`Missing added work: ${id}`);
  if(a.author!==expect.author || a.category!==expect.category) throw new Error(`Added work metadata mismatch: ${id}`);
}

const chapters=book.articles.find(a=>a.id==='tianhuaban')?.chapters?.length;
if(chapters!==20) throw new Error(`Tianhuaban chapters mismatch: ${chapters}`);
console.log(`OK: ${book.categories.length} categories, ${book.articles.length} works, 天花板 ${chapters} chapters.`);
