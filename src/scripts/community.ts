import {supabase,rpc,getCurrentUser} from '../lib/supabase';
import {announce} from './site';
import type {Discussion} from '../lib/discussion';
import {discussionCard} from './discussion-render';
const user=await getCurrentUser();
const list=document.querySelector('[data-feed]');
if(list){
 const tab=new URLSearchParams(location.search).get('tab')??'hot';let page=0;let request=0;const more=document.querySelector<HTMLButtonElement>('[data-more-feed]');
 document.querySelectorAll<HTMLAnchorElement>('[data-feed-tab]').forEach(a=>{if(a.dataset.feedTab===tab)a.setAttribute('aria-current','page');});
 async function refresh(append=false){
  const version=++request;
  if(tab==='following'&&!user){list!.replaceChildren();const p=document.createElement('p');p.textContent='登录后，看看你关注的书友最近聊了什么。';const a=document.createElement('a');a.href='/auth/?next=/community/?tab=following';a.textContent='登录并发现书友 →';list!.append(p,a);if(more)more.hidden=true;return;}
  try{const rows=await rpc<Discussion[]>('community_feed',{p_tab:tab,p_page:page});if(version!==request)return;if(!append)list!.replaceChildren();if(!rows.length&&!append){const p=document.createElement('p');p.className='empty-state';p.textContent=tab==='following'?'还没有关注的书友动态。去最新讨论里，认识正在交流的人。':'这里还安静得像一本刚翻开的书。留下第一段感想吧。';list!.append(p);}for(const row of rows)list!.append(discussionCard(row,user?.id,()=>refresh()));if(more)more.hidden=rows.length<20;}catch(error){if(version===request)list!.textContent=(error as Error).message;}
 }
 more?.addEventListener('click',()=>{page++;void refresh(true);});
 const form=document.querySelector<HTMLFormElement>('#post-form');let key=crypto.randomUUID();let submitted='';
 form?.addEventListener('submit',async event=>{event.preventDefault();const data=new FormData(form);const body=String(data.get('content'));const target=String(data.get('article_id')??'')||null;const fingerprint=JSON.stringify([body,target]);if(submitted!==fingerprint){key=crypto.randomUUID();submitted=fingerprint;}const button=form.querySelector('button')!;button.disabled=true;try{await rpc('save_discussion',{p_kind:'post',p_target:target,p_content:body,p_key:key});form.reset();submitted='';page=0;await refresh();announce('新动态已经写下。');}catch(error){announce((error as Error).message);}finally{button.disabled=false;}});
 void refresh();
}
const highlights=document.querySelector('[data-highlights]');
if(highlights){try{const data=await rpc<{hot:{id:string;title:string;author:string;discussions:number}[];eggs:{id:string;title:string;eggs:number}[]}>('community_highlights');const {data:discussed,error}=await supabase.from('article_stats').select('comment_count,article:articles!inner(id,title,active)').eq('article.active',true).gt('comment_count',0).order('comment_count',{ascending:false}).limit(5).overrideTypes<{comment_count:number;article:{id:string;title:string;active:boolean}}[],{merge:false}>();if(error)throw error;const most=(discussed??[]).map(row=>({...row.article,discussions:row.comment_count}));highlights.replaceChildren();for(const [label,rows] of [['本周热文',data.hot],['讨论最多',most],['鸡蛋横飞',data.eggs]] as const){const h=document.createElement('h2');h.textContent=label;highlights.append(h);if(!rows.length){const p=document.createElement('p');p.className='muted';p.textContent='本周还没有足够的互动，先翻开一篇吧。';highlights.append(p);}for(const row of rows){const p=document.createElement('p');const a=document.createElement('a');a.href=`/articles/${row.id}/`;a.textContent=row.title;p.append(a);highlights.append(p);}}}catch{highlights.textContent='社区热点暂时无法加载。';}}
const recent=document.querySelector('[data-recent-discussions]');if(recent){try{const rows=await rpc<Discussion[]>('community_feed',{p_tab:'latest',p_page:0});recent.replaceChildren();for(const row of rows.slice(0,3))recent.append(discussionCard(row,user?.id,async()=>location.reload()));if(!rows.length)recent.textContent='还没有新的讨论，读完一篇来聊两句吧。';}catch{recent.textContent='最近讨论暂时无法加载。';}}
const post=document.querySelector<HTMLElement>('[data-post-id]');if(post){const id=post.dataset.postId!;const render=async()=>{const{data}=await supabase.from('discussion_items').select('*').eq('kind','post').eq('id',id).single();if(data){const target=document.querySelector('[data-post-body]')!;target.replaceChildren(discussionCard(data as Discussion,user?.id,render));}};await render();if(user)void rpc('visit_community',{p_post:id}).catch(()=>{});}
