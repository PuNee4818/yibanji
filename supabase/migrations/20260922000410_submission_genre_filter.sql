-- Modern poetry, classical poetry and ci are distinct discoverable genres.
create or replace function public.submission_feed(p_query text default '',p_genre text default '',p_tag text default '',p_sort text default 'latest',p_page integer default 0,p_user uuid default null,p_short boolean default false)
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
 and (p_genre='' or s.genre=p_genre)
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
