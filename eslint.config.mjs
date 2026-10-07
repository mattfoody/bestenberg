import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/vendor/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    files: ['wp/editor/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
  {
    // PLAN.md §2.6 / CLAUDE.md: @wordpress/* only in wp/ and adapter-blocks.
    files: ['packages/**/*.ts'],
    ignores: ['packages/adapter-blocks/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@wordpress/*'],
              message:
                'WordPress packages are only allowed in wp/ and packages/adapter-blocks (PLAN.md §2.6).',
            },
          ],
        },
      ],
    },
  },
);
