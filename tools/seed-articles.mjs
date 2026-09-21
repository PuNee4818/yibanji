import {writeFileSync,existsSync} from 'node:fs';
import {loadBook} from './load-book.mjs';
const quote=value=>"'"+String(value).replaceAll("'","''")+"'";
const path='supabase/migrations/20260921000310_article_catalog.sql';
if(existsSync(path))throw new Error('Catalog migration already exists; create a new migration for later additions.');
writeFileSync(path,'-- Original article IDs and metadata, never client-created.\ninsert into public.articles(id,title,author,category,chapter_count) values\n'+loadBook().articles.map(a=>`(${[a.id,a.title,a.author,a.category].map(quote).join(',')},${a.chapters?.length||1})`).join(',\n')+';\ninsert into public.article_stats(article_id) select id from public.articles;\n');
