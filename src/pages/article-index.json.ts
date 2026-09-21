import {book,articleUrl} from '../lib/book';
export const GET=()=>new Response(JSON.stringify(book.articles.map(a=>({id:a.id,title:a.title,author:a.author,url:articleUrl(a)}))),{headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=3600'}});
