import {sql,quote} from './db.mjs';
const [action,username]=process.argv.slice(2);
if(!['grant','revoke'].includes(action)||!username||!/^[a-z][a-z0-9_]{2,39}$/.test(username))throw new Error('Usage: npm run admin -- grant|revoke <exact-username>');
const profiles=sql(`select id,username from public.profiles where username=${quote(username)}`);
if(profiles.length!==1)throw new Error('No unique profile matches this username. Register the intended account first.');
sql(`begin;update app_private.account_states set is_admin=${action==='grant'} where user_id=${quote(profiles[0].id)};
insert into app_private.moderation_audit(target_kind,target_id,action,reason) values('profile',${quote(profiles[0].id)},${quote('admin_'+action)},'Operator provisioned via authenticated Supabase CLI');commit;`);
console.log(`Admin access ${action==='grant'?'granted to':'revoked from'} @${username}.`);
