import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePublicEnv } from '../../tools/public-env.mjs';

test('missing hosting configuration fails without exposing environment values', () => {
  assert.throws(() => validatePublicEnv({}), /PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  assert.throws(() => validatePublicEnv({ PUBLIC_SUPABASE_URL: 'https://project.supabase.co' }), /PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  assert.throws(() => validatePublicEnv({ PUBLIC_SUPABASE_URL: 'invalid', PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example' }), /valid HTTP/);
});

test('public configuration rejects privileged and legacy keys', () => {
  for (const key of ['sb_secret_sensitive-value', 'legacy-jwt']) {
    assert.throws(() => validatePublicEnv({ PUBLIC_SUPABASE_URL: 'https://project.supabase.co', PUBLIC_SUPABASE_PUBLISHABLE_KEY: key }), error => !error.message.includes(key));
  }
  assert.doesNotThrow(() => validatePublicEnv({ PUBLIC_SUPABASE_URL: 'https://project.supabase.co', PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example' }));
});
