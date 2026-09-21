import {rpc} from '../lib/supabase';
import {announce} from './site';
import {discussionUrl,type Discussion} from '../lib/discussion';
let catalog:Promise<{id:string;title:string;author:string}[]>|undefined;
export function discussionCard(item:Discussion,userId:string|undefined,refresh:()=>Promise<void>,reply?:(item:Discussion)=>void):HTMLElement{
 const card=document.createElement('article');card.className='discussion-card';card.id=`comment-${item.id}`;
 const meta=document.createElement('div');meta.className='discussion-meta';const author=document.createElement('a');author.href=`/u/${item.username}/`;author.textContent=item.display_name;meta.append(author);
 const time=document.createElement('time');time.dateTime=item.created_at;time.textContent=new Date(item.created_at).toLocaleString('zh-CN');meta.append(time);card.append(meta);
 const body=document.createElement('p');body.className='discussion-content';body.textContent=item.content;card.append(body);
 const actions=document.createElement('div');actions.className='discussion-actions';
 const button=(label:string,handler:()=>Promise<void>|void)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',async()=>{b.disabled=true;try{await handler();}catch(error){announce((error as Error).message);}finally{b.disabled=false;}});actions.append(b);return b;};
 if(item.status==='visible'){
  const like=button(`赞 ${item.like_count}`,async()=>{if(!userId){location.href='/auth/';return;}await rpc('set_discussion_like',{p_kind:item.kind,p_id:item.id,p_active:!item.liked});await refresh();});like.setAttribute('aria-pressed',String(item.liked));
  if(reply)button(`回复 ${item.reply_count}`,()=>{if(!userId){location.href='/auth/';return;}reply(item);});
  if(userId===item.user_id){
   button('编辑',()=>{
    if(card.querySelector('form'))return;
    const form=document.createElement('form');form.className='form-stack';const label=document.createElement('label');label.textContent='编辑内容';const area=document.createElement('textarea');area.value=item.content;area.maxLength=item.kind==='post'?500:2000;area.required=true;label.append(area);form.append(label);
    const save=document.createElement('button');save.textContent='保存修改';const cancel=document.createElement('button');cancel.type='button';cancel.textContent='取消';cancel.addEventListener('click',()=>form.remove());form.append(save,cancel);card.append(form);area.focus();
    form.addEventListener('submit',async event=>{event.preventDefault();save.disabled=true;try{await rpc('save_discussion',{p_kind:item.kind,p_target:item.target,p_content:area.value,p_id:item.id});await refresh();}catch(error){announce((error as Error).message);}finally{save.disabled=false;}});
   });
   button('删除',async()=>{await rpc('delete_discussion',{p_kind:item.kind,p_id:item.id});await refresh();document.dispatchEvent(new Event('discussion-mutated'));});
  }
  button('举报',()=>{document.dispatchEvent(new CustomEvent('report-content',{detail:{kind:item.kind==='article'?'comment':item.kind==='post'?'community_post':'community_post_comment',id:item.id}}));});
 }
 const link=document.createElement('a');link.href=discussionUrl(item);link.textContent=item.kind==='post'?'打开动态与讨论':'查看原文讨论';actions.append(link);card.append(actions);
 if(item.kind==='article'){catalog??=fetch('/article-index.json').then(r=>r.json());void catalog.then(rows=>{const article=rows.find(a=>a.id===item.target);if(article)link.textContent=`《${article.title}》 · ${article.author}`;}).catch(()=>{});}
 return card;
}
