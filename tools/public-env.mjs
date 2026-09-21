export function validatePublicEnv(env) {
  const url = env.PUBLIC_SUPABASE_URL;
  const key = env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const missing = ['PUBLIC_SUPABASE_URL', 'PUBLIC_SUPABASE_PUBLISHABLE_KEY'].filter(name => !env[name]);
  if (missing.length) throw new Error(`Missing build configuration: ${missing.join(', ')}. Set these in the hosting project's environment variables and rebuild. Local .env.local is not uploaded.`);
  try {
    const parsed = new URL(url);
    if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error();
  } catch {
    throw new Error('PUBLIC_SUPABASE_URL must be a valid HTTP(S) project URL.');
  }
  if (!key.startsWith('sb_publishable_')) throw new Error('PUBLIC_SUPABASE_PUBLISHABLE_KEY must be a publishable key. Never expose a secret key.');
}
