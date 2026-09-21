export function safeLocalPath(value:string|null,origin:string,fallback='/me/settings/'):string {
 if(!value||!value.startsWith('/')||value.includes('\\')||Array.from(value).some(c=>c.charCodeAt(0)<=32))return fallback;
 try{const url=new URL(value,origin);return url.origin===origin?url.pathname+url.search+url.hash:fallback;}catch{return fallback;}
}
