// Usage: node tools/audit-typography.js
// Conservative typography audit: catches layout/punctuation defects without rewriting literary wording.
const fs=require('fs'), path=require('path'), vm=require('vm');
const ROOT=path.resolve(__dirname,'..');
const window={}; const ctx=vm.createContext({window,console});
function run(rel){vm.runInContext(fs.readFileSync(path.join(ROOT,rel),'utf8'),ctx,{filename:rel});}
run('assets/js/core/content-registry.js');
run('data/book-meta.js');
run('data/content-manifest.js');
for(const f of window.YB_CONTENT_MANIFEST.files) run(f);
const book=window.YB_CONTENT.finalize(window.YB_BOOK_META);
const issues=[];
const badInline=[
  [/＂/g,'full-width straight quote'],
  [/……[.．]+|\.\.\.+/g,'mixed ellipsis'],
  [/[。！？][”」』]，/g,'comma after terminal quoted sentence'],
  [/[\u4e00-\u9fff」』”’][!?](?=[\u4e00-\u9fff“‘”」』]|$)/g,'ASCII !/? in Chinese text'],
  [/[\u4e00-\u9fff）)]\s*:[^/]/g,'ASCII colon in Chinese text'],
  [/[\u4e00-\u9fff]\([^\n)]*\)[\u4e00-\u9fff]/g,'ASCII parentheses in Chinese text'],
];
function scanText(a,label,t){
  for(const [re,name] of badInline){ if(re.test(t)){ issues.push(`${a.id} ${label}: ${name}`); re.lastIndex=0; } }
}
for(const a of book.articles){
  for(const [i,t] of (a.body||[]).entries()) scanText(a,`body[${i}]`,t);
  for(const [i,n] of (a.notes||[]).entries()) scanText(a,`notes[${i}]`,n);
  for(const c of (a.chapters||[])) for(const [i,t] of (c.body||[]).entries()) scanText(a,`chapter${c.number}[${i}]`,t);
}
const css=fs.readFileSync(path.join(ROOT,'assets/css/main.css'),'utf8');
if(/\.prose-body\.verse p:first-child\s*\{[^}]*margin-bottom/i.test(css)) issues.push('CSS: verse first-child still has forced bottom gap');
if(issues.length){ console.error(issues.join('\n')); process.exit(1); }
console.log(`OK: typography audit passed for ${book.articles.length} works.`);
