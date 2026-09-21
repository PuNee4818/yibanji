alter table public.comments add column reply_to_id uuid references public.comments(id) on delete set null;
alter table public.community_post_comments add column reply_to_id uuid references public.community_post_comments(id) on delete set null;
create index comments_reply_to_idx on public.comments(reply_to_id);
create index post_comments_reply_to_idx on public.community_post_comments(reply_to_id);
create function app_private.discussion_visible(k text,item uuid) returns boolean language sql stable security definer set search_path='' as $$
select case k when 'article' then exists(select 1 from public.comments c join public.articles a on a.id=c.article_id where c.id=item and c.status='visible' and a.active)
when 'post' then exists(select 1 from public.community_posts p where p.id=item and p.status='visible' and (p.article_id is null or exists(select 1 from public.articles a where a.id=p.article_id and a.active)))
when 'post_comment' then exists(select 1 from public.community_post_comments c join public.community_posts p on p.id=c.post_id where c.id=item and c.status='visible' and p.status='visible' and (p.article_id is null or exists(select 1 from public.articles a where a.id=p.article_id and a.active))) else false end $$;
-- Private helpers are never an alternate client write path.
revoke all on function app_private.discussion_visible(text,uuid) from public,anon,authenticated;

create or replace function public.save_discussion(p_kind text,p_target text,p_content text,p_parent uuid default null,p_id uuid default null,p_key uuid default gen_random_uuid()) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=app_private.require_actor();tbl text;result uuid;previous public.discussion_items;body text:=trim(p_content);letters text;root_parent uuid:=p_parent;
begin
 if p_kind not in('article','post','post_comment') or p_kind is null then raise exception 'INVALID_KIND';end if;
 if body is null or char_length(body)<1 or char_length(body)>(case when p_kind='post' then 500 else 2000 end) then raise exception 'INVALID_CONTENT' using errcode='22023';end if;
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
create or replace function public.set_discussion_like(p_kind text,p_id uuid,p_active boolean) returns boolean language plpgsql security definer set search_path='' as $$
declare u uuid:=app_private.require_actor();tbl text;
begin
 if p_active is null then raise exception 'INVALID_STATE';end if;
 perform app_private.rate_limit(u,'discussion_like',60);
 if not app_private.discussion_visible(p_kind,p_id) then raise exception 'CONTENT_NOT_FOUND';end if;
 tbl:=case p_kind when 'article' then 'comment_likes' when 'post' then 'community_post_likes' when 'post_comment' then 'community_post_comment_likes' end;
 if tbl is null then raise exception 'INVALID_KIND';end if;
 if p_active then execute format('insert into public.%I(user_id,target_id) values($1,$2) on conflict do nothing',tbl) using u,p_id;
 else execute format('delete from public.%I where user_id=$1 and target_id=$2',tbl) using u,p_id;end if;return p_active;
end $$;
create or replace function public.community_feed(p_tab text default 'latest',p_page integer default 0) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if p_tab='following' and auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;
 return(select coalesce(jsonb_agg(to_jsonb(d)),'[]') from(select * from public.discussion_items where kind in('post','article') and parent_id is null and app_private.discussion_visible(kind,id)
 and (p_tab<>'following' or exists(select 1 from public.user_follows f where f.follower_id=auth.uid() and f.following_id=user_id))
 and (p_tab<>'hot' or created_at>now()-interval '7 days')
 order by case when p_tab='hot' then (like_count*2+reply_count*3+1)/power(greatest(extract(epoch from(now()-created_at))/3600,0)+2,0.7) end desc,created_at desc,id desc limit 20 offset greatest(0,least(p_page,100))*20)d);
end $$;
create or replace function app_private.notify_discussion() returns trigger language plpgsql security definer set search_path='' as $$
declare recipient uuid;k text;target text;link text;begin
 if TG_TABLE_NAME='comments' then
  if new.parent_id is null then return null;end if;
  select user_id into recipient from public.comments where id=coalesce(new.reply_to_id,new.parent_id);k:='reply';target:='comment:'||coalesce(new.reply_to_id,new.parent_id);
  link:='/articles/'||new.article_id||'/#comment-'||new.id;
 else
  if new.parent_id is null then select user_id into recipient from public.community_posts where id=new.post_id;
  else select user_id into recipient from public.community_post_comments where id=coalesce(new.reply_to_id,new.parent_id);end if;
  k:='reply';target:='post:'||coalesce(new.reply_to_id,new.parent_id,new.post_id);link:='/community/posts/'||new.post_id||'/#comment-'||new.id;
 end if;
 perform app_private.notify(recipient,new.user_id,k,target,'在讨论中回复了你',link,new.user_id::text);return null;
end $$;
create or replace function public.begin_read(p_article text) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=app_private.require_actor();token uuid;
begin perform app_private.assert_article(p_article);perform app_private.rate_limit(u,'begin_read',20);
 delete from app_private.reading_sessions where user_id=u;
 insert into public.reading_progress(user_id,article_id) values(u,p_article) on conflict(user_id,article_id) do update set updated_at=now();
 insert into app_private.reading_sessions(user_id,article_id) values(u,p_article) returning id into token;return token;end $$;

revoke all on all functions in schema app_private from public,anon,authenticated;
