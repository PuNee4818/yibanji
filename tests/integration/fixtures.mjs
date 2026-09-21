import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { createClient } from '@supabase/supabase-js';
import { sql, quote } from '../../tools/db.mjs';
const env=parseEnv(readFileSync('.env.local','utf8').replace(/^\uFEFF/,''));
export const client=()=>createClient(env.PUBLIC_SUPABASE_URL,env.PUBLIC_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(url,options)=>{
  try {return await fetch(url,options);} catch(error) {throw new Error(`Transport ${error.cause?.code ?? error.name}: ${error.cause?.message ?? 'connection failed'}`);}
}}});
export async function fixtures(count=2) {
  const users=Array.from({length:count},()=>({id:randomUUID(),email:`yb-test-${randomUUID()}@example.com`,password:randomUUID()+randomUUID()}));
  sql(`begin; ${users.map(u=>`insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,email_change,email_change_token_new,recovery_token)
values('00000000-0000-0000-0000-000000000000',${quote(u.id)},'authenticated','authenticated',${quote(u.email)},extensions.crypt(${quote(u.password)},extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','');
insert into auth.identities(id,provider_id,user_id,identity_data,provider,created_at,updated_at) values(gen_random_uuid(),${quote(u.id)},${quote(u.id)},jsonb_build_object('sub',${quote(u.id)},'email',${quote(u.email)}),'email',now(),now());`).join('\n')} commit;`);
  const cleanup=()=>sql(`delete from auth.users where id in (${users.map(u=>quote(u.id)).join(',')}) and email like 'yb-test-%@example.com'`);
  try {
    const clients=await Promise.all(users.map(async u=>{const c=client();const {error}=await c.auth.signInWithPassword({email:u.email,password:u.password});if(error)throw new Error(`Test login failed: ${error.name} ${error.status} ${error.code ?? ''} ${error.message}`);return c;}));
    return {users,clients,cleanup};
  } catch(error) {cleanup();throw error;}
}
