import { execFileSync } from 'node:child_process';
execFileSync(process.execPath, ['tools/generate-content.mjs'], { stdio: 'inherit' });
execFileSync(process.execPath, ['node_modules/astro/bin/astro.mjs', 'build'], {
  stdio: 'inherit', env: { ...process.env, VERCEL: '1' }
});
