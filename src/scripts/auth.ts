import { supabase, friendlyError, rpc ,getCurrentUser} from '../lib/supabase';
import { announce } from './site';
import { safeLocalPath } from '../lib/navigation';

export async function refreshUser() {
  const user=await getCurrentUser();
  document.querySelectorAll<HTMLElement>('[data-auth-only]').forEach(el=>{if(el.id!=='profile-form'||!user)el.hidden=!user;});
  document.querySelectorAll<HTMLElement>('[data-guest-only]').forEach(el=>el.hidden=!!user);
  if(user) {
    void rpc<{is_admin:boolean}>('account_capabilities').then(c=>document.querySelectorAll<HTMLElement>('[data-admin-only]').forEach(el=>el.hidden=!c?.is_admin)).catch(()=>{});
    const {data:profile,error}=await supabase.from('profiles').select('*').eq('id',user.id).single();
    const loading=document.querySelector<HTMLElement>('#profile-load-status');const retry=document.querySelector<HTMLElement>('#profile-retry');
    if(loading){loading.hidden=!!profile;loading.textContent=error?friendlyError(error):'正在读取个人资料…';}if(retry)retry.hidden=!error;
    if(profile) {
      document.querySelectorAll<HTMLAnchorElement>('[data-my-profile]').forEach(link=>link.href=`/u/${profile.username}/`);
      const avatar=document.querySelector('.avatar'); if(avatar) avatar.textContent=profile.display_name.slice(0,1);
      const form=document.querySelector<HTMLFormElement>('#profile-form');
      if(form && form.dataset.loadedUser!==user.id) {
        for(const key of ['username','display_name','bio']) { const input=form.elements.namedItem(key) as HTMLInputElement; input.value=profile[key]; }
        form.dataset.loadedUser=user.id;form.hidden=false;
      }
    }
  }
  return user;
}
void refreshUser();
document.querySelector('#profile-retry')?.addEventListener('click',()=>void refreshUser());
supabase.auth.onAuthStateChange(event=>{ if(event!=='INITIAL_SESSION')setTimeout(()=>void refreshUser(),0); });
document.querySelector('[data-signout]')?.addEventListener('click',async()=>{
  const {error}=await supabase.auth.signOut(); if(error) announce(friendlyError(error)); else location.href='/';
});
const authForm=document.querySelector<HTMLFormElement>('#auth-form');
if(authForm){authForm.querySelector('button')!.disabled=false;document.querySelector('#auth-message')!.textContent='';}
authForm?.addEventListener('submit',async event=>{
  event.preventDefault(); const data=new FormData(authForm); const button=authForm.querySelector('button')!; button.disabled=true;
  const email=String(data.get('email'));const password=String(data.get('password'));
  const message=document.querySelector('#auth-message')!;message.textContent='正在连接书房…';
  try {
    const signup=data.get('mode')==='signup';
    const response=signup ? await supabase.auth.signUp({email,password,options:{emailRedirectTo:new URL('/auth/',location.origin).href}}) : await supabase.auth.signInWithPassword({email,password});
    if(response.error) { message.textContent=friendlyError(response.error); return; }
    if(signup && !response.data.session) { message.textContent='请检查邮箱，确认注册后即可登录。'; return; }
    const next=new URLSearchParams(location.search).get('next');
    location.href=safeLocalPath(next,location.origin);
  } catch { message.textContent='网络暂时不可用，请稍后再试。'; } finally { button.disabled=false; }
});
document.querySelector<HTMLFormElement>('#profile-form')?.addEventListener('submit',async event=>{
  event.preventDefault(); const form=event.currentTarget as HTMLFormElement;const data=new FormData(form);
  try { await rpc('save_profile',{p_username:data.get('username'),p_display_name:data.get('display_name'),p_bio:data.get('bio')});announce('个人资料已更新。');await refreshUser(); }
  catch(error) { announce((error as Error).message); }
});
const follow=document.querySelector<HTMLButtonElement>('[data-follow-user]');
if(follow) {
  const user=await getCurrentUser();
  if(user?.id===follow.dataset.followUser) follow.hidden=true;
  if(user) {
    const {data}=await supabase.from('user_follows').select('follower_id').eq('follower_id',user.id).eq('following_id',follow.dataset.followUser!);
    follow.setAttribute('aria-pressed',String(!!data?.length));follow.textContent=data?.length?'已关注':'关注';
  }
  follow.addEventListener('click',async()=>{
    if(!user) {location.href=`/auth/?next=${encodeURIComponent(location.pathname)}`;return;}
    follow.disabled=true;
    try { const selected=follow.getAttribute('aria-pressed')!=='true';await rpc('set_follow',{p_user_id:follow.dataset.followUser,p_following:selected});follow.setAttribute('aria-pressed',String(selected));follow.textContent=selected?'已关注':'关注';announce(selected?'已关注这位书友。':'已取消关注。'); }
    catch(error) {announce((error as Error).message);} finally {follow.disabled=false;}
  });
  follow.disabled=false;
}
