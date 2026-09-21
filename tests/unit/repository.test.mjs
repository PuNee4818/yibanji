import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

test('environment and secret paths cannot be accidentally staged', () => {
  for (const path of ['.env', '.env.local', '.env.production', 'secrets/example.json', 'private.secret', 'secret.json', '.secrets', 'private.pem', 'credentials.json']) {
    assert.equal(execFileSync('git', ['check-ignore', path], { encoding: 'utf8' }).trim(), path);
  }
  assert.equal(execFileSync('git', ['ls-files', '.env', '.env.local'], { encoding: 'utf8' }), '');
});

test('example environment contains placeholders and only supported public settings', () => {
  const example = readFileSync('.env.example', 'utf8');
  assert.match(example, /PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key/);
  assert.doesNotMatch(example, /sb_publishable_|sb_secret_|PUBLIC_SUPABASE_ANON_KEY/);
  const publicNames = example.split('\n').filter(line => line.startsWith('PUBLIC_')).map(line => line.split('=')[0]);
  assert.deepEqual(publicNames, ['PUBLIC_SUPABASE_URL', 'PUBLIC_SUPABASE_PUBLISHABLE_KEY']);
});
