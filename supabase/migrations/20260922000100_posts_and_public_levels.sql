-- Additive migration: old posts and old clients remain valid.
alter table public.community_posts add column title text not null default '' check(char_length(title)<=80);
alter table public.community_posts add column topic text not null default '闲谈' check(topic in('读书','随笔','提问','闲谈'));
alter table public.community_posts drop constraint community_posts_content_check;
alter table public.community_posts add constraint community_posts_content_check check(char_length(content) between 1 and 10000);
update public.community_posts set title=left(regexp_replace(content,'\s+',' ','g'),36) where status='visible';
create index posts_topic_time_idx on public.community_posts(topic,created_at desc) where status='visible';

-- Apply the same article visibility rule to direct reads, search and the post page.
alter policy read_visible on public.community_posts using(
  status in('visible','deleted') and
  (article_id is null or exists(select 1 from public.articles a where a.id=article_id and a.active))
);
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
from public.comments c join public.profiles p on p.id=c.user_id
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

create or replace function public.save_discussion(p_kind text,p_target text,p_content text,p_parent uuid default null,p_id uuid default null,p_key uuid default gen_random_uuid()) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=app_private.require_actor();tbl text;result uuid;previous public.discussion_items;body text:=trim(p_content);letters text;root_parent uuid:=p_parent;
begin
 if p_kind not in('article','post','post_comment') or p_kind is null then raise exception 'INVALID_KIND';end if;
 if body is null or char_length(body)<1 or char_length(body)>(case when p_kind='post' then 10000 else 2000 end) then raise exception 'INVALID_CONTENT' using errcode='22023';end if;
 tbl:=case p_kind when 'article' then 'comments' when 'post' then 'community_posts' else 'community_post_comments' end;
 if p_id is null then
 execute format('select id from public.%I where user_id=$1 and idempotency_key=$2',tbl) into result using u,p_key;
 if result is not null then
 select * into previous from public.discussion_items where id=result and kind=p_kind;
 if previous.content<>body or previous.target is distinct from p_target or previous.parent_id is distinct from coalesce((select coalesce(parent_id,id) from public.discussion_items where id=p_parent and kind=p_kind),p_parent) then raise exception 'IDEMPOTENCY_CONFLICT';end if;return result;end if;
 end if;
 perform app_private.rate_limit(u,'discussion_write',10);
 if p_id is not null then
 if not app_private.discussion_visible(p_kind,p_id) then raise exception 'CONTENT_NOT_FOUND';end if;
 execute format('update public.%I set content=$1,updated_at=now() where id=$2 and user_id=$3 and status=''visible'' returning id',tbl) into result using body,p_id,u;
 if result is null then raise exception 'NOT_OWNER' using errcode='42501';end if;return result;
 end if;
 if p_key is null then raise exception 'IDEMPOTENCY_REQUIRED';end if;
 if exists(select 1 from public.discussion_items where user_id=u and lower(regexp_replace(content,'\s','','g'))=lower(regexp_replace(body,'\s','','g')) and created_at>now()-interval '1 day') then raise exception 'DUPLICATE_CONTENT';end if;
 if (select count(*) from public.discussion_items where user_id=u and created_at>now()-interval '1 day')>=100 then raise exception 'RATE_LIMITED';end if;
 if p_kind='article' or (p_kind='post' and p_target is not null) then perform app_private.assert_article(p_target);end if;
 if p_kind='post_comment' and not exists(select 1 from public.community_posts where id=p_target::uuid and status='visible') then raise exception 'POST_NOT_FOUND';end if;
 if p_parent is not null then
 select * into previous from public.discussion_items where id=p_parent and kind=p_kind and target=p_target and app_private.discussion_visible(p_kind,p_parent);
 if not found or p_kind='post' then raise exception 'INVALID_PARENT';end if;
 root_parent:=coalesce(previous.parent_id,previous.id);
 end if;
 if p_kind='article' then insert into public.comments(user_id,article_id,parent_id,reply_to_id,content,idempotency_key) values(u,p_target,root_parent,p_parent,body,p_key) returning id into result;
 elsif p_kind='post' then insert into public.community_posts(user_id,article_id,content,idempotency_key) values(u,p_target,body,p_key) returning id into result;
 else insert into public.community_post_comments(user_id,post_id,parent_id,reply_to_id,content,idempotency_key) values(u,p_target::uuid,root_parent,p_parent,body,p_key) returning id into result;end if;
 letters:=regexp_replace(body,'[^[:alnum:]]','','g');
 if p_kind<>'post' and char_length(letters)>=8 and letters !~ '^(.)\1*$' then perform app_private.record_event(u,'discussion',result::text);end if;
 return result;
end $$;

create function public.save_post(p_title text,p_content text,p_topic text default '闲谈',p_article text default null,p_id uuid default null,p_key uuid default gen_random_uuid())
returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=app_private.require_actor(); result uuid; old public.community_posts; heading text:=trim(p_title);
begin
 if p_content is null or char_length(trim(p_content)) not between 1 and 10000 then raise exception 'INVALID_CONTENT' using errcode='22023';end if;
 if heading is null or char_length(heading) not between 1 and 80 or p_topic is null or p_topic not in('读书','随笔','提问','闲谈') then raise exception 'INVALID_POST' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('post:'||u::text,0));
 if p_id is null then
   select * into old from public.community_posts where user_id=u and idempotency_key=p_key;
   if found then
     if old.title<>heading or old.topic<>p_topic or old.content<>trim(p_content) or old.article_id is distinct from p_article then raise exception 'IDEMPOTENCY_CONFLICT';end if;
     return old.id;
   end if;
 else
   if not exists(select 1 from public.community_posts where id=p_id and user_id=u and status='visible') then raise exception 'NOT_OWNER' using errcode='42501';end if;
 end if;
 if p_article is not null then perform app_private.assert_article(p_article);end if;
 result:=public.save_discussion('post',p_article,p_content,null,p_id,p_key);
 update public.community_posts set title=heading,topic=p_topic,article_id=p_article,updated_at=now() where id=result and user_id=u;
 return result;
end $$;
revoke all on function public.save_post(text,text,text,text,uuid,uuid) from public,anon;
grant execute on function public.save_post(text,text,text,text,uuid,uuid) to authenticated;

create function public.community_topics(p_stream text default 'posts',p_tab text default 'latest',p_topic text default null,p_page integer default 0,p_user uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if p_stream is null or p_tab is null or p_page is null or p_stream not in('posts','comments') or p_tab not in('latest','hot','following') or p_page<0 or p_page>100 then raise exception 'INVALID_FILTER' using errcode='22023';end if;
 if p_tab='following' and auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;
 return (select coalesce(jsonb_agg(to_jsonb(d)),'[]') from(
   select * from public.discussion_items
   where (case when p_stream='posts' then kind='post' when p_user is null then kind='article' and parent_id is null else kind in('article','post_comment') end)
   and app_private.discussion_visible(kind,id)
   and (p_user is null or user_id=p_user)
   and (p_stream<>'posts' or p_topic is null or topic=p_topic)
   and (p_tab<>'following' or exists(select 1 from public.user_follows f where f.follower_id=auth.uid() and f.following_id=user_id))
   and (p_tab<>'hot' or created_at>now()-interval '7 days')
   order by case when p_tab='hot' then (like_count*2+reply_count*3+1)/power(greatest(extract(epoch from(now()-created_at))/3600,0)+2,0.7) end desc,created_at desc,id desc
   limit 20 offset p_page*20
 ) d);
end $$;
revoke all on function public.community_topics(text,text,text,integer,uuid) from public;
grant execute on function public.community_topics(text,text,text,integer,uuid) to anon,authenticated;
