import { defineConfig } from 'vitest/config';

// The hook renders through `@testing-library/react`, which needs a DOM.
export default defineConfig({
  test: {
    environment: 'jsdom',
  },
});
