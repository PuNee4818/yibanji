-- Public badges keep a coarse level. Exact progress and achievement history are owner-only.
revoke select on public.user_progress from anon,authenticated;
grant select(user_id,level) on public.user_progress to anon,authenticated;
alter policy read_public on public.user_achievements using(user_id=(select auth.uid()));
create or replace function public.profile_community(p_user uuid,p_page integer default 0) returns jsonb language sql stable security definer set search_path='' as $$
select jsonb_build_object('progress',(select to_jsonb(p) from public.user_progress p where user_id=p_user and p_user=auth.uid()),
'featured',(select featured_achievement from public.profiles where id=p_user),
'badges',(select coalesce(jsonb_agg(to_jsonb(d)||jsonb_build_object('unlocked_at',u.unlocked_at)),'[]') from public.user_achievements u join public.achievement_definitions d on d.id=u.achievement_id where user_id=p_user and p_user=auth.uid() and unlocked_at is not null),
'activity',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from(select * from public.discussion_items where user_id=p_user and status='visible' and kind in('article','post') and (target is null or exists(select 1 from public.articles where id=target and active)) order by created_at desc limit 20 offset greatest(0,least(p_page,100))*20)x)) $$;

-- Editorial display title; article identity and body are unchanged.
update public.articles set title='开卷序' where id='preface2' and title='第二版序';
