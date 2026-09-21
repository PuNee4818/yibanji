import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

export function sql(query, diagnostics = false) {
  mkdirSync('supabase/.temp', { recursive: true });
  const file = resolve('supabase/.temp', `query-${randomUUID()}.sql`);
  writeFileSync(file, query);
  try {
    const cli = resolve('node_modules/supabase/dist/supabase.js');
    const output = execFileSync(process.execPath, [cli,'db', 'query', '--linked', '--file', file, '--output-format', 'json'], { encoding: 'utf8', timeout: 90000, maxBuffer: 4 * 1024 * 1024, stdio: ['ignore','pipe','pipe'] });
    const start = output.indexOf('{');
    const result = JSON.parse(output.slice(start));
    if (result.error) throw new Error(result.error.message);
    return result.rows ?? result;
  } catch (error) {
    if(diagnostics && error.stdout) console.error(String(error.stdout));
    // Query files can contain generated test-account passwords. Never echo SQL or CLI buffers.
    throw new Error(`Database query failed (${error.status ?? 'transport'}). Inspect the named test/migration; credentials and SQL output suppressed.`);
  } finally { unlinkSync(file); }
}
export const quote = value => "'" + String(value).replaceAll("'", "''") + "'";
