import js from '@eslint/js';
import globals from 'globals';
import ts from 'typescript-eslint';
import astro from 'eslint-plugin-astro';

export default ts.config(
  { ignores: ['node_modules/**', 'dist/**', '.astro/**', '.workbuddy/**', 'src/generated/**', 'playwright-report/**', 'test-results/**'] },
  js.configs.recommended,
  ...ts.configs.recommended.map(config => ({ ...config, files: ['**/*.ts'] })),
  ...astro.configs['flat/recommended'],
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  { files: ['**/*.js'], languageOptions: { sourceType: 'commonjs' } }
);
