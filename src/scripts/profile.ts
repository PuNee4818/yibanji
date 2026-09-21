import {rpc,getCurrentUser} from '../lib/supabase';
import {growthCard} from './rewards';
import {discussionCard} from './discussion-render';
import type {Discussion} from '../lib/discussion';
const profile=document.querySelector<HTMLElement>('[data-profile-id]');
if(profile){const id=profile.dataset.profileId!;let page=0;const user=await getCurrentUser();const more=document.querySelector<HTMLButtonElement>('[data-profile-more]')!;
 async function render(append=false){const data=await rpc<{progress:{exp:number;level:number};featured:string|null;badges:{id:string;name:string;description:string}[];activity:Discussion[]}>('profile_community',{p_user:id,p_page:page});const growth=document.querySelector('#profile-growth')!;growth.replaceChildren(growthCard(data.progress));const wall=document.createElement('div');wall.className='badge-wall';for(const b of data.badges){const span=document.createElement('span');span.title=b.description;span.className='badge';span.textContent=`${b.id===data.featured?'★ ':''}${b.name}`;wall.append(span);}growth.append(wall);const activity=document.querySelector('[data-profile-activity]')!;if(!append)activity.replaceChildren();for(const item of data.activity)activity.append(discussionCard(item,user?.id,()=>render()));if(!data.activity.length&&!append)activity.textContent='这位书友还没有留下公开讨论。';more.hidden=data.activity.length<20;}
 more.addEventListener('click',()=>{page++;void render(true).catch(()=>{});});try{await render();}catch{document.querySelector('[data-profile-activity]')!.textContent='公开活动暂时无法加载，请稍后重试。';}
}
