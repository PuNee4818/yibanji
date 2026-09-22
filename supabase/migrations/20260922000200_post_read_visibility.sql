-- Preserve stored data; a removed post is no longer publicly readable.
-- Article/reply tombstones retain their existing independent policies.
alter policy read_visible on public.community_posts using(
 status='visible' and
 (article_id is null or exists(select 1 from public.articles a where a.id=article_id and a.active))
);
