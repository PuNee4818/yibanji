import {supabase,rpc,getCurrentUser} from '../lib/supabase';
import type {Growth,Checkin} from '../lib/growth';
const dialog=document.querySelector<HTMLDialogElement>('#checkin-dialog');
const button=document.querySelector<HTMLButtonElement>('#checkin-submit');
async function menuStatus(){const user=await getCurrentUser();if(!user)return;try{const g=await rpc<Growth>('growth_summary');document.querySelectorAll<HTMLElement>('[data-open-checkin]').forEach(el=>{el.textContent=g.today_checkin?'每日签到 · 已签到':'每日签到 · 今日未签到';el.dataset.unchecked=String(!g.today_checkin);});}catch{/* The dialog offers a retry when opened. */}}
void menuStatus();
async function renderCheckin(){
 if(!dialog||!button)return;
 const summary=await rpc<Growth>('growth_summary');
 const text=document.querySelector('#checkin-summary')!;
 text.textContent=`连续签到 ${summary.streak_days} 天 · 当前有 ${summary.wallet.egg_balance} 枚臭鸡蛋`;
 button.disabled=!!summary.today_checkin;button.textContent=summary.today_checkin?'今日已签到':'签到，领取今日奖励';
 const {data:rules}=await supabase.from('economy_rules').select('*').single();
 const list=document.querySelector('#checkin-tiers')!;list.replaceChildren();
 if(rules) for(let i=0;i<7;i++){const li=document.createElement('li');li.textContent=`第 ${i+1} 档：${rules.checkin_eggs[i]} 枚 · ${rules.checkin_exp[i]} EXP`;list.append(li);}
 document.querySelectorAll<HTMLElement>('[data-open-checkin]').forEach(el=>{el.textContent=summary.today_checkin?'每日签到 · 已签到':'每日签到 · 今日未签到';el.dataset.unchecked=String(!summary.today_checkin);});
 document.dispatchEvent(new CustomEvent('growth-updated',{detail:summary}));
}
document.querySelectorAll('[data-open-checkin]').forEach(el=>el.addEventListener('click',async()=>{
 const user=await getCurrentUser();if(!user){location.href='/auth/';return;}
 dialog?.showModal();try{await renderCheckin();}catch(error){document.querySelector('#checkin-summary')!.textContent=(error as Error).message;}
}));
button?.addEventListener('click',async()=>{
 button.disabled=true;
 try{const c=await rpc<Checkin>('daily_checkin');document.querySelector('#checkin-result')!.textContent=`今日获得 ${c.reward_eggs} 枚臭鸡蛋、${c.reward_exp} EXP，连续签到第 ${c.streak_days} 天。`;await renderCheckin();}
 catch(error){document.querySelector('#checkin-result')!.textContent=(error as Error).message;button.disabled=false;}
});
