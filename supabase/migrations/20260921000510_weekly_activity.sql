-- A 100-point milestone must be reachable: allow 20 unique qualified reads per week.
create or replace function app_private.record_event(u uuid,event_name text,ref text,d date default app_private.today()) returns void language plpgsql security definer set search_path='' as $$
declare t public.task_definitions;p date;n integer;tbl text;already timestamptz;
begin
 insert into app_private.community_events(user_id,event,reference,event_date) values(u,event_name,ref,d) on conflict do nothing;
 for t in select * from public.task_definitions where event=event_name or event='activity' loop
 p:=case when t.frequency='daily' then d else date_trunc('week',d::timestamp)::date end;
 if t.event='activity' then
 select coalesce(sum(least(cnt,case when ev='read' then 20 when ev='discussion' then 3 when ev='like' then 10 else 7 end)*case when ev='checkin' then 5 when ev='read' then 3 when ev='discussion' then 5 else 1 end),0) into n
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
