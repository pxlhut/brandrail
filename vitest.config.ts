import { defineConfig } from 'vitest/config';

// Vitest 3 replaced `vitest.workspace.ts` with `test.projects`.
export default defineConfig({
  test: {
    projects: ['packages/*'],
    passWithNoTests: true,
  },
});
