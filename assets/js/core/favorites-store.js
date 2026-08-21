/* Favorites store: isolated persistence + validation for bookmark state. */
(function(global){
  'use strict';
  const KEY='yb_favs';
  const listeners=new Set();

  function read(){
    try{
      const raw=JSON.parse(localStorage.getItem(KEY)||'[]');
      return Array.isArray(raw) ? [...new Set(raw.filter(x=>typeof x==='string' && x))] : [];
    }catch{return [];}
  }
  let ids=read();

  function list(){ return [...ids]; }
  function has(id){ return ids.includes(id); }
  function count(){ return ids.length; }
  function persist(){
    localStorage.setItem(KEY,JSON.stringify(ids));
    const snapshot=list();
    listeners.forEach(fn=>{ try{ fn(snapshot); }catch(err){ console.error(err); } });
  }
  function add(id){
    if(!id || has(id)) return false;
    ids.push(id); persist(); return true;
  }
  function remove(id){
    const i=ids.indexOf(id);
    if(i<0) return false;
    ids.splice(i,1); persist(); return true;
  }
  function toggle(id){ return has(id) ? (remove(id),false) : (add(id),true); }
  function prune(validIds){
    const valid=new Set(validIds||[]);
    const next=ids.filter(id=>valid.has(id));
    if(next.length!==ids.length){ ids=next; persist(); }
    return list();
  }
  function subscribe(fn){ listeners.add(fn); return ()=>listeners.delete(fn); }

  global.YB_FAVORITES=Object.freeze({list,has,count,add,remove,toggle,prune,subscribe});
})(window);
