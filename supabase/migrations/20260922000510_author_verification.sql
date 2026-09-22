alter table public.profiles add column author_verified boolean not null default false;
create table public.catalog_authors(name text primary key,user_id uuid references public.profiles(id) on delete set null);
insert into public.catalog_authors(name) select distinct author from public.articles where source='catalog';
alter table public.catalog_authors enable row level security;
revoke all on public.catalog_authors from public,anon,authenticated;
grant select on public.catalog_authors to anon,authenticated;
create policy public_read on public.catalog_authors for select using(true);

-- Explicitly requested accounts, matched to their existing catalog signatures.
update public.profiles set author_verified=true where id in('af294779-d20b-4527-8dea-61fc7d89c13e','09d1d95c-4b36-48fe-9994-1c23ef862252');
update public.catalog_authors set user_id='af294779-d20b-4527-8dea-61fc7d89c13e' where name='张贺然' and exists(select 1 from public.profiles where id='af294779-d20b-4527-8dea-61fc7d89c13e');
update public.catalog_authors set user_id='09d1d95c-4b36-48fe-9994-1c23ef862252' where name='王俊舾' and exists(select 1 from public.profiles where id='09d1d95c-4b36-48fe-9994-1c23ef862252');
update public.articles a set author_id=c.user_id from public.catalog_authors c where a.source='catalog' and a.author=c.name;
insert into app_private.moderation_audit(target_kind,target_id,action,reason)
select 'profile',id::text,'author_verified','Site owner requested verification of the two existing author accounts' from public.profiles
where id in('af294779-d20b-4527-8dea-61fc7d89c13e','09d1d95c-4b36-48fe-9994-1c23ef862252');

create or replace view public.profile_summaries with(security_invoker=true) as
select p.id,p.username,p.display_name,p.bio,p.created_at,p.updated_at,
(select count(*) from public.user_follows f where f.following_id=p.id) follower_count,
(select count(*) from public.user_follows f where f.follower_id=p.id) following_count,p.author_verified from public.profiles p;
create view public.catalog_author_profiles with(security_invoker=true) as
select c.name,c.user_id,p.username,p.display_name,p.author_verified,g.level from public.catalog_authors c left join public.profiles p on p.id=c.user_id left join public.user_progress g on g.user_id=c.user_id;
grant select on public.catalog_author_profiles to anon,authenticated;

create function public.set_author_verification(p_username text,p_verified boolean,p_reason text,p_key uuid,p_author text default '') returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=app_private.require_admin();target uuid;prior app_private.moderation_audit;
begin
 if p_verified is null or p_key is null or p_reason is null or char_length(trim(p_reason)) not between 5 and 1000 then raise exception 'INVALID_CONTENT';end if;
 select id into target from public.profiles where username=p_username;
 if target is null then raise exception 'PROFILE_NOT_FOUND';end if;
 perform pg_advisory_xact_lock(hashtextextended('author-verification:'||p_key::text,0));
 select * into prior from app_private.moderation_audit where idempotency_key=p_key;
 if found then
   if prior.admin_id<>actor or prior.target_id<>target::text or prior.payload<>jsonb_build_object('verified',p_verified,'author',p_author) or prior.reason<>p_reason then raise exception 'IDEMPOTENCY_CONFLICT';end if;
   return;
 end if;
 if p_author<>'' and (not p_verified or not exists(select 1 from public.catalog_authors where name=p_author)) then raise exception 'INVALID_AUTHOR';end if;
 if p_author<>'' and exists(select 1 from public.catalog_authors where name=p_author and user_id is not null and user_id<>target) then raise exception 'AUTHOR_ALREADY_LINKED';end if;
 update public.profiles set author_verified=p_verified where id=target;
 if p_author<>'' then
   update public.catalog_authors set user_id=target where name=p_author;
   update public.articles set author_id=target where source='catalog' and author=p_author;
 end if;
 insert into app_private.moderation_audit(admin_id,target_kind,target_id,action,reason,idempotency_key,payload)
 values(actor,'profile',target::text,'author_verification',p_reason,p_key,jsonb_build_object('verified',p_verified,'author',p_author));
end $$;
revoke all on function public.set_author_verification(text,boolean,text,uuid,text) from public,anon;
grant execute on function public.set_author_verification(text,boolean,text,uuid,text) to authenticated;
notify pgrst, 'reload schema';

create or replace view public.discussion_items with(security_invoker=true) as
select d.*,
  case when d.kind='post' and d.status='visible' then p.title else null end as title,
  case when d.kind='post' and d.status='visible' then p.topic else null end as topic,
  coalesce(g.level,1) as level,
  (coalesce(case when d.status='visible' then p.title end,'') || ' ' || d.content) as search_text,
  (select author_verified from public.profiles where id=d.user_id) author_verified
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




create or replace view public.submission_public with(security_invoker=true) as
select s.*,p.display_name,p.username,coalesce(a.like_count,0) like_count,coalesce(a.comment_count,0) comment_count,
coalesce(a.bookmark_count,0) bookmark_count,coalesce(a.view_count,0) view_count,p.author_verified,(select level from public.user_progress where user_id=s.user_id) level
from public.submissions s join public.profiles p on p.id=s.user_id left join public.article_stats a on a.article_id=s.id::text where s.status='published';

create or replace function public.submission_feed(p_query text default '',p_genre text default '',p_tag text default '',p_sort text default 'latest',p_page integer default 0,p_user uuid default null,p_short boolean default false)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if p_query is null or char_length(p_query)>100 or p_genre is null or p_tag is null or p_sort is null or p_sort not in('latest','popular','following','random','bookmarks','history') or p_page is null or p_page not between 0 and 10000 or p_short is null then raise exception 'INVALID_FILTER';end if;
 if p_sort in('following','bookmarks','history') and auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;
 return (select coalesce(jsonb_agg(to_jsonb(x)),'[]') from(
 select s.id,s.user_id,s.title,s.genre,s.tags,s.summary,s.word_count,s.published_at,s.updated_at,p.display_name,p.username,p.author_verified,(select level from public.user_progress where user_id=s.user_id) level,
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


notify pgrst, 'reload schema';
