import js from '@eslint/js';
import globals from 'globals';
import ts from 'typescript-eslint';

export default ts.config(
  { ignores: ['node_modules/**', 'dist/**', '.astro/**', '.workbuddy/**', 'playwright-report/**', 'test-results/**'] },
  js.configs.recommended,
  ...ts.configs.recommended.map(config => ({ ...config, files: ['**/*.ts'] })),
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  { files: ['**/*.js'], languageOptions: { sourceType: 'commonjs' } }
);
