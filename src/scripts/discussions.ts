import {rpc,getCurrentUser} from '../lib/supabase';
import {announce} from './site';
import type {Discussion} from '../lib/discussion';
import {discussionCard} from './discussion-render';
const section=document.querySelector<HTMLElement>('[data-discussion-kind]');
if(section){
 const kind=section.dataset.discussionKind!;const target=section.dataset.discussionTarget!;const user=await getCurrentUser();
 const form=section.querySelector<HTMLFormElement>('[data-comment-form]')!;const list=section.querySelector('[data-comments-list]')!;const sort=section.querySelector<HTMLSelectElement>('[data-comment-sort]')!;
 const more=section.querySelector<HTMLButtonElement>('[data-more-comments]')!;let page=0;let parent:string|null=null;let key=crypto.randomUUID();let submitted:string|undefined;
 const cancel=section.querySelector<HTMLButtonElement>('[data-cancel-reply]')!;const hint=section.querySelector<HTMLElement>('[data-reply-hint]')!;
 function resetReply(){parent=null;cancel.hidden=true;hint.hidden=true;}
 cancel.addEventListener('click',resetReply);
 async function refresh(append=false){
  try{const rows=await rpc<Discussion[]>('discussion_thread',{p_kind:kind,p_target:target,p_sort:sort.value,p_page:page});if(!append)list.replaceChildren();
   if(!rows.length&&!append){const p=document.createElement('p');p.className='muted';p.textContent='还没有讨论。第一段感想，或许就从你开始。';list.append(p);}
   const reply=(item:Discussion)=>{parent=item.id;hint.textContent=`回复 ${item.display_name}`;hint.hidden=false;cancel.hidden=false;form.scrollIntoView({block:'center'});form.querySelector('textarea')?.focus();};
   for(const item of rows.filter(x=>!x.parent_id||!rows.some(r=>r.id===x.parent_id))){const card=discussionCard(item,user?.id,()=>refresh(),reply);const replies=rows.filter(x=>x.parent_id===item.id);if(replies.length){const detail=document.createElement('details');const summary=document.createElement('summary');summary.textContent=`展开 ${replies.length} 条回复`;detail.append(summary);for(const r of replies)detail.append(discussionCard(r,user?.id,()=>refresh(),reply));card.append(detail);}list.append(card);}
   more.hidden=rows.length<100;
   if(location.hash.startsWith('#comment-')){const el=document.getElementById(location.hash.slice(1));if(el){const details=el.closest('details');if(details)details.open=true;el.scrollIntoView({block:'center'});}}
  }catch(error){list.textContent=(error as Error).message;}
 }
 sort.addEventListener('change',()=>{page=0;void refresh();});more.addEventListener('click',()=>{page++;void refresh(true);});
 form.addEventListener('submit',async event=>{event.preventDefault();if(!user){location.href='/auth/';return;}const body=String(new FormData(form).get('content'));const fingerprint=JSON.stringify([body,parent]);if(submitted!==fingerprint){key=crypto.randomUUID();submitted=fingerprint;}const button=form.querySelector('button')!;button.disabled=true;try{await rpc('save_discussion',{p_kind:kind,p_target:target,p_content:body,p_parent:parent,p_key:key});form.reset();resetReply();submitted=undefined;page=0;await refresh();document.dispatchEvent(new Event('discussion-mutated'));announce('这段话已经留在这里了。');}catch(error){announce((error as Error).message);}finally{button.disabled=false;}});
 await refresh();
}
