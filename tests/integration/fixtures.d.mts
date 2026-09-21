import type {SupabaseClient} from '@supabase/supabase-js';
export function fixtures(count?:number):Promise<{users:{id:string;email:string;password:string}[];clients:SupabaseClient[];cleanup:()=>unknown}>;
export function client():SupabaseClient;
