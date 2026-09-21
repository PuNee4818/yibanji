create table public.notifications(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,kind text not null check(kind in('reply','like','follow','system')),target_key text not null,actor_id uuid references public.profiles(id) on delete set null,actor_count integer not null default 0,title text not null,href text not null check(href like '/%' and href not like '//%'),read_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(user_id,kind,target_key));
create index notifications_owner_unread_idx on public.notifications(user_id,read_at,updated_at desc);
create table app_private.notification_events(notification_id uuid references public.notifications(id) on delete cascade,event_key text not null,primary key(notification_id,event_key));
create table public.reports(id uuid primary key default gen_random_uuid(),reporter_id uuid not null references public.profiles(id) on delete cascade,target_kind text not null check(target_kind in('comment','community_post','community_post_comment','profile')),target_id uuid not null,reason text not null check(char_length(reason) between 5 and 1000),status text not null default 'pending' check(status in('pending','resolved','dismissed')),resolved_by uuid references public.profiles(id) on delete set null,resolution text,created_at timestamptz not null default now(),resolved_at timestamptz,unique(reporter_id,target_kind,target_id));
create index reports_queue_idx on public.reports(status,created_at desc);
create table app_private.moderation_audit(id uuid primary key default gen_random_uuid(),admin_id uuid references public.profiles(id) on delete set null,target_kind text not null,target_id text not null,action text not null,reason text not null,idempotency_key uuid unique,payload jsonb not null default '{}',created_at timestamptz not null default now());
create index moderation_audit_target_idx on app_private.moderation_audit(target_kind,target_id,created_at desc);
alter table public.notifications enable row level security;alter table public.reports enable row level security;
alter table app_private.notification_events enable row level security;alter table app_private.moderation_audit enable row level security;
revoke all on public.notifications,public.reports from anon,authenticated;
grant select on public.notifications,public.reports to authenticated;
create policy owner_read on public.notifications for select using(user_id=(select auth.uid()));
create policy reporter_read on public.reports for select using(reporter_id=(select auth.uid()));

create function app_private.notify(recipient uuid,actor uuid,k text,target text,label text,link text,event_id text) returns void language plpgsql security definer set search_path='' as $$
declare n uuid;begin
 if recipient is null or recipient=actor then return;end if;
 insert into public.notifications(user_id,kind,target_key,title,href) values(recipient,k,target,label,link) on conflict do nothing;
 select id into n from public.notifications where user_id=recipient and kind=k and target_key=target for update;
 insert into app_private.notification_events values(n,event_id) on conflict do nothing;
 if found then update public.notifications set actor_id=actor,actor_count=actor_count+1,title=label,href=link,read_at=null,updated_at=now() where id=n;end if;
end $$;
create function app_private.notify_follow() returns trigger language plpgsql security definer set search_path='' as $$
begin perform app_private.notify(new.following_id,new.follower_id,'follow',new.follower_id::text,'关注了你','/u/'||(select username from public.profiles where id=new.follower_id)||'/',new.follower_id::text);return null;end $$;
create trigger follow_notification after insert on public.user_follows for each row execute function app_private.notify_follow();
create function app_private.notify_discussion() returns trigger language plpgsql security definer set search_path='' as $$
declare recipient uuid;k text;target text;link text;begin
 if TG_TABLE_NAME='comments' then
  if new.parent_id is null then return null;end if;
  select user_id into recipient from public.comments where id=new.parent_id;k:='reply';target:='comment:'||new.parent_id;
  link:='/articles/'||new.article_id||'/#comment-'||new.id;
 else
  if new.parent_id is null then select user_id into recipient from public.community_posts where id=new.post_id;
  else select user_id into recipient from public.community_post_comments where id=new.parent_id;end if;
  k:='reply';target:='post:'||coalesce(new.parent_id,new.post_id);link:='/community/posts/'||new.post_id||'/#comment-'||new.id;
 end if;
 perform app_private.notify(recipient,new.user_id,k,target,'在讨论中回复了你',link,new.user_id::text);return null;
end $$;
create trigger comment_notification after insert on public.comments for each row execute function app_private.notify_discussion();
create trigger post_comment_notification after insert on public.community_post_comments for each row execute function app_private.notify_discussion();
create function app_private.notify_like() returns trigger language plpgsql security definer set search_path='' as $$
declare item public.discussion_items;k text;link text;begin
 k:=case TG_TABLE_NAME when 'comment_likes' then 'article' when 'community_post_likes' then 'post' else 'post_comment' end;
 select * into item from public.discussion_items where id=new.target_id and kind=k;
 link:=case k when 'article' then '/articles/'||item.target||'/#comment-'||item.id when 'post' then '/community/posts/'||item.id||'/' else '/community/posts/'||item.target||'/#comment-'||item.id end;
 perform app_private.notify(item.user_id,new.user_id,'like',k||':'||item.id,'赞了你的'||case when k='post' then '动态' else '评论' end,link,new.user_id::text);return null;
end $$;
create trigger comment_like_notification after insert on public.comment_likes for each row execute function app_private.notify_like();
create trigger post_like_notification after insert on public.community_post_likes for each row execute function app_private.notify_like();
create trigger post_comment_like_notification after insert on public.community_post_comment_likes for each row execute function app_private.notify_like();
create function app_private.notify_achievement() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.unlocked_at is not null and (TG_OP='INSERT' or old.unlocked_at is null) then
 perform app_private.notify(new.user_id,null,'system','achievement:'||new.achievement_id,'获得勋章「'||(select name from public.achievement_definitions where id=new.achievement_id)||'」','/me/rewards/',new.achievement_id);end if;return null;
end $$;
create trigger achievement_notification after insert or update on public.user_achievements for each row execute function app_private.notify_achievement();
create function app_private.notify_checkin() returns trigger language plpgsql security definer set search_path='' as $$
begin if new.streak_days%7=0 then perform app_private.notify(new.user_id,null,'system','checkin:'||new.checkin_date,'连续签到 '||new.streak_days||' 天，今日奖励 '||new.reward_eggs||' 枚臭鸡蛋与 '||new.reward_exp||' EXP','/me/rewards/',new.checkin_date::text);end if;return null;end $$;
create trigger checkin_notification after insert on public.daily_checkins for each row execute function app_private.notify_checkin();
create function public.mark_notifications_read(p_ids uuid[] default null) returns void language plpgsql security definer set search_path='' as $$
begin if auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;update public.notifications set read_at=now() where user_id=auth.uid() and read_at is null and (p_ids is null or id=any(p_ids));end $$;
create function public.account_capabilities() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('is_admin',is_admin and status='normal','status',status) from app_private.account_states where user_id=auth.uid() $$;
create function app_private.require_admin() returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=app_private.require_actor();begin if not exists(select 1 from app_private.account_states where user_id=u and is_admin) then raise exception 'ADMIN_REQUIRED' using errcode='42501';end if;return u;end $$;
create function public.submit_report(p_kind text,p_id uuid,p_reason text) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=app_private.require_actor();r uuid;begin
 if p_kind is null or p_kind not in('comment','community_post','community_post_comment','profile') or p_reason is null or char_length(trim(p_reason)) not between 5 and 1000 then raise exception 'INVALID_REPORT' using errcode='22023';end if;
 select id into r from public.reports where reporter_id=u and target_kind=p_kind and target_id=p_id;if found then return r;end if;
 if p_kind='profile' then if not exists(select 1 from public.profiles where id=p_id) then raise exception 'TARGET_NOT_FOUND';end if;
 elsif not exists(select 1 from public.discussion_items where id=p_id and kind=case p_kind when 'comment' then 'article' when 'community_post' then 'post' else 'post_comment' end and status='visible') then raise exception 'TARGET_NOT_FOUND';end if;
 perform app_private.rate_limit(u,'report',5);
 insert into public.reports(reporter_id,target_kind,target_id,reason) values(u,p_kind,p_id,trim(p_reason)) returning id into r;return r;
end $$;
create function public.moderation_queue(p_tab text default 'pending',p_page integer default 0) returns jsonb language plpgsql security definer set search_path='' as $$
begin perform app_private.require_admin();
 if p_tab='users' then return(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from(select p.id,p.username,p.display_name,s.status,s.is_admin from public.profiles p join app_private.account_states s on s.user_id=p.id order by p.created_at desc limit 30 offset greatest(0,least(p_page,100))*30)x);end if;
 if p_tab in('comments','posts') then return(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from(select * from public.discussion_items where (p_tab='posts' and kind='post') or (p_tab='comments' and kind in('article','post_comment')) order by created_at desc limit 30 offset greatest(0,least(p_page,100))*30)x);end if;
 return(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from(select r.*,case when r.target_kind='profile' then (select display_name||' / '||bio from public.profiles where id=r.target_id) else (select content from public.discussion_items where id=r.target_id limit 1) end target_content from public.reports r where (p_tab='resolved' and status<>'pending') or (p_tab<>'resolved' and status='pending') order by created_at desc limit 30 offset greatest(0,least(p_page,100))*30)x);
end $$;
create function public.moderate(p_kind text,p_id uuid,p_action text,p_reason text,p_report uuid default null) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=app_private.require_admin();tbl text;n integer;begin
 if p_reason is null or char_length(trim(p_reason)) not between 5 and 1000 then raise exception 'REASON_REQUIRED';end if;
 if p_report is not null and not exists(select 1 from public.reports where id=p_report and target_kind=p_kind and target_id=p_id) then raise exception 'REPORT_TARGET_MISMATCH';end if;
 if p_action='dismiss' then if p_report is null then raise exception 'REPORT_REQUIRED';end if;
 elsif p_kind='profile' then
  if p_action not in('normal','restricted','suspended') or p_action is null or p_id=u or exists(select 1 from app_private.account_states where user_id=p_id and is_admin) then raise exception 'INVALID_ACTION';end if;
  update app_private.account_states set status=p_action where user_id=p_id;get diagnostics n=row_count;
 else
  tbl:=case p_kind when 'comment' then 'comments' when 'community_post' then 'community_posts' when 'community_post_comment' then 'community_post_comments' end;
  if tbl is null or p_action is null or p_action not in('visible','hidden','spam') then raise exception 'INVALID_ACTION';end if;
  execute format('update public.%I set status=$1,updated_at=now() where id=$2 and status<>''deleted''',tbl) using p_action,p_id;get diagnostics n=row_count;
 end if;
 if p_action<>'dismiss' and n=0 then raise exception 'TARGET_NOT_FOUND';end if;
 insert into app_private.moderation_audit(admin_id,target_kind,target_id,action,reason) values(u,p_kind,p_id::text,p_action,trim(p_reason));
 if p_report is not null then update public.reports set status=case when p_action='dismiss' then 'dismissed' else 'resolved' end,resolved_by=u,resolution=trim(p_reason),resolved_at=now() where id=p_report;end if;
 if p_kind='profile' and p_action<>'dismiss' then perform app_private.notify(p_id,null,'system','moderation:'||gen_random_uuid(),'账号状态已更新：'||p_action||'。原因：'||trim(p_reason),'/community/guidelines/',gen_random_uuid()::text);end if;
end $$;
create function public.admin_adjust_economy(p_user uuid,p_eggs integer,p_exp integer,p_reason text,p_key uuid) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=app_private.require_admin();old app_private.moderation_audit;payload jsonb:=jsonb_build_object('user',p_user,'eggs',p_eggs,'exp',p_exp,'reason',p_reason);begin
 if p_user is null or p_eggs is null or p_exp is null or abs(p_eggs::bigint)>10000 or abs(p_exp::bigint)>10000 or (p_eggs=0 and p_exp=0) or p_key is null or p_reason is null or char_length(trim(p_reason)) not between 5 and 1000 then raise exception 'INVALID_ADJUSTMENT';end if;
 perform 1 from public.user_wallets where user_id=p_user for update;if not found then raise exception 'TARGET_NOT_FOUND';end if;
 select * into old from app_private.moderation_audit where idempotency_key=p_key;
 if found then if old.admin_id<>u or old.payload<>payload then raise exception 'IDEMPOTENCY_CONFLICT';end if;return;end if;
 perform app_private.award(p_user,p_eggs,p_exp,'admin_adjustment',u::text,'admin:'||p_key);
 insert into app_private.moderation_audit(admin_id,target_kind,target_id,action,reason,idempotency_key,payload) values(u,'profile',p_user::text,'economy_adjustment',p_reason,p_key,payload);
 update public.economy_transactions set metadata=payload||jsonb_build_object('admin',u) where user_id=p_user and idempotency_key='admin:'||p_key;
 perform app_private.notify(p_user,null,'system','adjustment:'||p_key,'社区资产已调整：'||p_eggs||' 枚臭鸡蛋、'||p_exp||' EXP。原因：'||p_reason,'/me/rewards/',p_key::text);
end $$;

-- Hiding a post also hides its discussion from direct Data API reads.
drop policy read_visible on public.community_post_comments;
create policy read_visible on public.community_post_comments for select using(status in('visible','deleted') and exists(select 1 from public.community_posts p where p.id=post_id and p.status='visible'));
drop policy read_visible on public.comments;
create policy read_visible on public.comments for select using(status in('visible','deleted') and exists(select 1 from public.articles a where a.id=article_id and a.active));
create function public.profile_community(p_user uuid,p_page integer default 0) returns jsonb language sql stable security definer set search_path='' as $$
select jsonb_build_object('progress',(select to_jsonb(p) from public.user_progress p where user_id=p_user),
'featured',(select featured_achievement from public.profiles where id=p_user),
'badges',(select coalesce(jsonb_agg(to_jsonb(d)||jsonb_build_object('unlocked_at',u.unlocked_at)),'[]') from public.user_achievements u join public.achievement_definitions d on d.id=u.achievement_id where user_id=p_user and unlocked_at is not null),
'activity',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from(select * from public.discussion_items where user_id=p_user and status='visible' and kind in('article','post') and (target is null or exists(select 1 from public.articles where id=target and active)) order by created_at desc limit 20 offset greatest(0,least(p_page,100))*20)x)) $$;
revoke all on all functions in schema app_private from public,anon,authenticated;
revoke all on function public.mark_notifications_read(uuid[]),public.account_capabilities(),public.submit_report(text,uuid,text),public.moderation_queue(text,integer),public.moderate(text,uuid,text,text,uuid),public.admin_adjust_economy(uuid,integer,integer,text,uuid),public.profile_community(uuid,integer) from public,anon;
grant execute on function public.mark_notifications_read(uuid[]),public.account_capabilities(),public.submit_report(text,uuid,text),public.moderation_queue(text,integer),public.moderate(text,uuid,text,text,uuid),public.admin_adjust_economy(uuid,integer,integer,text,uuid) to authenticated;
grant execute on function public.profile_community(uuid,integer) to anon,authenticated;
