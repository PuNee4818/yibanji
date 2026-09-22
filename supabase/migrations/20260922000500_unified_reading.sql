-- One article identity and one set of interactions. Keep legacy rows privately for recovery.
alter table public.articles add column source text not null default 'catalog' check(source in('catalog','submission'));
alter table public.articles add column author_id uuid references public.profiles(id) on delete set null;
insert into public.articles(id,title,author,category,active,published_at,source,author_id)
select s.id::text,s.title,p.display_name,s.genre,s.status='published',s.published_at,'submission',s.user_id
from public.submissions s join public.profiles p on p.id=s.user_id;
insert into public.article_stats(article_id) select id::text from public.submissions on conflict do nothing;
insert into public.article_likes(user_id,article_id,created_at) select user_id,submission_id::text,created_at from public.submission_likes on conflict do nothing;
insert into public.bookmarks(user_id,article_id,created_at) select user_id,submission_id::text,created_at from public.submission_bookmarks on conflict do nothing;
insert into public.reading_progress(user_id,article_id,position,updated_at) select user_id,submission_id::text,position,updated_at from public.submission_progress on conflict do nothing;
insert into public.comments(id,user_id,article_id,content,idempotency_key,created_at)
select id,user_id,submission_id::text,content,id,created_at from public.submission_comments on conflict do nothing;

alter table public.submission_likes set schema app_private;
alter table public.submission_bookmarks set schema app_private;
alter table public.submission_progress set schema app_private;
alter table public.submission_comments set schema app_private;
revoke all on app_private.submission_likes,app_private.submission_bookmarks,app_private.submission_progress,app_private.submission_comments from public,anon,authenticated;

create view public.submission_likes with(security_invoker=true) as
select a.id::uuid submission_id,l.user_id,l.created_at from public.article_likes l join public.articles a on a.id=l.article_id where a.source='submission' and a.active;
create view public.submission_bookmarks with(security_invoker=true) as
select a.id::uuid submission_id,b.user_id,b.created_at from public.bookmarks b join public.articles a on a.id=b.article_id where a.source='submission' and a.active;
create view public.submission_progress with(security_invoker=true) as
select a.id::uuid submission_id,r.user_id,r.position,r.updated_at from public.reading_progress r join public.articles a on a.id=r.article_id where a.source='submission' and a.active;
create view public.submission_comments with(security_invoker=true) as
select c.id,a.id::uuid submission_id,c.user_id,c.content,c.created_at from public.comments c join public.articles a on a.id=c.article_id where a.source='submission' and a.active and c.status='visible';
grant select on public.submission_likes,public.submission_bookmarks,public.submission_progress to authenticated;
grant select on public.submission_comments to anon,authenticated;
create or replace view public.submission_public with(security_invoker=true) as
select s.*,p.display_name,p.username,coalesce(a.like_count,0) like_count,coalesce(a.comment_count,0) comment_count,
coalesce(a.bookmark_count,0) bookmark_count,coalesce(a.view_count,0) view_count
from public.submissions s join public.profiles p on p.id=s.user_id left join public.article_stats a on a.article_id=s.id::text where s.status='published';
create or replace view public.submission_comment_items with(security_invoker=true) as
select c.*,p.display_name,p.username from public.submission_comments c join public.profiles p on p.id=c.user_id;

alter policy read_public on public.articles using(active);
alter policy read_public on public.article_stats using(exists(select 1 from public.articles a where a.id=article_id and a.active));
alter policy read_public on public.article_activity using(exists(select 1 from public.articles a where a.id=article_id and a.active));
alter policy read_visible on public.comments using(status in('visible','deleted') and exists(select 1 from public.articles a where a.id=article_id and a.active));

create function app_private.sync_submission_article() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='DELETE' then
   update public.articles set active=false,title='已删除的作品',author='作者',author_id=null where id=old.id::text;
   return old;
 end if;
 insert into public.articles(id,title,author,category,active,published_at,source,author_id)
 values(new.id::text,new.title,(select display_name from public.profiles where id=new.user_id),new.genre,new.status='published',new.published_at,'submission',new.user_id)
 on conflict(id) do update set title=excluded.title,author=excluded.author,category=excluded.category,active=excluded.active;
 insert into public.article_stats(article_id) values(new.id::text) on conflict do nothing;
 return new;
end $$;
create trigger submission_article_sync after insert or update or delete on public.submissions for each row execute function app_private.sync_submission_article();

-- Compatibility functions delegate to the common system, never dual-write.
create or replace function public.set_submission_mark(p_id uuid,p_kind text,p_value boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_value is null or p_kind is null or p_kind not in('like','bookmark') then raise exception 'INVALID_ACTION';end if;
 perform public.set_article_state(p_id::text,p_kind,p_value);
end $$;
create or replace function public.save_submission_progress(p_id uuid,p_position numeric) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=app_private.require_actor();
begin
 perform app_private.assert_article(p_id::text);
 if p_position is null or p_position not between 0 and 1 then raise exception 'INVALID_POSITION';end if;
 perform app_private.rate_limit(u,'submission_progress',30);
 insert into public.reading_progress(user_id,article_id,position) values(u,p_id::text,p_position)
 on conflict(user_id,article_id) do update set position=p_position,updated_at=now();
end $$;
create or replace function public.save_submission_comment(p_id uuid,p_submission uuid,p_content text) returns uuid language plpgsql security definer set search_path='' as $$
begin return public.save_discussion('article',p_submission::text,p_content,null,null,p_id);end $$;
create or replace function public.delete_submission_comment(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
 select id into target from public.comments where id=p_id or (idempotency_key=p_id and user_id=auth.uid());
 perform public.delete_discussion('article',target);
end $$;

-- Immutable reward claims survive withdrawal and deletion, closing republish and toggle loops.
create table app_private.writing_rewards(
 author_id uuid references public.profiles(id) on delete cascade, article_id text not null,
 actor_id uuid references public.profiles(id) on delete cascade, kind text not null,
 fingerprint text, amount integer not null check(amount>=0), day date not null default app_private.today(),
 created_at timestamptz not null default now(), primary key(author_id,article_id,actor_id,kind)
);
create unique index writing_reward_content on app_private.writing_rewards(author_id,fingerprint) where kind='publish';
create index writing_reward_day on app_private.writing_rewards(author_id,day);
alter table app_private.writing_rewards enable row level security;
revoke all on app_private.writing_rewards from public,anon,authenticated;

create function app_private.reward_publication() returns trigger language plpgsql security definer set search_path='' as $$
declare body_key text;letters text;n integer;first_work boolean;
begin
 if new.status<>'published' then return null;end if;
 letters:=regexp_replace(new.body,'[^[:alnum:]]','','g');
 if char_length(letters)<(case when new.genre in('poetry','classical','ci') then 20 else 120 end) or letters ~ '^(.)\1*$' then return null;end if;
 body_key:=md5(lower(letters));
 perform 1 from public.user_wallets where user_id=new.user_id for update;
 if exists(select 1 from app_private.writing_rewards where author_id=new.user_id and kind='publish' and (article_id=new.id::text or fingerprint=body_key)) then return null;end if;
 select count(*) into n from app_private.writing_rewards where author_id=new.user_id and kind='publish' and day=app_private.today() and amount>0;
 first_work:=not exists(select 1 from app_private.writing_rewards where author_id=new.user_id and kind='publish' and amount>0);
 insert into app_private.writing_rewards(author_id,article_id,actor_id,kind,fingerprint,amount)
 values(new.user_id,new.id::text,new.user_id,'publish',body_key,case when n<2 then 60 else 0 end);
 if n<2 then
   perform app_private.award(new.user_id,0,60,'submission_publish',new.id::text,'writing:publish:'||new.id);
   if first_work then perform app_private.award(new.user_id,0,40,'submission_debut',new.id::text,'writing:debut');end if;
 end if;
 return null;
end $$;
create trigger submission_publication_reward after insert or update on public.submissions for each row execute function app_private.reward_publication();

create function app_private.reward_recognition(a text,actor uuid,k text) returns void language plpgsql security definer set search_path='' as $$
declare owner uuid;daily integer;pair integer;points integer;
begin
 select author_id into owner from public.articles where id=a and active and source='submission';
 if owner is null or owner=actor then return;end if;
 -- A mature account and qualified reading are required for author rewards, not for interacting.
 if not exists(select 1 from public.profiles where id=actor and created_at<=now()-interval '24 hours')
 or not exists(select 1 from app_private.community_events where user_id=actor and event='read' and reference=a) then return;end if;
 perform 1 from public.user_wallets where user_id=owner for update;
 if exists(select 1 from app_private.writing_rewards where author_id=owner and article_id=a and actor_id=actor and kind=k) then return;end if;
 select coalesce(sum(amount),0),coalesce(sum(amount) filter(where actor_id=actor),0) into daily,pair
 from app_private.writing_rewards where author_id=owner and day=app_private.today() and kind in('like','bookmark');
 points:=greatest(0,least(case k when 'like' then 8 else 12 end,200-daily,40-pair));
 insert into app_private.writing_rewards(author_id,article_id,actor_id,kind,amount) values(owner,a,actor,k,points);
 if points>0 then perform app_private.award(owner,0,points,'submission_'||k,a,'writing:'||k||':'||gen_random_uuid());end if;
end $$;

create or replace function public.set_article_state(p_article text,p_kind text,p_active boolean) returns boolean language plpgsql security definer set search_path='' as $$
declare u uuid:=app_private.require_actor();tbl text;n integer;owner uuid;
begin
 perform app_private.assert_article(p_article);perform app_private.rate_limit(u,'article_state',60);
 if p_active is null or p_kind not in('like','bookmark') or p_kind is null then raise exception 'INVALID_KIND';end if;
 select author_id into owner from public.articles where id=p_article and source='submission';
 -- Stable ordering prevents reciprocal interactions from locking wallets in opposite orders.
 perform 1 from public.user_wallets where user_id in(u,owner) order by user_id for update;
 tbl:=case when p_kind='like' then 'article_likes' else 'bookmarks' end;
 if p_active then
   execute format('insert into public.%I(user_id,article_id) values($1,$2) on conflict do nothing',tbl) using u,p_article;get diagnostics n=row_count;
   if n>0 then
     if not exists(select 1 from app_private.community_events where user_id=u and event=p_kind and reference=p_article and event_date=app_private.today()) then
       insert into public.article_activity(article_id,day,likes,bookmarks) values(p_article,app_private.today(),case when p_kind='like' then 1 else 0 end,case when p_kind='bookmark' then 1 else 0 end)
       on conflict(article_id,day) do update set likes=article_activity.likes+excluded.likes,bookmarks=article_activity.bookmarks+excluded.bookmarks;
     end if;
     perform app_private.record_event(u,p_kind,p_article);
     perform app_private.reward_recognition(p_article,u,p_kind);
     if p_kind='like' then perform app_private.notify(owner,u,'like','article:'||p_article,'赞了你的作品','/submissions/'||p_article||'/',u::text);end if;
   end if;
 else execute format('delete from public.%I where user_id=$1 and article_id=$2',tbl) using u,p_article;
 end if;
 return p_active;
end $$;

create function app_private.article_href(a text) returns text language sql stable security definer set search_path='' as $$
select case when source='submission' then '/submissions/' else '/articles/' end||id||'/' from public.articles where id=a $$;

-- Existing work and interactions are retained without retroactive reward claims.
insert into app_private.writing_rewards(author_id,article_id,actor_id,kind,fingerprint,amount)
select user_id,id::text,user_id,'publish',md5(lower(regexp_replace(body,'[^[:alnum:]]','','g'))),0 from public.submissions on conflict do nothing;
insert into app_private.writing_rewards(author_id,article_id,actor_id,kind,amount)
select s.user_id,l.submission_id::text,l.user_id,'like',0 from app_private.submission_likes l join public.submissions s on s.id=l.submission_id on conflict do nothing;
insert into app_private.writing_rewards(author_id,article_id,actor_id,kind,amount)
select s.user_id,b.submission_id::text,b.user_id,'bookmark',0 from app_private.submission_bookmarks b join public.submissions s on s.id=b.submission_id on conflict do nothing;

-- Site-only discovery: no unsolicited external or browser notifications.
create function public.submission_highlights() returns jsonb language sql stable security definer set search_path='' as $$
select jsonb_build_object(
 'popular',public.submission_feed(p_sort=>'popular'),
 'topics',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (
   select tag,count(*) works from public.submissions s cross join lateral unnest(s.tags) tag
   where status='published' and published_at>now()-interval '30 days' group by tag order by works desc,tag limit 8
 )x)) $$;
revoke all on function public.submission_highlights() from public;
grant execute on function public.submission_highlights() to anon,authenticated;
revoke all on all functions in schema app_private from public,anon,authenticated;

create or replace function public.submission_feed(p_query text default '',p_genre text default '',p_tag text default '',p_sort text default 'latest',p_page integer default 0,p_user uuid default null,p_short boolean default false)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if p_query is null or char_length(p_query)>100 or p_genre is null or p_tag is null or p_sort is null or p_sort not in('latest','popular','following','random','bookmarks','history') or p_page is null or p_page not between 0 and 10000 or p_short is null then raise exception 'INVALID_FILTER';end if;
 if p_sort in('following','bookmarks','history') and auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;
 return (select coalesce(jsonb_agg(to_jsonb(x)),'[]') from(
 select s.id,s.user_id,s.title,s.genre,s.tags,s.summary,s.word_count,s.published_at,s.updated_at,p.display_name,p.username,
 coalesce(stats.like_count,0) like_count, coalesce(stats.comment_count,0) comment_count, coalesce(stats.bookmark_count,0) bookmark_count, coalesce(stats.view_count,0) view_count
 from public.submissions s join public.profiles p on p.id=s.user_id left join public.article_stats stats on stats.article_id=s.id::text
 where s.status='published' and (p_user is null or s.user_id=p_user)
 and (p_genre='' or s.genre=p_genre)
 and (p_tag='' or p_tag=any(s.tags)) and (not p_short or s.word_count<=1000)
 and not exists(select 1 from regexp_split_to_table(trim(p_query),'\s+') term where term<>'' and strpos(lower(s.title||' '||s.body||' '||p.display_name||' '||p.username||' '||array_to_string(s.tags,' ')),lower(term))=0)
 and (p_sort<>'following' or exists(select 1 from public.user_follows f where f.follower_id=auth.uid() and f.following_id=s.user_id))
 and (p_sort<>'bookmarks' or exists(select 1 from public.submission_bookmarks b where b.submission_id=s.id and b.user_id=auth.uid()))
 and (p_sort<>'history' or exists(select 1 from public.submission_progress h where h.submission_id=s.id and h.user_id=auth.uid()))
 order by case when p_sort='popular' then ((select count(*)*3 from public.article_likes l where l.article_id=s.id::text and l.created_at>now()-interval '7 days')+(select count(*)*4 from public.bookmarks b where b.article_id=s.id::text and b.created_at>now()-interval '7 days')+(select count(distinct c.user_id)*2 from public.comments c where c.article_id=s.id::text and c.status='visible' and c.created_at>now()-interval '7 days')+ln(1+coalesce((select sum(v.views) from public.article_activity v where v.article_id=s.id::text and v.day>=app_private.today()-6),0))+1)/power(greatest(extract(epoch from(now()-s.published_at))/86400,0)+2,0.5) end desc,
 case when p_sort='random' then md5(s.id::text||now()::text) end,
 case when p_sort='history' then (select h.updated_at from public.submission_progress h where h.submission_id=s.id and h.user_id=auth.uid()) end desc,
 case when p_sort='bookmarks' then (select b.created_at from public.submission_bookmarks b where b.submission_id=s.id and b.user_id=auth.uid()) end desc,
 s.published_at desc,s.id desc limit 20 offset p_page*20
 ) x);
end $$;

create or replace view public.discussion_items with(security_invoker=true) as
select d.*,
  case when d.kind='post' and d.status='visible' then p.title else null end as title,
  case when d.kind='post' and d.status='visible' then p.topic else null end as topic,
  coalesce(g.level,1) as level,
  (coalesce(case when d.status='visible' then p.title end,'') || ' ' || d.content) as search_text
from (
select 'article'::text kind,c.id,c.user_id,c.article_id::text target,c.parent_id,c.content,c.status,c.created_at,c.updated_at,p.username,p.display_name,p.featured_achievement,
(select count(*) from public.comment_likes l where l.target_id=c.id) like_count,(select count(*) from public.comments r where r.parent_id=c.id and r.status='visible') reply_count,
exists(select 1 from public.comment_likes l where l.target_id=c.id and l.user_id=auth.uid()) liked
from public.comments c join public.profiles p on p.id=c.user_id where exists(select 1 from public.articles a where a.id=c.article_id and a.active)
union all
select 'post',c.id,c.user_id,c.article_id,null::uuid,c.content,c.status,c.created_at,c.updated_at,p.username,p.display_name,p.featured_achievement,
(select count(*) from public.community_post_likes l where l.target_id=c.id),(select count(*) from public.community_post_comments r where r.post_id=c.id and r.status='visible'),
exists(select 1 from public.community_post_likes l where l.target_id=c.id and l.user_id=auth.uid())
from public.community_posts c join public.profiles p on p.id=c.user_id
union all
select 'post_comment',c.id,c.user_id,c.post_id::text,c.parent_id,c.content,c.status,c.created_at,c.updated_at,p.username,p.display_name,p.featured_achievement,
(select count(*) from public.community_post_comment_likes l where l.target_id=c.id),(select count(*) from public.community_post_comments r where r.parent_id=c.id and r.status='visible'),
exists(select 1 from public.community_post_comment_likes l where l.target_id=c.id and l.user_id=auth.uid())
from public.community_post_comments c join public.profiles p on p.id=c.user_id
) d
left join public.community_posts p on d.kind='post' and p.id=d.id
left join public.user_progress g on g.user_id=d.user_id;



create or replace function app_private.notify_discussion() returns trigger language plpgsql security definer set search_path='' as $$
declare recipient uuid;k text;target text;link text;begin
 if TG_TABLE_NAME='comments' then
  if new.parent_id is null then
    perform app_private.notify((select author_id from public.articles where id=new.article_id),new.user_id,'reply','article:'||new.article_id,'评论了你的作品',app_private.article_href(new.article_id)||'#comment-'||new.id,new.id::text);
    return null;end if;
  select user_id into recipient from public.comments where id=coalesce(new.reply_to_id,new.parent_id);k:='reply';target:='comment:'||coalesce(new.reply_to_id,new.parent_id);
  link:=app_private.article_href(new.article_id)||'#comment-'||new.id;
 else
  if new.parent_id is null then select user_id into recipient from public.community_posts where id=new.post_id;
  else select user_id into recipient from public.community_post_comments where id=coalesce(new.reply_to_id,new.parent_id);end if;
  k:='reply';target:='post:'||coalesce(new.reply_to_id,new.parent_id,new.post_id);link:='/community/posts/'||new.post_id||'/#comment-'||new.id;
 end if;
 perform app_private.notify(recipient,new.user_id,k,target,'在讨论中回复了你',link,new.user_id::text);return null;
end $$;

create or replace function app_private.notify_like() returns trigger language plpgsql security definer set search_path='' as $$
declare item public.discussion_items;k text;link text;begin
 k:=case TG_TABLE_NAME when 'comment_likes' then 'article' when 'community_post_likes' then 'post' else 'post_comment' end;
 select * into item from public.discussion_items where id=new.target_id and kind=k;
 link:=case k when 'article' then app_private.article_href(item.target)||'#comment-'||item.id when 'post' then '/community/posts/'||item.id||'/' else '/community/posts/'||item.target||'/#comment-'||item.id end;
 perform app_private.notify(item.user_id,new.user_id,'like',k||':'||item.id,'赞了你的'||case when k='post' then '动态' else '评论' end,link,new.user_id::text);return null;
end $$;

create or replace function public.article_context(p_article text) returns jsonb language plpgsql stable security definer set search_path='' as $$ begin perform app_private.assert_article(p_article); return (
select jsonb_build_object('stats',(select to_jsonb(s) from public.article_stats s where article_id=p_article),
'liked',exists(select 1 from public.article_likes where user_id=auth.uid() and article_id=p_article),'bookmarked',exists(select 1 from public.bookmarks where user_id=auth.uid() and article_id=p_article),
'my_eggs',(select coalesce(sum(quantity),0) from public.egg_throws where user_id=auth.uid() and article_id=p_article),
'balance',(select egg_balance from public.user_wallets where user_id=auth.uid()))); end $$;

create or replace function public.sync_reading(p_session uuid,p_depth numeric,p_chapter integer,p_position numeric) returns boolean language plpgsql security definer set search_path='' as $$
declare u uuid:=app_private.require_actor();s app_private.reading_sessions;elapsed integer;valid boolean;owner uuid;
begin
 perform app_private.rate_limit(u,'reading_sync',15);
 select * into s from app_private.reading_sessions where id=p_session and user_id=u and started_at>now()-interval '6 hours' for update;
 if not found then raise exception 'READING_SESSION_EXPIRED';end if;
 perform app_private.assert_article(s.article_id);
 select author_id into owner from public.articles where id=s.article_id;
 perform 1 from public.user_wallets where user_id in(u,owner) order by user_id for update;
 if p_depth is null or p_depth not between 0 and 1 or p_position is null or p_position not between 0 and 1 or p_chapter is null or p_chapter<1 or p_chapter>(select chapter_count from public.articles where id=s.article_id) then raise exception 'INVALID_PROGRESS';end if;
 elapsed:=floor(extract(epoch from clock_timestamp()-s.last_seen));
 update app_private.reading_sessions set active_seconds=active_seconds+case when elapsed between 1 and 25 then least(elapsed,15) else 0 end,last_seen=clock_timestamp(),max_depth=greatest(max_depth,p_depth) where id=p_session returning * into s;
 insert into public.reading_progress(user_id,article_id,chapter,position,max_depth) values(u,s.article_id,p_chapter,p_position,p_depth) on conflict(user_id,article_id) do update set chapter=excluded.chapter,position=excluded.position,max_depth=greatest(reading_progress.max_depth,excluded.max_depth),updated_at=now();
 valid:=s.active_seconds>=30 and s.max_depth>=0.3;
 if valid then
 perform app_private.record_event(u,'read',s.article_id);
 if exists(select 1 from public.article_likes where user_id=u and article_id=s.article_id) then perform app_private.reward_recognition(s.article_id,u,'like');end if;
 if exists(select 1 from public.bookmarks where user_id=u and article_id=s.article_id) then perform app_private.reward_recognition(s.article_id,u,'bookmark');end if;
 end if;return valid;
end $$;
revoke all on all functions in schema app_private from public,anon,authenticated;
notify pgrst, 'reload schema';
