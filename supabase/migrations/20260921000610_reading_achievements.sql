-- Reading achievements count qualified article/day visits so 100 is attainable with a 54-work collection.
create or replace function app_private.refresh_achievements(u uuid) returns void language plpgsql security definer set search_path='' as $$
declare d public.achievement_definitions;n bigint; old_unlock timestamptz;
begin
 for d in select * from public.achievement_definitions loop
 if d.metric='streak' then select coalesce(max(streak_days),0) into n from public.daily_checkins where user_id=u;
 elsif d.metric='checkin' then select count(*) into n from public.daily_checkins where user_id=u;
 elsif d.metric='spent' then select lifetime_spent_eggs into n from public.user_wallets where user_id=u;
 elsif d.metric='read' then select count(*) into n from app_private.community_events where user_id=u and event='read';
 else select count(distinct reference) into n from app_private.community_events where user_id=u and event=d.metric;end if;
 select unlocked_at into old_unlock from public.user_achievements where user_id=u and achievement_id=d.id;
 insert into public.user_achievements(user_id,achievement_id,progress,unlocked_at) values(u,d.id,n,case when n>=d.target then now() end)
 on conflict(user_id,achievement_id) do update set progress=greatest(user_achievements.progress,excluded.progress),unlocked_at=coalesce(user_achievements.unlocked_at,excluded.unlocked_at);
 if n>=d.target and old_unlock is null then perform app_private.award(u,d.reward_eggs,d.reward_exp,'achievement',d.id,'achievement:'||d.id);end if;
 end loop;
end $$;

update public.achievement_definitions set description='累计有效阅读 '||target||' 篇次，同一文章每日最多计一次' where metric='read';
