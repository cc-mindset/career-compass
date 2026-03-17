import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { defineConfig } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default defineConfig([
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { js, 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    extends: ['js/recommended'],
    languageOptions: { globals: globals.browser },
    ignores: ['**/dist/**', '**/node_modules/**'],
  },
  tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
]);
