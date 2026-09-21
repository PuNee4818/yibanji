import{test}from'node:test';import assert from'node:assert/strict';import{randomUUID}from'node:crypto';
import{fixtures,client}from'./fixtures.mjs';import{sql,quote}from'../../tools/db.mjs';
test('real comments, replies, likes, posts, followed feed, spam rules and ownership',async()=>{
 const f=await fixtures();const[a,b]=f.clients;const[ua,ub]=f.users;const article=`test_${randomUUID().replaceAll('-','')}`;
 const save=(c,args)=>c.rpc('save_discussion',{p_key:randomUUID(),...args});
 try{
  sql(`insert into public.articles(id,title,author,category) values(${quote(article)},'讨论联调','测试','测试');insert into public.article_stats(article_id) values(${quote(article)});`);
  const key=randomUUID();const payload={p_kind:'article',p_target:article,p_content:'这篇文章让人想起了旧日校园的生活。',p_key:key};
  const first=await save(a,payload);assert.equal(first.error,null);const id=first.data;
  assert.equal((await save(a,payload)).data,id);
  assert.ok((await save(a,{...payload,p_key:randomUUID()})).error);
  const reply=await save(b,{p_kind:'article',p_target:article,p_parent:id,p_content:'我也记得那些一起读书的日子。'});assert.equal(reply.error,null);
  assert.ok((await save(b,{p_kind:'article',p_target:'a01',p_parent:id,p_content:'不能跨文章回复这条评论的内容。'})).error);
  assert.equal((await b.rpc('set_discussion_like',{p_kind:'article',p_id:id,p_active:true})).error,null);
  let thread=(await a.rpc('discussion_thread',{p_kind:'article',p_target:article,p_sort:'hot'})).data;
  assert.equal(thread.length,2);assert.equal(thread.find(x=>x.id===id).like_count,1);assert.equal(thread.find(x=>x.id===id).reply_count,1);
  assert.ok((await save(b,{p_kind:'article',p_target:article,p_id:id,p_content:'不能编辑其他读者的内容。'})).error);
  assert.ok((await b.from('comments').update({content:'not owned'}).eq('id',id)).error);
  const post=await save(b,{p_kind:'post',p_target:article,p_content:'最近又读了一次文集，想和书友聊聊。'});assert.equal(post.error,null);
  assert.equal((await a.rpc('set_discussion_like',{p_kind:'post',p_id:post.data,p_active:true})).error,null);
  const pc=await save(a,{p_kind:'post_comment',p_target:post.data,p_content:'很高兴在这里遇见同样喜欢阅读的人。'});assert.equal(pc.error,null);
  assert.equal((await a.rpc('set_follow',{p_user_id:ub.id,p_following:true})).error,null);
  const feed=(await a.rpc('community_feed',{p_tab:'following'})).data;assert.ok(feed.some(x=>x.id===post.data));assert.ok(feed.every(x=>x.user_id===ub.id));
  assert.ok((await client().rpc('community_feed',{p_tab:'following'})).error);
  assert.equal((await a.rpc('visit_community',{p_post:post.data})).error,null);
  const g=(await a.rpc('growth_summary')).data;assert.ok(g.tasks.find(t=>t.id==='daily_discuss').rewarded_at);assert.ok(g.tasks.find(t=>t.id==='daily_community').rewarded_at);
  assert.equal((await a.rpc('delete_discussion',{p_kind:'article',p_id:id})).error,null);
  thread=(await a.rpc('discussion_thread',{p_kind:'article',p_target:article})).data;assert.equal(thread.find(x=>x.id===id).status,'deleted');
  assert.equal((await a.rpc('article_context',{p_article:article})).data.stats.comment_count,1);
  sql(`update app_private.account_states set status='restricted' where user_id=${quote(ua.id)}`);
  assert.ok((await save(a,{p_kind:'post',p_target:null,p_content:'受限账号不能发布这条动态。'})).error);
  console.log('Verified discussion ownership, replies, likes, duplicate rejection, transactional counts, post comments, followed feed privacy and discussion task rewards.');
 }finally{f.cleanup();sql(`delete from public.articles where id=${quote(article)}`);}
});
