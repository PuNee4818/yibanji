create table app_private.site_config(id boolean primary key default true check(id),timezone text not null default 'Asia/Shanghai');
insert into app_private.site_config values(true,'Asia/Shanghai');
create table public.economy_rules(id boolean primary key default true check(id),checkin_eggs integer[] not null,checkin_exp integer[] not null,max_throw integer not null);
insert into public.economy_rules values(true,array[1,2,2,3,3,4,8],array[5,5,10,10,15,15,30],50);
create table public.user_wallets(
 user_id uuid primary key references public.profiles(id) on delete cascade,
 egg_balance integer not null default 0 check(egg_balance>=0),
 lifetime_earned_eggs bigint not null default 0 check(lifetime_earned_eggs>=0),
 lifetime_spent_eggs bigint not null default 0 check(lifetime_spent_eggs>=0),updated_at timestamptz not null default now());
create table public.user_progress(user_id uuid primary key references public.profiles(id) on delete cascade,
 exp bigint not null default 0 check(exp>=0),
 level integer generated always as(case when exp>=1800 then 6 when exp>=900 then 5 when exp>=400 then 4 when exp>=150 then 3 when exp>=50 then 2 else 1 end) stored,
 updated_at timestamptz not null default now());
create table public.economy_transactions(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,
 asset_type text not null check(asset_type in('egg','exp')),delta bigint not null check(delta<>0),balance_after bigint not null check(balance_after>=0),
 reason text not null,reference_type text not null,reference_id text not null,idempotency_key text not null,metadata jsonb not null default '{}',created_at timestamptz not null default now(),unique(user_id,asset_type,idempotency_key));
create index ledger_user_time_idx on public.economy_transactions(user_id,created_at desc);
create table public.daily_checkins(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,
 checkin_date date not null,streak_days integer not null check(streak_days>0),reward_eggs integer not null,reward_exp integer not null,created_at timestamptz not null default now(),unique(user_id,checkin_date));
create table public.task_definitions(id text primary key,name text not null,frequency text not null check(frequency in('daily','weekly')),event text not null,target integer not null check(target>0),reward_eggs integer not null check(reward_eggs>=0),reward_exp integer not null check(reward_exp>=0));
insert into public.task_definitions values
 ('daily_read','有效阅读 2 篇文章','daily','read',2,1,5),('daily_like','点赞 3 篇不同文章','daily','like',3,1,5),
 ('daily_discuss','参与 1 次有效讨论','daily','discussion',1,2,10),('daily_community','在社区查看一条讨论','daily','community',1,0,5),
 ('weekly_read','本周有效阅读 10 篇','weekly','read',10,5,30),('weekly_checkin','本周签到 5 天','weekly','checkin',5,5,30),
 ('weekly_discuss','本周参与 3 次有效讨论','weekly','discussion',3,5,30),
 ('weekly_active20','本周活跃度达到 20','weekly','activity',20,1,5),('weekly_active50','本周活跃度达到 50','weekly','activity',50,1,10),('weekly_active100','本周活跃度达到 100','weekly','activity',100,2,15);
create table public.daily_task_progress(user_id uuid references public.profiles(id) on delete cascade,task_id text references public.task_definitions(id),period_start date not null,progress integer not null default 0,rewarded_at timestamptz,primary key(user_id,task_id,period_start));
create table public.weekly_task_progress(like public.daily_task_progress including all);
alter table public.weekly_task_progress add foreign key(user_id) references public.profiles(id) on delete cascade;
alter table public.weekly_task_progress add foreign key(task_id) references public.task_definitions(id);
create table app_private.community_events(user_id uuid references public.profiles(id) on delete cascade,event text not null,reference text not null,event_date date not null,created_at timestamptz not null default now(),primary key(user_id,event,reference,event_date));
create index events_user_date_idx on app_private.community_events(user_id,event_date,event);
create table public.achievement_definitions(id text primary key,code text not null unique,name text not null,description text not null,icon_key text not null default 'book',category text not null,hidden boolean not null default false,metric text not null,target integer not null,reward_eggs integer not null default 0,reward_exp integer not null default 0,created_at timestamptz not null default now());
insert into public.achievement_definitions(id,code,name,description,category,metric,target,reward_eggs) values
 ('first_checkin','first_checkin','初次赴约','完成第一次签到','checkin','checkin',1,0),('streak7','streak7','七日不辍','连续签到七天','checkin','streak',7,0),
 ('streak30','streak30','月下常客','连续签到三十天','checkin','streak',30,20),('streak100','streak100','百日读者','连续签到一百天','checkin','streak',100,0),
 ('read10','read10','翻页之间','有效阅读十篇文章','reading','read',10,0),('read100','read100','常驻书房','有效阅读一百篇文章','reading','read',100,0),
 ('comment1','comment1','初有回声','第一次有效讨论','discussion','discussion',1,0),('comment20','comment20','纸上相逢','参与二十次有效讨论','discussion','discussion',20,0),
 ('egg1','egg1','破壳一刻','第一次投掷臭鸡蛋','egg','spent',1,0),('egg50','egg50','有话直说','累计投出五十枚臭鸡蛋','egg','spent',50,0),
 ('egg500','egg500','满纸飞蛋','累计投出五百枚臭鸡蛋','egg','spent',500,0),('bookmark20','bookmark20','夹页藏珍','收藏二十篇作品','reading','bookmark',20,0);
create table public.user_achievements(user_id uuid references public.profiles(id) on delete cascade,achievement_id text references public.achievement_definitions(id),progress bigint not null default 0,unlocked_at timestamptz,primary key(user_id,achievement_id));
alter table public.profiles add column featured_achievement text references public.achievement_definitions(id);

do $$ declare t text; begin
 foreach t in array array['economy_rules','user_wallets','user_progress','economy_transactions','daily_checkins','task_definitions','daily_task_progress','weekly_task_progress','achievement_definitions','user_achievements'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 if t in('economy_rules','user_progress','task_definitions','achievement_definitions','user_achievements') then
   execute format('grant select on public.%I to anon',t);execute format('create policy read_public on public.%I for select using(true)',t);
 else execute format('create policy read_own on public.%I for select using(user_id=(select auth.uid()))',t); end if;
 end loop;
end $$;
alter table app_private.site_config enable row level security;
alter table app_private.community_events enable row level security;
create function app_private.today() returns date language sql stable security definer set search_path='' as $$ select (now() at time zone timezone)::date from app_private.site_config where id $$;
create function app_private.initialize_growth() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into public.user_wallets(user_id) values(new.id);insert into public.user_progress(user_id) values(new.id);return new;end $$;
create trigger on_profile_growth after insert on public.profiles for each row execute function app_private.initialize_growth();
insert into public.user_wallets(user_id) select id from public.profiles;
insert into public.user_progress(user_id) select id from public.profiles;

create function app_private.award(u uuid,eggs integer,xp integer,why text,ref text,idem text) returns void language plpgsql security definer set search_path='' as $$
declare w public.user_wallets; balance_xp bigint;
begin
 select * into w from public.user_wallets where user_id=u for update;
 if exists(select 1 from public.economy_transactions where user_id=u and idempotency_key=idem) then return;end if;
 if w.egg_balance+eggs<0 then raise exception 'INSUFFICIENT_EGGS';end if;
 if eggs<>0 then
 update public.user_wallets set egg_balance=egg_balance+eggs,lifetime_earned_eggs=lifetime_earned_eggs+greatest(eggs,0),lifetime_spent_eggs=lifetime_spent_eggs+greatest(-eggs,0),updated_at=now() where user_id=u;
 insert into public.economy_transactions(user_id,asset_type,delta,balance_after,reason,reference_type,reference_id,idempotency_key) values(u,'egg',eggs,w.egg_balance+eggs,why,why,ref,idem);
 end if;
 if xp<>0 then
 update public.user_progress set exp=exp+xp,updated_at=now() where user_id=u returning exp into balance_xp;
 insert into public.economy_transactions(user_id,asset_type,delta,balance_after,reason,reference_type,reference_id,idempotency_key) values(u,'exp',xp,balance_xp,why,why,ref,idem);
 end if;
end $$;
create function app_private.refresh_achievements(u uuid) returns void language plpgsql security definer set search_path='' as $$
declare d public.achievement_definitions;n bigint; old_unlock timestamptz;
begin
 for d in select * from public.achievement_definitions loop
 if d.metric='streak' then select coalesce(max(streak_days),0) into n from public.daily_checkins where user_id=u;
 elsif d.metric='checkin' then select count(*) into n from public.daily_checkins where user_id=u;
 elsif d.metric='spent' then select lifetime_spent_eggs into n from public.user_wallets where user_id=u;
 else select count(distinct reference) into n from app_private.community_events where user_id=u and event=d.metric;end if;
 select unlocked_at into old_unlock from public.user_achievements where user_id=u and achievement_id=d.id;
 insert into public.user_achievements(user_id,achievement_id,progress,unlocked_at) values(u,d.id,n,case when n>=d.target then now() end)
 on conflict(user_id,achievement_id) do update set progress=greatest(user_achievements.progress,excluded.progress),unlocked_at=coalesce(user_achievements.unlocked_at,excluded.unlocked_at);
 if n>=d.target and old_unlock is null then perform app_private.award(u,d.reward_eggs,d.reward_exp,'achievement',d.id,'achievement:'||d.id);end if;
 end loop;
end $$;
create function app_private.record_event(u uuid,event_name text,ref text,d date default app_private.today()) returns void language plpgsql security definer set search_path='' as $$
declare t public.task_definitions;p date;n integer;tbl text;already timestamptz;
begin
 insert into app_private.community_events(user_id,event,reference,event_date) values(u,event_name,ref,d) on conflict do nothing;
 for t in select * from public.task_definitions where event=event_name or event='activity' loop
 p:=case when t.frequency='daily' then d else date_trunc('week',d::timestamp)::date end;
 if t.event='activity' then
 select coalesce(sum(least(cnt,case when ev='read' then 10 when ev='discussion' then 3 when ev='like' then 10 else 7 end)*case when ev='checkin' then 5 when ev='read' then 3 when ev='discussion' then 5 else 1 end),0) into n
 from(select event ev,count(distinct reference) cnt from app_private.community_events where user_id=u and event_date between p and p+6 and event in('checkin','read','discussion','like','community') group by event)s;
 else select count(distinct reference) into n from app_private.community_events where user_id=u and event=t.event and event_date between p and case when t.frequency='daily' then p else p+6 end;end if;
 tbl:=case when t.frequency='daily' then 'daily_task_progress' else 'weekly_task_progress' end;
 execute format('insert into public.%I(user_id,task_id,period_start,progress) values($1,$2,$3,$4) on conflict(user_id,task_id,period_start) do update set progress=greatest(%I.progress,excluded.progress) returning rewarded_at',tbl,tbl) into already using u,t.id,p,least(n,t.target);
 if n>=t.target and already is null then
 perform app_private.award(u,t.reward_eggs,t.reward_exp,t.frequency||'_task',t.id,'task:'||t.id||':'||p);
 execute format('update public.%I set rewarded_at=now() where user_id=$1 and task_id=$2 and period_start=$3',tbl) using u,t.id,p;
 end if;
 end loop;
 perform app_private.refresh_achievements(u);
end $$;
create function app_private.checkin_at(u uuid,d date) returns public.daily_checkins language plpgsql security definer set search_path='' as $$
declare c public.daily_checkins; prev public.daily_checkins;s integer;tier integer;r public.economy_rules;
begin
 perform 1 from public.user_wallets where user_id=u for update;
 select * into c from public.daily_checkins where user_id=u and checkin_date=d;if found then return c;end if;
 select * into prev from public.daily_checkins where user_id=u and checkin_date<d order by checkin_date desc limit 1;
 s:=case when prev.checkin_date=d-1 then prev.streak_days+1 else 1 end;tier:=((s-1)%7)+1;
 select * into r from public.economy_rules where id;
 insert into public.daily_checkins(user_id,checkin_date,streak_days,reward_eggs,reward_exp) values(u,d,s,r.checkin_eggs[tier],r.checkin_exp[tier]) returning * into c;
 perform app_private.award(u,c.reward_eggs,c.reward_exp,'daily_checkin',d::text,'checkin:'||d);
 perform app_private.record_event(u,'checkin',d::text,d);return c;
end $$;
create function public.daily_checkin() returns public.daily_checkins language plpgsql security definer set search_path='' as $$
declare u uuid:=app_private.require_actor();begin perform app_private.rate_limit(u,'checkin',15);return app_private.checkin_at(u,app_private.today());end $$;
create function public.growth_summary() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();d date:=app_private.today();w date:=date_trunc('week',d::timestamp)::date;
begin
 if u is null then raise exception 'AUTH_REQUIRED';end if;
 return jsonb_build_object('today',d,'week_start',w,'wallet',(select to_jsonb(x) from public.user_wallets x where user_id=u),
 'progress',(select to_jsonb(x) from public.user_progress x where user_id=u),
 'today_checkin',(select to_jsonb(x) from public.daily_checkins x where user_id=u and checkin_date=d),
 'last_checkin',(select to_jsonb(x) from public.daily_checkins x where user_id=u order by checkin_date desc limit 1),
 'streak_days',coalesce((select streak_days from public.daily_checkins where user_id=u and checkin_date in(d,d-1) order by checkin_date desc limit 1),0),
 'total_checkins',(select count(*) from public.daily_checkins where user_id=u),
 'tasks',(select coalesce(jsonb_agg(to_jsonb(t)||jsonb_build_object('progress',coalesce(p.progress,0),'rewarded_at',p.rewarded_at)),'[]') from public.task_definitions t left join
 (select task_id,progress,rewarded_at from public.daily_task_progress where user_id=u and period_start=d union all select task_id,progress,rewarded_at from public.weekly_task_progress where user_id=u and period_start=w)p on p.task_id=t.id));
end $$;
create function public.select_achievement(p_achievement text) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=app_private.require_actor();begin
 if p_achievement is not null and not exists(select 1 from public.user_achievements where user_id=u and achievement_id=p_achievement and unlocked_at is not null) then raise exception 'ACHIEVEMENT_LOCKED';end if;
 update public.profiles set featured_achievement=p_achievement where id=u;
end $$;
revoke all on all functions in schema app_private from public,anon,authenticated;
revoke all on function public.daily_checkin(),public.growth_summary(),public.select_achievement(text) from public,anon;
grant execute on function public.daily_checkin(),public.growth_summary(),public.select_achievement(text) to authenticated;
