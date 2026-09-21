import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parseEnv } from 'node:util';
import { sql, quote } from './db.mjs';

// Management API transport is used after CLI direct Postgres connection failed.
// Migration text, history record and checksum are committed in a single transaction.
sql(`create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations(version text primary key,statements text[],name text);
create schema if not exists app_migrations;
revoke all on schema app_migrations from public,anon,authenticated;
create table if not exists app_migrations.checksums(version text primary key,sha256 text not null);`);
for (const file of readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort()) {
  const version = file.split('_')[0];
  const migration = readFileSync(`supabase/migrations/${file}`, 'utf8').replaceAll('\r\n','\n');
  const hash = createHash('sha256').update(migration).digest('hex');
  const applied = sql(`select m.version,c.sha256 from supabase_migrations.schema_migrations m left join app_migrations.checksums c using(version) where m.version=${quote(version)}`);
  if (applied.length) {
    if (applied[0].sha256 !== hash) throw new Error(`Applied migration checksum mismatch: ${file}`);
    console.log(`Already applied: ${file}`); continue;
  }
  sql(`begin; select pg_advisory_xact_lock(8192345); ${migration}
insert into supabase_migrations.schema_migrations(version,name,statements) values(${quote(version)},${quote(file.slice(version.length+1,-4))},array[${quote(migration)}]);
insert into app_migrations.checksums values(${quote(version)},${quote(hash)}); commit;`);
  console.log(`Applied: ${file}`);
}
const config=parseEnv(readFileSync('.env.local','utf8').replace(/^\uFEFF/,''));
const timezone=config.SITE_TIMEZONE || process.env.SITE_TIMEZONE || 'Asia/Shanghai';
if(sql("select to_regclass('app_private.site_config') as name")[0].name) {
  if(!sql(`select name from pg_timezone_names where name=${quote(timezone)}`).length) throw new Error('Invalid SITE_TIMEZONE');
  sql(`update app_private.site_config set timezone=${quote(timezone)} where id`);
  console.log('Database calendar timezone synchronized from server configuration.');
}
