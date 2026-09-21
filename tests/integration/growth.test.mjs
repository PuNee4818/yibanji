import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixtures,client} from './fixtures.mjs';
import {sql,quote} from '../../tools/db.mjs';

test('real transaction checkins, streak cycles, gaps, task caps, EXP, badges and private wallets',async()=>{
 const f=await fixtures();const [a,b]=f.clients;const [ua,ub]=f.users;
 try{
  assert.ok((await client().rpc('daily_checkin')).error);
  const concurrent=await Promise.all([a.rpc('daily_checkin'),a.rpc('daily_checkin'),a.rpc('daily_checkin')]);
  for(const r of concurrent){assert.equal(r.error,null);assert.equal(r.data.reward_eggs,1);assert.equal(r.data.streak_days,1);}
  assert.equal(new Set(concurrent.map(r=>r.data.id)).size,1);
  let g=(await a.rpc('growth_summary')).data;assert.equal(g.wallet.egg_balance,1);assert.equal(g.progress.exp,5);
  assert.equal((await b.from('user_wallets').select('*').eq('user_id',ua.id)).data.length,0);
  assert.ok((await a.from('user_wallets').update({egg_balance:999}).eq('user_id',ua.id)).error);
  assert.ok((await a.from('user_progress').update({exp:999}).eq('user_id',ua.id)).error);
  assert.ok((await a.from('daily_task_progress').insert({user_id:ua.id,task_id:'daily_read',period_start:g.today,progress:2})).error);
  sql(`do $$ begin for i in 50..57 loop perform app_private.checkin_at(${quote(ub.id)},app_private.today()-108+i);end loop;perform app_private.checkin_at(${quote(ub.id)},app_private.today()-49);for i in 1..30 loop perform app_private.checkin_at(${quote(ub.id)},app_private.today()-31+i);end loop;end $$;`);
  const checks=sql(`select streak_days,reward_eggs,reward_exp from public.daily_checkins where user_id=${quote(ub.id)} order by checkin_date`);
  assert.equal(checks[6].streak_days,7);assert.equal(checks[6].reward_eggs,8);assert.equal(checks[6].reward_exp,30);
  assert.equal(checks[7].streak_days,8);assert.equal(checks[7].reward_eggs,1);assert.equal(checks[8].streak_days,1);
  assert.equal(checks.at(-1).streak_days,30);
  assert.equal((await b.from('user_achievements').select('*').eq('achievement_id','streak30').eq('user_id',ub.id)).data[0].unlocked_at!==null,true);
  assert.equal((await b.from('economy_transactions').select('*').eq('reason','achievement').eq('reference_id','streak30')).data.length,1);
  const weekly=(await b.from('economy_transactions').select('*').eq('reason','weekly_task').eq('reference_id','weekly_checkin').eq('asset_type','egg')).data;
  assert.ok(weekly.length>0);assert.ok(weekly.every(t=>t.delta===5));assert.equal(new Set(weekly.map(t=>t.idempotency_key)).size,weekly.length);
  sql(`do $$ declare d date:=date_trunc('week',app_private.today()::timestamp)::date-7;begin for i in 1..20 loop perform app_private.record_event(${quote(ub.id)},'read','weekly-read-'||i,d);end loop;for i in 1..3 loop perform app_private.record_event(${quote(ub.id)},'discussion','weekly-comment-'||i,d);end loop;for i in 1..10 loop perform app_private.record_event(${quote(ub.id)},'like','weekly-like-'||i,d);end loop;end $$;`);
  const milestone=sql(`select progress,rewarded_at from public.weekly_task_progress where user_id=${quote(ub.id)} and task_id='weekly_active100' and period_start=date_trunc('week',app_private.today()::timestamp)::date-7`)[0];
  assert.equal(milestone.progress,100);assert.ok(milestone.rewarded_at);
  sql(`select app_private.record_event(${quote(ua.id)},'read','r1');select app_private.record_event(${quote(ua.id)},'read','r2');select app_private.record_event(${quote(ua.id)},'read','r2');`);
  g=(await a.rpc('growth_summary')).data;assert.equal(g.tasks.find(t=>t.id==='daily_read').progress,2);
  const ledger=await a.from('economy_transactions').select('*');
  assert.equal(ledger.data.filter(r=>r.reference_id==='daily_read'&&r.asset_type==='egg').length,1);
  assert.equal(g.wallet.egg_balance,2);assert.equal(g.progress.exp,10);
  assert.ok((await a.from('economy_transactions').delete().eq('user_id',ua.id)).error);
  const reconciliation=sql(`select w.user_id,w.egg_balance,coalesce(sum(t.delta),0) ledger from public.user_wallets w left join public.economy_transactions t on t.user_id=w.user_id and t.asset_type='egg' where w.user_id in(${quote(ua.id)},${quote(ub.id)}) group by w.user_id`);
  assert.ok(reconciliation.every(r=>Number(r.ledger)===r.egg_balance));
  console.log('Verified daily uniqueness under concurrent requests, tier 7/8, reset after gap, 30-day badge/bonus, task deduplication, ledger reconciliation and private-data RLS.');
 }finally{f.cleanup();}
});
