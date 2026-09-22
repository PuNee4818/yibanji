-- Remember every published revision, not only the first rewarded snapshot.
create table app_private.writing_fingerprints(
 author_id uuid references public.profiles(id) on delete cascade,
 fingerprint text not null,primary key(author_id,fingerprint)
);
alter table app_private.writing_fingerprints enable row level security;
revoke all on app_private.writing_fingerprints from public,anon,authenticated;
insert into app_private.writing_fingerprints
select author_id,fingerprint from app_private.writing_rewards where fingerprint is not null
union select user_id,md5(lower(regexp_replace(body,'[^[:alnum:]]','','g'))) from public.submissions
on conflict do nothing;

create or replace function app_private.reward_publication() returns trigger language plpgsql security definer set search_path='' as $$
declare body_key text;letters text;n integer;first_work boolean;seen boolean;
begin
 if new.status<>'published' then return null;end if;
 letters:=regexp_replace(new.body,'[^[:alnum:]]','','g');
 body_key:=md5(lower(letters));
 perform 1 from public.user_wallets where user_id=new.user_id for update;
 select exists(select 1 from app_private.writing_fingerprints where author_id=new.user_id and fingerprint=body_key) into seen;
 insert into app_private.writing_fingerprints values(new.user_id,body_key) on conflict do nothing;
 if seen or char_length(letters)<(case when new.genre in('poetry','classical','ci') then 20 else 120 end) or letters ~ '^(.)\1*$' then return null;end if;
 if exists(select 1 from app_private.writing_rewards where author_id=new.user_id and kind='publish' and article_id=new.id::text) then return null;end if;
 select count(*) into n from app_private.writing_rewards where author_id=new.user_id and kind='publish' and day=app_private.today() and amount>0;
 first_work:=not exists(select 1 from app_private.writing_rewards where author_id=new.user_id and kind='publish' and amount>0);
 insert into app_private.writing_rewards(author_id,article_id,actor_id,kind,fingerprint,amount)
 values(new.user_id,new.id::text,new.user_id,'publish',body_key,case when n<2 then 60 else 0 end);
 if n<2 then
   perform app_private.award(new.user_id,0,60,'submission_publish',new.id::text,'writing:publish:'||new.id);
   if first_work then perform app_private.award(new.user_id,0,40,'submission_debut',new.id::text,'writing:debut');end if;
 end if;
 return null;
end $$;
revoke all on function app_private.reward_publication() from public,anon,authenticated;
