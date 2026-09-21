create table public.comments(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,article_id text not null references public.articles(id),parent_id uuid references public.comments(id) on delete cascade,content text not null check(char_length(content) between 1 and 2000),status text not null default 'visible' check(status in('visible','deleted','hidden','spam')),idempotency_key uuid not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),deleted_at timestamptz,unique(user_id,idempotency_key));
create table public.community_posts(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,article_id text references public.articles(id),content text not null check(char_length(content) between 1 and 500),status text not null default 'visible' check(status in('visible','deleted','hidden','spam')),idempotency_key uuid not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),deleted_at timestamptz,unique(user_id,idempotency_key));
create table public.community_post_comments(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,post_id uuid not null references public.community_posts(id) on delete cascade,parent_id uuid references public.community_post_comments(id) on delete cascade,content text not null check(char_length(content) between 1 and 2000),status text not null default 'visible' check(status in('visible','deleted','hidden','spam')),idempotency_key uuid not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),deleted_at timestamptz,unique(user_id,idempotency_key));
create table public.comment_likes(user_id uuid references public.profiles(id) on delete cascade,target_id uuid references public.comments(id) on delete cascade,created_at timestamptz not null default now(),primary key(user_id,target_id));
create table public.community_post_likes(user_id uuid references public.profiles(id) on delete cascade,target_id uuid references public.community_posts(id) on delete cascade,created_at timestamptz not null default now(),primary key(user_id,target_id));
create table public.community_post_comment_likes(user_id uuid references public.profiles(id) on delete cascade,target_id uuid references public.community_post_comments(id) on delete cascade,created_at timestamptz not null default now(),primary key(user_id,target_id));
create index comments_article_time_idx on public.comments(article_id,created_at desc);
create index comments_parent_idx on public.comments(parent_id);create index comments_user_idx on public.comments(user_id,created_at desc);
create index posts_user_time_idx on public.community_posts(user_id,created_at desc);create index posts_time_idx on public.community_posts(created_at desc);
create index post_comments_thread_idx on public.community_post_comments(post_id,created_at);create index post_comments_parent_idx on public.community_post_comments(parent_id);
create index comment_likes_target_idx on public.comment_likes(target_id);create index post_likes_target_idx on public.community_post_likes(target_id);create index post_comment_likes_target_idx on public.community_post_comment_likes(target_id);
do $$ declare t text;begin foreach t in array array['comments','community_posts','community_post_comments','comment_likes','community_post_likes','community_post_comment_likes'] loop
execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from anon,authenticated',t);execute format('grant select on public.%I to anon,authenticated',t);
if t in('comments','community_posts','community_post_comments') then execute format('create policy read_visible on public.%I for select using(status in(''visible'',''deleted''))',t);else execute format('create policy read_public on public.%I for select using(true)',t);end if;end loop;end $$;
create view public.discussion_items with(security_invoker=true) as
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
from public.community_post_comments c join public.profiles p on p.id=c.user_id;
grant select on public.discussion_items to anon,authenticated;
create function app_private.comment_count() returns trigger language plpgsql security definer set search_path='' as $$
declare d integer:=0;a text;
begin
 if TG_OP in('DELETE','UPDATE') then a:=old.article_id;if old.status='visible' then d:=d-1;end if;end if;
 if TG_OP in('INSERT','UPDATE') then a:=new.article_id;if new.status='visible' then d:=d+1;end if;end if;
 update public.article_stats set comment_count=comment_count+d,updated_at=now() where article_id=a;
 if TG_OP='INSERT' then insert into public.article_activity(article_id,day,comments) values(a,app_private.today(),1) on conflict(article_id,day) do update set comments=article_activity.comments+1;end if;
 return null;
end $$;
create trigger comments_count after insert or update of status or delete on public.comments for each row execute function app_private.comment_count();
create function public.save_discussion(p_kind text,p_target text,p_content text,p_parent uuid default null,p_id uuid default null,p_key uuid default gen_random_uuid()) returns uuid language plpgsql security definer set search_path='' as $$
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
 execute format('update public.%I set content=$1,updated_at=now() where id=$2 and user_id=$3 and status=''visible'' returning id',tbl) into result using body,p_id,u;
 if result is null then raise exception 'NOT_OWNER' using errcode='42501';end if;return result;
 end if;
 if p_key is null then raise exception 'IDEMPOTENCY_REQUIRED';end if;
 if exists(select 1 from public.discussion_items where user_id=u and lower(regexp_replace(content,'\s','','g'))=lower(regexp_replace(body,'\s','','g')) and created_at>now()-interval '1 day') then raise exception 'DUPLICATE_CONTENT';end if;
 if (select count(*) from public.discussion_items where user_id=u and created_at>now()-interval '1 day')>=100 then raise exception 'RATE_LIMITED';end if;
 if p_kind='article' or (p_kind='post' and p_target is not null) then perform app_private.assert_article(p_target);end if;
 if p_kind='post_comment' and not exists(select 1 from public.community_posts where id=p_target::uuid and status='visible') then raise exception 'POST_NOT_FOUND';end if;
 if p_parent is not null then
 select * into previous from public.discussion_items where id=p_parent and kind=p_kind and target=p_target and status='visible';
 if not found or p_kind='post' then raise exception 'INVALID_PARENT';end if;
 root_parent:=coalesce(previous.parent_id,previous.id);
 end if;
 if p_kind='article' then insert into public.comments(user_id,article_id,parent_id,content,idempotency_key) values(u,p_target,root_parent,body,p_key) returning id into result;
 elsif p_kind='post' then insert into public.community_posts(user_id,article_id,content,idempotency_key) values(u,p_target,body,p_key) returning id into result;
 else insert into public.community_post_comments(user_id,post_id,parent_id,content,idempotency_key) values(u,p_target::uuid,root_parent,body,p_key) returning id into result;end if;
 letters:=regexp_replace(body,'[^[:alnum:]]','','g');
 if p_kind<>'post' and char_length(letters)>=8 and letters !~ '^(.)\1*$' then perform app_private.record_event(u,'discussion',result::text);end if;
 return result;
end $$;
create function public.delete_discussion(p_kind text,p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=app_private.require_actor();tbl text;n integer;
begin
 tbl:=case p_kind when 'article' then 'comments' when 'post' then 'community_posts' when 'post_comment' then 'community_post_comments' end;
 if tbl is null then raise exception 'INVALID_KIND';end if;
 execute format('update public.%I set status=''deleted'',content=''这条内容已删除。'',deleted_at=now(),updated_at=now() where id=$1 and user_id=$2 and status in(''visible'',''deleted'')',tbl) using p_id,u;get diagnostics n=row_count;
 if n=0 then raise exception 'NOT_OWNER' using errcode='42501';end if;
end $$;
create function public.set_discussion_like(p_kind text,p_id uuid,p_active boolean) returns boolean language plpgsql security definer set search_path='' as $$
declare u uuid:=app_private.require_actor();tbl text;
begin
 perform app_private.rate_limit(u,'discussion_like',60);
 if not exists(select 1 from public.discussion_items where id=p_id and kind=p_kind and status='visible') then raise exception 'CONTENT_NOT_FOUND';end if;
 tbl:=case p_kind when 'article' then 'comment_likes' when 'post' then 'community_post_likes' when 'post_comment' then 'community_post_comment_likes' end;
 if tbl is null then raise exception 'INVALID_KIND';end if;
 if p_active then execute format('insert into public.%I(user_id,target_id) values($1,$2) on conflict do nothing',tbl) using u,p_id;
 else execute format('delete from public.%I where user_id=$1 and target_id=$2',tbl) using u,p_id;end if;return p_active;
end $$;
create function public.discussion_thread(p_kind text,p_target text,p_sort text default 'newest',p_page integer default 0) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(d)),'[]') from(select * from public.discussion_items where kind=p_kind and target=p_target and status in('visible','deleted')
 and ((p_kind='article' and exists(select 1 from public.articles where id=p_target and active)) or (p_kind='post_comment' and exists(select 1 from public.community_posts where id::text=p_target and status='visible')))
 order by case when p_sort='hot' then (like_count*2+reply_count+1)/power(greatest(extract(epoch from(now()-created_at))/3600,0)+2,0.7) end desc,
 case when p_sort='oldest' then created_at end asc,created_at desc,id desc limit 100 offset greatest(0,least(p_page,100))*100)d $$;
create function public.community_feed(p_tab text default 'latest',p_page integer default 0) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if p_tab='following' and auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;
 return(select coalesce(jsonb_agg(to_jsonb(d)),'[]') from(select * from public.discussion_items where kind in('post','article') and parent_id is null and status='visible'
 and (p_tab<>'following' or exists(select 1 from public.user_follows f where f.follower_id=auth.uid() and f.following_id=user_id))
 and (p_tab<>'hot' or created_at>now()-interval '7 days')
 order by case when p_tab='hot' then (like_count*2+reply_count*3+1)/power(greatest(extract(epoch from(now()-created_at))/3600,0)+2,0.7) end desc,created_at desc,id desc limit 20 offset greatest(0,least(p_page,100))*20)d);
end $$;
create function public.community_highlights() returns jsonb language sql stable security definer set search_path='' as $$
select jsonb_build_object('hot',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from(select a.id,a.title,a.author,sum(v.views+v.likes*2+v.comments*3+v.bookmarks) score,sum(v.comments) discussions,sum(v.eggs) eggs from public.articles a join public.article_activity v on v.article_id=a.id where a.active and v.day>=app_private.today()-6 group by a.id order by score desc,a.id limit 5)x),
'eggs',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from(select a.id,a.title,sum(v.eggs) eggs from public.articles a join public.article_activity v on v.article_id=a.id where a.active and v.day>=app_private.today()-6 group by a.id having sum(v.eggs)>0 order by eggs desc,a.id limit 3)x)) $$;
create function public.visit_community(p_post uuid) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=app_private.require_actor();begin
 perform app_private.rate_limit(u,'visit_community',20);
 if not exists(select 1 from public.community_posts where id=p_post and status='visible') then raise exception 'POST_NOT_FOUND';end if;
 perform app_private.record_event(u,'community',p_post::text);end $$;
revoke all on all functions in schema app_private from public,anon,authenticated;
revoke all on function public.save_discussion(text,text,text,uuid,uuid,uuid),public.delete_discussion(text,uuid),public.set_discussion_like(text,uuid,boolean),public.discussion_thread(text,text,text,integer),public.community_feed(text,integer),public.community_highlights(),public.visit_community(uuid) from public,anon;
grant execute on function public.save_discussion(text,text,text,uuid,uuid,uuid),public.delete_discussion(text,uuid),public.set_discussion_like(text,uuid,boolean),public.visit_community(uuid) to authenticated;
grant execute on function public.discussion_thread(text,text,text,integer),public.community_feed(text,integer),public.community_highlights() to anon,authenticated;
