import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import vercel from '@astrojs/vercel';

export default defineConfig({
  output: 'static',
  adapter: process.env.VERCEL === '1' ? vercel() : node({ mode: 'standalone' }),
  trailingSlash: 'always',
  vite: { build: { sourcemap: false } },
});
