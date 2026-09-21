import { supabase, friendlyError, rpc } from '../lib/supabase';
import { announce } from './site';

export async function refreshUser() {
  const { data: { user } } = await supabase.auth.getUser();
  document.querySelectorAll<HTMLElement>('[data-auth-only]').forEach(el=>{if(el.id!=='profile-form'||!user)el.hidden=!user;});
  document.querySelectorAll<HTMLElement>('[data-guest-only]').forEach(el=>el.hidden=!!user);
  if(user) {
    const {data:profile}=await supabase.from('profiles').select('*').eq('id',user.id).single();
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
supabase.auth.onAuthStateChange(()=>{ setTimeout(()=>void refreshUser(),0); });
document.querySelector('[data-signout]')?.addEventListener('click',async()=>{
  const {error}=await supabase.auth.signOut(); if(error) announce(friendlyError(error)); else location.href='/';
});
const authForm=document.querySelector<HTMLFormElement>('#auth-form');
authForm?.addEventListener('submit',async event=>{
  event.preventDefault(); const data=new FormData(authForm); const button=authForm.querySelector('button')!; button.disabled=true;
  const email=String(data.get('email'));const password=String(data.get('password'));
  try {
    const signup=data.get('mode')==='signup';
    const response=signup ? await supabase.auth.signUp({email,password}) : await supabase.auth.signInWithPassword({email,password});
    if(response.error) { announce(friendlyError(response.error)); return; }
    if(signup && !response.data.session) { announce('请检查邮箱，确认注册后即可登录。'); return; }
    const next=new URLSearchParams(location.search).get('next');
    location.href=next?.startsWith('/') && !next.startsWith('//') && !next.includes('\\') ? next : '/me/settings/';
  } catch { announce('网络暂时不可用，请稍后再试。'); } finally { button.disabled=false; }
});
document.querySelector<HTMLFormElement>('#profile-form')?.addEventListener('submit',async event=>{
  event.preventDefault(); const form=event.currentTarget as HTMLFormElement;const data=new FormData(form);
  try { await rpc('save_profile',{p_username:data.get('username'),p_display_name:data.get('display_name'),p_bio:data.get('bio')});announce('个人资料已更新。');await refreshUser(); }
  catch(error) { announce((error as Error).message); }
});
const follow=document.querySelector<HTMLButtonElement>('[data-follow-user]');
if(follow) {
  const user=await refreshUser();
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
}
