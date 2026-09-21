create table public.articles(id text primary key,title text not null,author text not null,category text not null,chapter_count integer not null default 1,active boolean not null default true,published_at timestamptz not null default now());
create table public.article_stats(article_id text primary key references public.articles(id) on delete cascade,view_count bigint not null default 0 check(view_count>=0),like_count bigint not null default 0 check(like_count>=0),bookmark_count bigint not null default 0 check(bookmark_count>=0),comment_count bigint not null default 0 check(comment_count>=0),egg_count bigint not null default 0 check(egg_count>=0),egg_thrower_count bigint not null default 0 check(egg_thrower_count>=0),updated_at timestamptz not null default now());
create table public.article_likes(user_id uuid references public.profiles(id) on delete cascade,article_id text references public.articles(id) on delete cascade,created_at timestamptz not null default now(),primary key(user_id,article_id));
create table public.bookmarks(like public.article_likes including all);
alter table public.bookmarks add foreign key(user_id) references public.profiles(id) on delete cascade;
alter table public.bookmarks add foreign key(article_id) references public.articles(id) on delete cascade;
create index likes_article_idx on public.article_likes(article_id);
create index bookmarks_article_idx on public.bookmarks(article_id);
create table public.egg_throws(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,article_id text not null references public.articles(id),quantity integer not null check(quantity between 1 and 50),idempotency_key uuid not null,created_at timestamptz not null default now(),unique(user_id,idempotency_key));
create index egg_article_time_idx on public.egg_throws(article_id,created_at desc);
create table public.reading_progress(user_id uuid references public.profiles(id) on delete cascade,article_id text references public.articles(id) on delete cascade,chapter integer not null default 1,position numeric not null default 0 check(position between 0 and 1),max_depth numeric not null default 0 check(max_depth between 0 and 1),updated_at timestamptz not null default now(),primary key(user_id,article_id));
create table app_private.reading_sessions(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,article_id text not null references public.articles(id),started_at timestamptz not null default now(),last_seen timestamptz not null default now(),active_seconds integer not null default 0,max_depth numeric not null default 0);
create index reading_sessions_user_idx on app_private.reading_sessions(user_id,started_at);
create table app_private.view_salt(id boolean primary key default true check(id),salt uuid not null default gen_random_uuid());insert into app_private.view_salt(id) values(true);
create table app_private.article_views(viewer text not null,article_id text references public.articles(id) on delete cascade,view_date date not null,primary key(viewer,article_id,view_date));
create table public.article_activity(article_id text references public.articles(id) on delete cascade,day date not null,views integer not null default 0,likes integer not null default 0,comments integer not null default 0,bookmarks integer not null default 0,eggs integer not null default 0,primary key(article_id,day));
do $$ declare t text;begin foreach t in array array['articles','article_stats','article_likes','bookmarks','egg_throws','reading_progress','article_activity'] loop
execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from anon,authenticated',t);execute format('grant select on public.%I to authenticated',t);
if t in('articles','article_stats','article_activity') then execute format('grant select on public.%I to anon',t);execute format('create policy read_public on public.%I for select using(true)',t);
else execute format('create policy read_own on public.%I for select using(user_id=(select auth.uid()))',t);end if;end loop;end $$;
alter table app_private.reading_sessions enable row level security;alter table app_private.view_salt enable row level security;alter table app_private.article_views enable row level security;
create function app_private.assert_article(a text) returns void language plpgsql security definer set search_path='' as $$ begin if not exists(select 1 from public.articles where id=a and active) then raise exception 'ARTICLE_NOT_FOUND';end if;end $$;
create function app_private.article_state_count() returns trigger language plpgsql security definer set search_path='' as $$
declare a text:=case when TG_OP='INSERT' then new.article_id else old.article_id end;d integer:=case when TG_OP='INSERT' then 1 else -1 end;
begin
 if TG_TABLE_NAME='article_likes' then update public.article_stats set like_count=like_count+d,updated_at=now() where article_id=a;
 else update public.article_stats set bookmark_count=bookmark_count+d,updated_at=now() where article_id=a;end if;
 return null;
end $$;
create trigger article_likes_count after insert or delete on public.article_likes for each row execute function app_private.article_state_count();
create trigger bookmarks_count after insert or delete on public.bookmarks for each row execute function app_private.article_state_count();
create function public.set_article_state(p_article text,p_kind text,p_active boolean) returns boolean language plpgsql security definer set search_path='' as $$
declare u uuid:=app_private.require_actor();tbl text;n integer;
begin
 perform app_private.assert_article(p_article);perform app_private.rate_limit(u,'article_state',60);
 if p_kind not in('like','bookmark') or p_kind is null then raise exception 'INVALID_KIND';end if;
 tbl:=case when p_kind='like' then 'article_likes' else 'bookmarks' end;
 if p_active then
 execute format('insert into public.%I(user_id,article_id) values($1,$2) on conflict do nothing',tbl) using u,p_article;get diagnostics n=row_count;
 if n>0 then
 insert into public.article_activity(article_id,day,likes,bookmarks) values(p_article,app_private.today(),case when p_kind='like' then 1 else 0 end,case when p_kind='bookmark' then 1 else 0 end) on conflict(article_id,day) do update set likes=article_activity.likes+excluded.likes,bookmarks=article_activity.bookmarks+excluded.bookmarks;
 perform app_private.record_event(u,p_kind,p_article);end if;
 else execute format('delete from public.%I where user_id=$1 and article_id=$2',tbl) using u,p_article;end if;
 return p_active;
end $$;
create function public.import_bookmarks(p_articles text[]) returns integer language plpgsql security definer set search_path='' as $$
declare u uuid:=app_private.require_actor();a text;n integer:=0;
begin
 if coalesce(cardinality(p_articles),0)>100 then raise exception 'INVALID_QUANTITY';end if;
 perform app_private.rate_limit(u,'import',3);
 for a in select distinct id from public.articles where active and id=any(p_articles) loop
 if not exists(select 1 from public.bookmarks where user_id=u and article_id=a) then insert into public.bookmarks(user_id,article_id) values(u,a);perform app_private.record_event(u,'bookmark',a);n:=n+1;end if;
 end loop;return n;
end $$;
create function public.throw_eggs(p_article text,p_quantity integer,p_idempotency_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=app_private.require_actor();w public.user_wallets;old public.egg_throws;new_throw public.egg_throws;first_throw boolean;
begin
 if p_quantity is null or p_quantity<1 or p_quantity>(select max_throw from public.economy_rules where id) or p_idempotency_key is null then raise exception 'INVALID_QUANTITY' using errcode='22023';end if;
 perform app_private.assert_article(p_article);
 select * into w from public.user_wallets where user_id=u for update;
 select * into old from public.egg_throws where user_id=u and idempotency_key=p_idempotency_key;
 if found then
 if old.article_id<>p_article or old.quantity<>p_quantity then raise exception 'IDEMPOTENCY_CONFLICT';end if;
 return jsonb_build_object('throw_id',old.id,'quantity',old.quantity,'balance',w.egg_balance,'egg_count',(select egg_count from public.article_stats where article_id=p_article),'replayed',true);
 end if;
 perform app_private.rate_limit(u,'egg_throw',30);
 if w.egg_balance<p_quantity then raise exception 'INSUFFICIENT_EGGS';end if;
 first_throw:=not exists(select 1 from public.egg_throws where user_id=u and article_id=p_article);
 perform app_private.award(u,-p_quantity,0,'egg_throw',p_article,'throw:'||p_idempotency_key);
 insert into public.egg_throws(user_id,article_id,quantity,idempotency_key) values(u,p_article,p_quantity,p_idempotency_key) returning * into new_throw;
 update public.article_stats set egg_count=egg_count+p_quantity,egg_thrower_count=egg_thrower_count+case when first_throw then 1 else 0 end,updated_at=now() where article_id=p_article;
 insert into public.article_activity(article_id,day,eggs) values(p_article,app_private.today(),p_quantity) on conflict(article_id,day) do update set eggs=article_activity.eggs+excluded.eggs;
 perform app_private.refresh_achievements(u);
 return jsonb_build_object('throw_id',new_throw.id,'quantity',p_quantity,'balance',(select egg_balance from public.user_wallets where user_id=u),'egg_count',(select egg_count from public.article_stats where article_id=p_article),'replayed',false);
end $$;
create function public.article_context(p_article text) returns jsonb language sql stable security definer set search_path='' as $$
select jsonb_build_object('stats',(select to_jsonb(s) from public.article_stats s where article_id=p_article),
'liked',exists(select 1 from public.article_likes where user_id=auth.uid() and article_id=p_article),'bookmarked',exists(select 1 from public.bookmarks where user_id=auth.uid() and article_id=p_article),
'my_eggs',(select coalesce(sum(quantity),0) from public.egg_throws where user_id=auth.uid() and article_id=p_article),
'balance',(select egg_balance from public.user_wallets where user_id=auth.uid())) $$;
create function public.track_view(p_article text) returns void language plpgsql security definer set search_path='' as $$
declare v text;n integer;headers jsonb:=coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb;d date:=app_private.today();
begin
 perform app_private.assert_article(p_article);
 v:=md5(coalesce(auth.uid()::text,headers->>'cf-connecting-ip','anonymous')||d::text||(select salt::text from app_private.view_salt where id));
 if (select count(*) from app_private.article_views where viewer=v and view_date=d)>=100 then return;end if;
 insert into app_private.article_views values(v,p_article,d) on conflict do nothing;get diagnostics n=row_count;
 if n>0 then update public.article_stats set view_count=view_count+1 where article_id=p_article;
 insert into public.article_activity(article_id,day,views) values(p_article,d,1) on conflict(article_id,day) do update set views=article_activity.views+1;end if;
end $$;
create function public.begin_read(p_article text) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=app_private.require_actor();token uuid;
begin perform app_private.assert_article(p_article);perform app_private.rate_limit(u,'begin_read',20);
 delete from app_private.reading_sessions where user_id=u and started_at<now()-interval '6 hours';
 insert into app_private.reading_sessions(user_id,article_id) values(u,p_article) returning id into token;return token;end $$;
create function public.sync_reading(p_session uuid,p_depth numeric,p_chapter integer,p_position numeric) returns boolean language plpgsql security definer set search_path='' as $$
declare u uuid:=app_private.require_actor();s app_private.reading_sessions;elapsed integer;valid boolean;
begin
 perform app_private.rate_limit(u,'reading_sync',15);
 select * into s from app_private.reading_sessions where id=p_session and user_id=u and started_at>now()-interval '6 hours' for update;
 if not found then raise exception 'READING_SESSION_EXPIRED';end if;
 if p_depth is null or p_depth not between 0 and 1 or p_position is null or p_position not between 0 and 1 or p_chapter is null or p_chapter<1 or p_chapter>(select chapter_count from public.articles where id=s.article_id) then raise exception 'INVALID_PROGRESS';end if;
 elapsed:=floor(extract(epoch from clock_timestamp()-s.last_seen));
 update app_private.reading_sessions set active_seconds=active_seconds+case when elapsed between 1 and 25 then least(elapsed,15) else 0 end,last_seen=clock_timestamp(),max_depth=greatest(max_depth,p_depth) where id=p_session returning * into s;
 insert into public.reading_progress(user_id,article_id,chapter,position,max_depth) values(u,s.article_id,p_chapter,p_position,p_depth) on conflict(user_id,article_id) do update set chapter=excluded.chapter,position=excluded.position,max_depth=greatest(reading_progress.max_depth,excluded.max_depth),updated_at=now();
 valid:=s.active_seconds>=30 and s.max_depth>=0.3;
 if valid then perform app_private.record_event(u,'read',s.article_id);end if;return valid;
end $$;
revoke all on all functions in schema app_private from public,anon,authenticated;
revoke all on function public.set_article_state(text,text,boolean),public.import_bookmarks(text[]),public.throw_eggs(text,integer,uuid),public.begin_read(text),public.sync_reading(uuid,numeric,integer,numeric),public.article_context(text),public.track_view(text) from public,anon;
grant execute on function public.set_article_state(text,text,boolean),public.import_bookmarks(text[]),public.throw_eggs(text,integer,uuid),public.begin_read(text),public.sync_reading(uuid,numeric,integer,numeric) to authenticated;
grant execute on function public.article_context(text),public.track_view(text) to anon,authenticated;
