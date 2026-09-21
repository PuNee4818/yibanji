import { test } from 'node:test';
import assert from 'node:assert/strict';
import {fixtures,client} from './fixtures.mjs';
import {sql,quote} from '../../tools/db.mjs';

test('real Supabase Auth, profiles, graph and RLS',async()=>{
  const f=await fixtures();const [a,b]=f.clients;const [ua,ub]=f.users;
  try {
    const profile=await a.from('profiles').select('*').eq('id',ua.id).single();
    assert.equal(profile.error,null);assert.equal(profile.data.username,`reader_${ua.id.replaceAll('-','')}`);
    assert.equal((await a.rpc('save_profile',{p_username:`test_${ua.id.replaceAll('-','')}`,p_display_name:'联调书友',p_bio:'来自真实数据库的测试'})).error,null);
    assert.ok((await b.from('profiles').update({display_name:'forbidden'}).eq('id',ua.id)).error);
    assert.ok((await client().rpc('save_profile',{p_username:'visitor',p_display_name:'游客',p_bio:''})).error);
    assert.ok((await a.rpc('set_follow',{p_user_id:ua.id,p_following:true})).error);
    for(let i=0;i<2;i++) assert.equal((await a.rpc('set_follow',{p_user_id:ub.id,p_following:true})).error,null);
    assert.equal((await a.from('user_follows').select('*').eq('follower_id',ua.id)).data.length,1);
    assert.equal((await b.from('profile_summaries').select('follower_count').eq('id',ub.id).single()).data.follower_count,1);
    assert.equal((await a.rpc('set_follow',{p_user_id:ub.id,p_following:false})).error,null);
    assert.equal((await a.from('user_follows').select('*').eq('follower_id',ua.id)).data.length,0);
    sql(`update app_private.account_states set status='restricted' where user_id=${quote(ua.id)}`);
    assert.ok((await a.rpc('set_follow',{p_user_id:ub.id,p_following:true})).error);
    const tables=sql("select relname,relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'");
    assert.ok(tables.length>=2);assert.ok(tables.every(t=>t.relrowsecurity));
    console.log('Verified actual Auth login, signup trigger, profile ownership, follow idempotency/counts, restricted user, table RLS.');
  } finally {f.cleanup();}
});
