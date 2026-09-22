-- Independent literary submissions. Private drafts never participate in public reads.
create table public.submission_drafts (
 id uuid primary key, user_id uuid not null references public.profiles(id) on delete cascade,
 title text not null default '' check(char_length(title)<=100),
 genre text not null default 'essay' check(genre in('essay','reflection','poetry','classical','ci','story','flash','novel','letter','diary','travel','memoir','review','commentary','script','other')),
 tags text[] not null default '{}', summary text not null default '' check(char_length(summary)<=240),
 body text not null default '' check(char_length(body)<=100000), indent boolean not null default true,
 revision integer not null default 1, last_key uuid not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index submission_drafts_owner_idx on public.submission_drafts(user_id,updated_at desc);
create table public.submissions (
 id uuid primary key references public.submission_drafts(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 title text not null, genre text not null, tags text[] not null, summary text not null,
 body text not null, indent boolean not null, word_count integer not null,
 status text not null default 'published' check(status in('published','withdrawn')),
 published_revision integer not null, published_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index submissions_feed_idx on public.submissions(published_at desc,id) where status='published';
create index submissions_author_idx on public.submissions(user_id,published_at desc);
create index submissions_genre_idx on public.submissions(genre,published_at desc) where status='published';
create index submissions_tags_idx on public.submissions using gin(tags) where status='published';
create table public.submission_likes (
 submission_id uuid references public.submissions(id) on delete cascade,
 user_id uuid references public.profiles(id) on delete cascade, created_at timestamptz not null default now(),
 primary key(submission_id,user_id)
);
create table public.submission_bookmarks (
 submission_id uuid references public.submissions(id) on delete cascade,
 user_id uuid references public.profiles(id) on delete cascade, created_at timestamptz not null default now(),
 primary key(submission_id,user_id)
);
create table public.submission_progress (
 submission_id uuid references public.submissions(id) on delete cascade,
 user_id uuid references public.profiles(id) on delete cascade, position numeric not null check(position between 0 and 1),
 updated_at timestamptz not null default now(), primary key(submission_id,user_id)
);
create table public.submission_comments (
 id uuid primary key, submission_id uuid not null references public.submissions(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 content text not null check(char_length(content) between 1 and 2000), created_at timestamptz not null default now()
);
create index submission_comments_feed_idx on public.submission_comments(submission_id,created_at,id);
alter table public.submission_drafts enable row level security;
alter table public.submissions enable row level security;
alter table public.submission_likes enable row level security;
alter table public.submission_bookmarks enable row level security;
alter table public.submission_progress enable row level security;
alter table public.submission_comments enable row level security;
revoke all on public.submission_drafts,public.submissions,public.submission_likes,public.submission_bookmarks,public.submission_progress,public.submission_comments from anon,authenticated;
grant select on public.submissions,public.submission_likes,public.submission_comments to anon,authenticated;
grant select on public.submission_drafts,public.submission_bookmarks,public.submission_progress to authenticated;
create policy draft_owner on public.submission_drafts for select to authenticated using(user_id=auth.uid());
create policy submission_read on public.submissions for select using(status='published' or user_id=auth.uid());
create policy submission_likes_read on public.submission_likes for select using(exists(select 1 from public.submissions s where s.id=submission_id and s.status='published'));
create policy submission_bookmarks_owner on public.submission_bookmarks for select to authenticated using(user_id=auth.uid());
create policy submission_progress_owner on public.submission_progress for select to authenticated using(user_id=auth.uid());
create policy submission_comments_read on public.submission_comments for select using(exists(select 1 from public.submissions s where s.id=submission_id and s.status='published'));
create view public.submission_public with(security_invoker=true) as
select s.*,p.display_name,p.username,
 (select count(*) from public.submission_likes l where l.submission_id=s.id) like_count,
 (select count(*) from public.submission_comments c where c.submission_id=s.id) comment_count
from public.submissions s join public.profiles p on p.id=s.user_id where s.status='published';
grant select on public.submission_public to anon,authenticated;
create view public.submission_comment_items with(security_invoker=true) as
select c.*,p.display_name,p.username from public.submission_comments c join public.profiles p on p.id=c.user_id;
grant select on public.submission_comment_items to anon,authenticated;

create function public.save_submission_draft(p_id uuid,p_revision integer,p_key uuid,p_title text,p_body text,p_genre text,p_tags text[],p_summary text,p_indent boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=app_private.require_actor(); d public.submission_drafts; result public.submission_drafts;
begin
 if p_id is null or p_key is null or p_revision is null or p_revision<0 or p_title is null or p_body is null or p_genre is null or p_tags is null or p_summary is null or p_indent is null then raise exception 'INVALID_DRAFT';end if;
 if cardinality(p_tags)>5 or exists(select 1 from unnest(p_tags) t where t is null or char_length(trim(t)) not between 1 and 16) then raise exception 'INVALID_TAGS';end if;
 perform pg_advisory_xact_lock(hashtextextended('submission:'||p_id::text,0));
 select * into d from public.submission_drafts where id=p_id for update;
 if found then
   if d.user_id<>u then raise exception 'NOT_OWNER';end if;
   if d.last_key=p_key then
     if (d.title,d.body,d.genre,d.tags,d.summary,d.indent) is distinct from (p_title,p_body,p_genre,p_tags,p_summary,p_indent) then raise exception 'IDEMPOTENCY_CONFLICT';end if;
     return to_jsonb(d);
   end if;
   if d.revision<>p_revision then raise exception 'DRAFT_CONFLICT';end if;
 else
   if p_revision<>0 then raise exception 'DRAFT_CONFLICT';end if;
   if (select count(*) from public.submission_drafts where user_id=u)>=500 then raise exception 'DRAFT_LIMIT';end if;
 end if;
 perform app_private.rate_limit(u,'submission_save',60);
 insert into public.submission_drafts(id,user_id,title,body,genre,tags,summary,indent,revision,last_key)
 values(p_id,u,p_title,p_body,p_genre,p_tags,p_summary,p_indent,1,p_key)
 on conflict(id) do update set title=p_title,body=p_body,genre=p_genre,tags=p_tags,summary=p_summary,indent=p_indent,revision=submission_drafts.revision+1,last_key=p_key,updated_at=now()
 returning * into result;
 return to_jsonb(result);
end $$;

create function public.publish_submission(p_id uuid,p_revision integer) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=app_private.require_actor(); d public.submission_drafts;
begin
 perform pg_advisory_xact_lock(hashtextextended('submission:'||p_id::text,0));
 select * into d from public.submission_drafts where id=p_id and user_id=u for update;
 if not found then raise exception 'NOT_OWNER';end if;
 if p_revision is null or d.revision<>p_revision then raise exception 'DRAFT_CONFLICT';end if;
 if char_length(trim(d.title))<1 or char_length(regexp_replace(d.body,'[[:space:]#*>_-]','','g'))<1 then raise exception 'EMPTY_SUBMISSION';end if;
 if exists(select 1 from public.submissions where id=p_id and status='published' and published_revision=p_revision) then return p_id;end if;
 perform app_private.rate_limit(u,'submission_publish',10);
 insert into public.submissions(id,user_id,title,genre,tags,summary,body,indent,word_count,published_revision)
 values(d.id,u,trim(d.title),d.genre,d.tags,case when trim(d.summary)='' then left(regexp_replace(d.body,'[#*>]','','g'),140) else trim(d.summary) end,d.body,d.indent,char_length(regexp_replace(d.body,'[[:space:]#*>_]','','g')),d.revision)
 on conflict(id) do update set title=excluded.title,genre=excluded.genre,tags=excluded.tags,summary=excluded.summary,body=excluded.body,indent=excluded.indent,word_count=excluded.word_count,published_revision=excluded.published_revision,status='published',updated_at=now();
 return p_id;
end $$;

create function public.manage_submission(p_id uuid,p_action text) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=app_private.require_actor();
begin
 perform pg_advisory_xact_lock(hashtextextended('submission:'||p_id::text,0));
 if not exists(select 1 from public.submission_drafts where id=p_id and user_id=u) then raise exception 'NOT_OWNER';end if;
 if p_action='withdraw' then update public.submissions set status='withdrawn',updated_at=now() where id=p_id and user_id=u;
 elsif p_action='delete' then delete from public.submission_drafts where id=p_id and user_id=u;
 else raise exception 'INVALID_ACTION';end if;
end $$;

create function public.my_writing() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;
 return (select coalesce(jsonb_agg(to_jsonb(x)),'[]') from(
 select d.id,d.title,d.genre,d.tags,d.summary,d.revision,d.updated_at,left(d.body,140) excerpt,
 coalesce(s.status,'draft') status,s.published_revision
 from public.submission_drafts d left join public.submissions s on s.id=d.id where d.user_id=auth.uid() order by d.updated_at desc,d.id
 ) x);
end $$;

create function public.submission_feed(p_query text default '',p_genre text default '',p_tag text default '',p_sort text default 'latest',p_page integer default 0,p_user uuid default null,p_short boolean default false)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if p_query is null or char_length(p_query)>100 or p_genre is null or p_tag is null or p_sort is null or p_sort not in('latest','popular','following','random','bookmarks','history') or p_page is null or p_page not between 0 and 10000 or p_short is null then raise exception 'INVALID_FILTER';end if;
 if p_sort in('following','bookmarks','history') and auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;
 return (select coalesce(jsonb_agg(to_jsonb(x)),'[]') from(
 select s.id,s.user_id,s.title,s.genre,s.tags,s.summary,s.word_count,s.published_at,s.updated_at,p.display_name,p.username,
 (select count(*) from public.submission_likes l where l.submission_id=s.id) like_count,
 (select count(*) from public.submission_comments c where c.submission_id=s.id) comment_count
 from public.submissions s join public.profiles p on p.id=s.user_id
 where s.status='published' and (p_user is null or s.user_id=p_user)
 and (p_genre='' or s.genre=p_genre or (p_genre='poetry' and s.genre in('classical','ci')))
 and (p_tag='' or p_tag=any(s.tags)) and (not p_short or s.word_count<=1000)
 and not exists(select 1 from regexp_split_to_table(trim(p_query),'\s+') term where term<>'' and strpos(lower(s.title||' '||s.body||' '||p.display_name||' '||p.username||' '||array_to_string(s.tags,' ')),lower(term))=0)
 and (p_sort<>'following' or exists(select 1 from public.user_follows f where f.follower_id=auth.uid() and f.following_id=s.user_id))
 and (p_sort<>'bookmarks' or exists(select 1 from public.submission_bookmarks b where b.submission_id=s.id and b.user_id=auth.uid()))
 and (p_sort<>'history' or exists(select 1 from public.submission_progress h where h.submission_id=s.id and h.user_id=auth.uid()))
 order by case when p_sort='popular' then ((select count(*) from public.submission_likes l where l.submission_id=s.id)*2+(select count(*) from public.submission_comments c where c.submission_id=s.id)+1)/power(extract(epoch from(now()-s.published_at))/86400+2,0.7) end desc,
 case when p_sort='random' then md5(s.id::text||now()::text) end,
 case when p_sort='history' then (select h.updated_at from public.submission_progress h where h.submission_id=s.id and h.user_id=auth.uid()) end desc,
 case when p_sort='bookmarks' then (select b.created_at from public.submission_bookmarks b where b.submission_id=s.id and b.user_id=auth.uid()) end desc,
 s.published_at desc,s.id desc limit 20 offset p_page*20
 ) x);
end $$;

create function public.set_submission_mark(p_id uuid,p_kind text,p_value boolean) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=app_private.require_actor();
begin
 if p_value is null or p_kind is null or p_kind not in('like','bookmark') then raise exception 'INVALID_ACTION';end if;
 if p_value and not exists(select 1 from public.submissions where id=p_id and status='published') then raise exception 'CONTENT_NOT_FOUND';end if;
 perform app_private.rate_limit(u,'submission_mark',60);
 if p_kind='like' then
   if p_value then insert into public.submission_likes(submission_id,user_id) values(p_id,u) on conflict do nothing;
   else delete from public.submission_likes where submission_id=p_id and user_id=u;end if;
 else
   if p_value then insert into public.submission_bookmarks(submission_id,user_id) values(p_id,u) on conflict do nothing;
   else delete from public.submission_bookmarks where submission_id=p_id and user_id=u;end if;
 end if;
end $$;

create function public.save_submission_progress(p_id uuid,p_position numeric) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=app_private.require_actor();
begin
 if p_position is null or p_position not between 0 and 1 then raise exception 'INVALID_POSITION';end if;
 if not exists(select 1 from public.submissions where id=p_id and status='published') then raise exception 'CONTENT_NOT_FOUND';end if;
 perform app_private.rate_limit(u,'submission_progress',30);
 insert into public.submission_progress(submission_id,user_id,position) values(p_id,u,p_position)
 on conflict(submission_id,user_id) do update set position=p_position,updated_at=now();
end $$;

create function public.save_submission_comment(p_id uuid,p_submission uuid,p_content text) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=app_private.require_actor(); c public.submission_comments;
begin
 if p_id is null or p_content is null or char_length(trim(p_content)) not between 1 and 2000 then raise exception 'INVALID_CONTENT';end if;
 if not exists(select 1 from public.submissions where id=p_submission and status='published') then raise exception 'CONTENT_NOT_FOUND';end if;
 select * into c from public.submission_comments where id=p_id;
 if found then
   if c.user_id<>u or c.submission_id<>p_submission or c.content<>trim(p_content) then raise exception 'IDEMPOTENCY_CONFLICT';end if;
   return c.id;
 end if;
 perform app_private.rate_limit(u,'submission_comment',10);
 insert into public.submission_comments(id,submission_id,user_id,content) values(p_id,p_submission,u,trim(p_content));return p_id;
end $$;
create function public.delete_submission_comment(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=app_private.require_actor();
begin
 delete from public.submission_comments where id=p_id and user_id=u;
 if not found then raise exception 'NOT_OWNER';end if;
end $$;

revoke all on function public.save_submission_draft(uuid,integer,uuid,text,text,text,text[],text,boolean),public.publish_submission(uuid,integer),public.manage_submission(uuid,text),public.my_writing(),public.set_submission_mark(uuid,text,boolean),public.save_submission_progress(uuid,numeric),public.save_submission_comment(uuid,uuid,text),public.delete_submission_comment(uuid) from public,anon;
grant execute on function public.save_submission_draft(uuid,integer,uuid,text,text,text,text[],text,boolean),public.publish_submission(uuid,integer),public.manage_submission(uuid,text),public.my_writing(),public.set_submission_mark(uuid,text,boolean),public.save_submission_progress(uuid,numeric),public.save_submission_comment(uuid,uuid,text),public.delete_submission_comment(uuid) to authenticated;
revoke all on function public.submission_feed(text,text,text,text,integer,uuid,boolean) from public;
grant execute on function public.submission_feed(text,text,text,text,integer,uuid,boolean) to anon,authenticated;
