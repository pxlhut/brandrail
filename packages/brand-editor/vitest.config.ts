import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// The hook and the registry components render through `@testing-library/react`, which needs a DOM.
export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./registry/_dev/vitest.setup.ts'],
  },
  resolve: {
    alias: {
      // Mirrors the alias a consumer's own `components.json` gives `@/*` — see `registry/tsconfig.json`'s own copy of this mapping.
      '@': fileURLToPath(new URL('./registry/_dev', import.meta.url)),
    },
  },
});
