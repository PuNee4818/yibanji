-- Public profile data is separate from private moderation state.
create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z][a-z0-9_]{2,39}$'),
  display_name text not null default '新书友' check (char_length(display_name) between 1 and 60),
  bio text not null default '' check (char_length(bio) <= 280),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table app_private.account_states (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  status text not null default 'normal' check (status in ('normal','restricted','suspended')),
  is_admin boolean not null default false
);
create table app_private.rate_windows (
  user_id uuid not null references public.profiles(id) on delete cascade,
  scope text not null, window_start timestamptz not null, count integer not null,
  primary key(user_id,scope)
);
create table public.user_follows (
  follower_id uuid references public.profiles(id) on delete cascade,
  following_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(follower_id,following_id), check (follower_id <> following_id)
);
create index follows_following_idx on public.user_follows(following_id,created_at desc);
alter table public.profiles enable row level security;
alter table public.user_follows enable row level security;
alter table app_private.account_states enable row level security;
alter table app_private.rate_windows enable row level security;
revoke all on public.profiles, public.user_follows from anon,authenticated;
grant select on public.profiles, public.user_follows to anon,authenticated;
create policy profiles_read on public.profiles for select using (true);
create policy follows_read on public.user_follows for select using (true);

create function app_private.require_actor() returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid := auth.uid(); s text;
begin
  if u is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  select status into s from app_private.account_states where user_id=u for update;
  if s is distinct from 'normal' then raise exception 'ACCOUNT_RESTRICTED' using errcode='42501'; end if;
  return u;
end $$;
create function app_private.rate_limit(u uuid, scope_name text, max_count integer) returns void language plpgsql security definer set search_path='' as $$
declare n integer; w timestamptz := date_trunc('minute',clock_timestamp());
begin
  insert into app_private.rate_windows values(u,scope_name,w,1)
  on conflict(user_id,scope) do update set window_start=w,
    count=case when rate_windows.window_start=w then rate_windows.count+1 else 1 end returning count into n;
  if n > max_count then raise exception 'RATE_LIMITED' using errcode='P0001'; end if;
end $$;
create function app_private.initialize_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.profiles(id,username) values(new.id,'reader_'||replace(new.id::text,'-',''));
  insert into app_private.account_states(user_id) values(new.id);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function app_private.initialize_user();
-- Backfill only real existing Auth users, if any.
insert into public.profiles(id,username) select id,'reader_'||replace(id::text,'-','') from auth.users on conflict(id) do nothing;
insert into app_private.account_states(user_id) select id from public.profiles on conflict do nothing;

create function public.save_profile(p_username text,p_display_name text,p_bio text) returns public.profiles language plpgsql security definer set search_path='' as $$
declare u uuid:=app_private.require_actor(); result public.profiles;
begin
  perform app_private.rate_limit(u,'profile',10);
  update public.profiles set username=lower(trim(p_username)),display_name=trim(p_display_name),bio=trim(p_bio),updated_at=now() where id=u returning * into result;
  return result;
end $$;
create function public.set_follow(p_user_id uuid,p_following boolean) returns boolean language plpgsql security definer set search_path='' as $$
declare u uuid:=app_private.require_actor();
begin
  perform app_private.rate_limit(u,'follow',30);
  if p_user_id=u then raise exception 'CANNOT_FOLLOW_SELF'; end if;
  if p_following then insert into public.user_follows(follower_id,following_id) values(u,p_user_id) on conflict do nothing;
  else delete from public.user_follows where follower_id=u and following_id=p_user_id; end if;
  return p_following;
end $$;
create view public.profile_summaries with(security_invoker=true) as
select p.*,(select count(*) from public.user_follows f where f.following_id=p.id) as follower_count,
(select count(*) from public.user_follows f where f.follower_id=p.id) as following_count from public.profiles p;
grant select on public.profile_summaries to anon,authenticated;
revoke all on all functions in schema app_private from public,anon,authenticated;
revoke all on function public.save_profile(text,text,text),public.set_follow(uuid,boolean) from public,anon;
grant execute on function public.save_profile(text,text,text),public.set_follow(uuid,boolean) to authenticated;
