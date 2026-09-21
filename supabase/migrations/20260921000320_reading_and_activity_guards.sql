create or replace function public.begin_read(p_article text) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=app_private.require_actor();token uuid;
begin perform app_private.assert_article(p_article);perform app_private.rate_limit(u,'begin_read',20);
 delete from app_private.reading_sessions where user_id=u and started_at<now()-interval '6 hours';
 insert into public.reading_progress(user_id,article_id) values(u,p_article) on conflict(user_id,article_id) do update set updated_at=now();
 insert into app_private.reading_sessions(user_id,article_id) values(u,p_article) returning id into token;return token;end $$;
create or replace function public.set_article_state(p_article text,p_kind text,p_active boolean) returns boolean language plpgsql security definer set search_path='' as $$
declare u uuid:=app_private.require_actor();tbl text;n integer;
begin
 perform app_private.assert_article(p_article);perform app_private.rate_limit(u,'article_state',60);
 if p_kind not in('like','bookmark') or p_kind is null then raise exception 'INVALID_KIND';end if;
 tbl:=case when p_kind='like' then 'article_likes' else 'bookmarks' end;
 if p_active then
 execute format('insert into public.%I(user_id,article_id) values($1,$2) on conflict do nothing',tbl) using u,p_article;get diagnostics n=row_count;
 if n>0 then
 if not exists(select 1 from app_private.community_events where user_id=u and event=p_kind and reference=p_article and event_date=app_private.today()) then
 insert into public.article_activity(article_id,day,likes,bookmarks) values(p_article,app_private.today(),case when p_kind='like' then 1 else 0 end,case when p_kind='bookmark' then 1 else 0 end) on conflict(article_id,day) do update set likes=article_activity.likes+excluded.likes,bookmarks=article_activity.bookmarks+excluded.bookmarks;
 end if;
 perform app_private.record_event(u,p_kind,p_article);end if;
 else execute format('delete from public.%I where user_id=$1 and article_id=$2',tbl) using u,p_article;end if;
 return p_active;
end $$;
