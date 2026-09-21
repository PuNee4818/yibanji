import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { createClient } from '@supabase/supabase-js';
import {Agent,fetch as remoteFetch} from 'undici';
import { sql, quote } from '../../tools/db.mjs';
const env=parseEnv(readFileSync('.env.local','utf8').replace(/^\uFEFF/,''));
// Real remote connections can take longer through the local proxy. Do not retry application mutations.
const dispatcher=new Agent({connect:{timeout:30000},connections:4});
export const client=()=>createClient(env.PUBLIC_SUPABASE_URL,env.PUBLIC_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(url,options)=>{
  try {return await remoteFetch(url,{...options,dispatcher,signal:options?.signal??AbortSignal.timeout(45000)});} catch(error) {throw new Error(`Transport ${error.cause?.code ?? error.name}: ${error.cause?.message ?? 'connection failed'}`);}
}}});
export async function fixtures(count=2) {
  const users=Array.from({length:count},()=>({id:randomUUID(),email:`yb-test-${randomUUID()}@example.com`,password:randomUUID()+randomUUID()}));
  sql(`begin; ${users.map(u=>`insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,email_change,email_change_token_new,recovery_token)
values('00000000-0000-0000-0000-000000000000',${quote(u.id)},'authenticated','authenticated',${quote(u.email)},extensions.crypt(${quote(u.password)},extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','');
insert into auth.identities(id,provider_id,user_id,identity_data,provider,created_at,updated_at) values(gen_random_uuid(),${quote(u.id)},${quote(u.id)},jsonb_build_object('sub',${quote(u.id)},'email',${quote(u.email)}),'email',now(),now());`).join('\n')} commit;`);
  const cleanup=()=>cleanupTestUsers(users);
  try {
    const clients=[];
    for(const u of users){
      const c=client();let error;
      for(let attempt=0;attempt<3;attempt++){
        ({error}=await c.auth.signInWithPassword({email:u.email,password:u.password}));
        if(!error || !/CONNECT_TIMEOUT/.test(error.message))break;
      }
      if(error)throw new Error(`Test login failed: ${error.name} ${error.status} ${error.code ?? ''} ${error.message}`);
      clients.push(c);
    }
    return {users,clients,cleanup};
  } catch(error) {cleanup();throw error;}
}

export function cleanupTestUsers(users){
 if(!users.length)return;
 if(!users.every(u=>/^yb-test-[0-9a-f-]{36}@example\.com$/.test(u.email)))throw new Error("Refusing to remove non-fixture accounts");
 return sql(`begin;
with owned as(select article_id,sum(quantity) eggs,count(distinct user_id) people from public.egg_throws where user_id in(${users.map(u=>quote(u.id)).join(',')}) group by article_id)
update public.article_stats s set egg_count=s.egg_count-o.eggs,egg_thrower_count=s.egg_thrower_count-o.people from owned o where s.article_id=o.article_id;
with owned as(select article_id,(created_at at time zone (select timezone from app_private.site_config where id))::date as day,sum(quantity) eggs from public.egg_throws where user_id in(${users.map(u=>quote(u.id)).join(',')}) group by 1,2)
update public.article_activity s set eggs=greatest(0,s.eggs-o.eggs) from owned o where s.article_id=o.article_id and s.day=o.day;
with owned as(select e.reference article_id,e.event_date as day,count(*) filter(where e.event='like') likes,count(*) filter(where e.event='bookmark') bookmarks from app_private.community_events e where e.user_id in(${users.map(u=>quote(u.id)).join(',')}) group by 1,2)
update public.article_activity s set likes=greatest(0,s.likes-o.likes),bookmarks=greatest(0,s.bookmarks-o.bookmarks) from owned o where s.article_id=o.article_id and s.day=o.day;
with owned as(select article_id,(created_at at time zone (select timezone from app_private.site_config where id))::date as day,count(*) n from public.comments where user_id in(${users.map(u=>quote(u.id)).join(',')}) group by 1,2)
update public.article_activity s set comments=greatest(0,s.comments-o.n) from owned o where s.article_id=o.article_id and s.day=o.day;
with deleted as(delete from app_private.article_views v using app_private.view_salt salt where exists(select 1 from public.profiles p where p.id in(${users.map(u=>quote(u.id)).join(',')}) and v.viewer=md5(p.id::text||v.view_date::text||salt.salt::text)) returning v.article_id,v.view_date),
stats as(update public.article_stats s set view_count=view_count-o.n from(select article_id,count(*) n from deleted group by article_id)o where s.article_id=o.article_id)
update public.article_activity s set views=greatest(0,s.views-o.n) from(select article_id,view_date,count(*) n from deleted group by 1,2)o where s.article_id=o.article_id and s.day=o.view_date;
delete from auth.users where id in (${users.map(u=>quote(u.id)).join(',')}) and email like 'yb-test-%@example.com';commit;`,true);
}
