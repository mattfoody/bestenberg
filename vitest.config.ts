import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const src = (pkg: string) =>
  fileURLToPath(new URL(`./packages/${pkg}/src/index.ts`, import.meta.url));

export default defineConfig({
  resolve: {
    // Test against package sources, not built dist.
    alias: {
      '@bestenberg/tokens': src('tokens'),
      '@bestenberg/schema': src('schema'),
      '@bestenberg/ai': src('ai'),
      '@bestenberg/adapter-blocks': src('adapter-blocks'),
    },
  },
  test: {
    include: ['packages/*/src/**/*.test.ts'],
    environment: 'node',
  },
});
