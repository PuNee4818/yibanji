import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite';
import node from '@astrojs/node';
import vercel from '@astrojs/vercel';
import { validatePublicEnv } from './tools/public-env.mjs';

export default defineConfig({
  output: 'static',
  adapter: process.env.VERCEL === '1' ? vercel() : node({ mode: 'standalone' }),
  trailingSlash: 'always',
  vite: { build: { sourcemap: false } },
  integrations: [{
    name: 'validate-public-configuration',
    hooks: {
      'astro:build:start': () => validatePublicEnv(loadEnv('production', process.cwd(), 'PUBLIC_')),
    },
  }],
});
