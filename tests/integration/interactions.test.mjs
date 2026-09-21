import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fixtures} from './fixtures.mjs';
import {sql,quote} from '../../tools/db.mjs';

test('real concurrent egg spending, idempotency, repeat throws, likes, private bookmarks and qualified reading',async()=>{
 const f=await fixtures();const [a,b]=f.clients;const u=f.users[0].id;const article=`test_${randomUUID().replaceAll('-','')}`;
 try{
  sql(`insert into public.articles(id,title,author,category) values(${quote(article)},'事务联调','测试','测试');insert into public.article_stats(article_id) values(${quote(article)});select app_private.award(${quote(u)},5,0,'migration','test','test-wallet');`);
  const key=randomUUID();const results=await Promise.all([a.rpc('throw_eggs',{p_article:article,p_quantity:5,p_idempotency_key:key}),a.rpc('throw_eggs',{p_article:article,p_quantity:5,p_idempotency_key:randomUUID()})]);
  assert.equal(results.filter(r=>!r.error).length,1);assert.equal(results.filter(r=>r.error).length,1);
  let ctx=(await a.rpc('article_context',{p_article:article})).data;assert.equal(ctx.balance,0);assert.equal(ctx.stats.egg_count,5);assert.equal(ctx.stats.egg_thrower_count,1);
  const row=(await a.from('egg_throws').select('*').eq('article_id',article).single()).data;
  const replay=await a.rpc('throw_eggs',{p_article:article,p_quantity:5,p_idempotency_key:row.idempotency_key});assert.equal(replay.error,null);assert.equal(replay.data.replayed,true);
  assert.ok((await a.rpc('throw_eggs',{p_article:article,p_quantity:1,p_idempotency_key:row.idempotency_key})).error);
  for(const amount of [0,-1,51])assert.ok((await a.rpc('throw_eggs',{p_article:article,p_quantity:amount,p_idempotency_key:randomUUID()})).error);
  sql(`select app_private.award(${quote(u)},10,0,'migration','test','test-wallet-2')`);
  for(let i=0;i<2;i++)assert.equal((await a.rpc('throw_eggs',{p_article:article,p_quantity:2,p_idempotency_key:randomUUID()})).error,null);
  for(let i=0;i<2;i++)assert.equal((await a.rpc('set_article_state',{p_article:article,p_kind:'like',p_active:true})).error,null);
  ctx=(await a.rpc('article_context',{p_article:article})).data;assert.equal(ctx.stats.egg_count,9);assert.equal(ctx.stats.egg_thrower_count,1);assert.equal(ctx.stats.like_count,1);assert.equal(ctx.balance,6);assert.equal(ctx.liked,true);
  assert.equal((await a.rpc('import_bookmarks',{p_articles:[article,article,'unknown']})).data,1);
  assert.equal((await a.rpc('import_bookmarks',{p_articles:[article]})).data,0);
  assert.equal((await b.from('bookmarks').select('*').eq('user_id',u)).data.length,0);
  const session=(await a.rpc('begin_read',{p_article:article})).data;
  assert.equal((await a.rpc('sync_reading',{p_session:session,p_depth:1,p_chapter:1,p_position:0.5})).data,false);
  assert.ok((await b.rpc('sync_reading',{p_session:session,p_depth:1,p_chapter:1,p_position:1})).error);
  sql(`update app_private.reading_sessions set active_seconds=29,last_seen=now()-interval '2 seconds' where id=${quote(session)}`);
  assert.equal((await a.rpc('sync_reading',{p_session:session,p_depth:0.5,p_chapter:1,p_position:0.5})).data,true);
  assert.equal((await b.from('reading_progress').select('*').eq('user_id',u)).data.length,0);
  assert.ok((await a.from('article_stats').update({egg_count:900}).eq('article_id',article)).error);
  const ledger=(await a.from('economy_transactions').select('delta').eq('asset_type','egg')).data;assert.equal(ledger.reduce((s,r)=>s+r.delta,0),6);
  console.log('Balance 5 + concurrent spend 5/5: exactly one success, balance 0, article +5. Repeat/multi-egg/like coexistence/idempotency and reading RLS verified.');
 }finally{f.cleanup();sql(`delete from public.articles where id=${quote(article)}`);}
});
