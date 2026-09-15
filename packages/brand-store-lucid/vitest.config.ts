import { defineConfig } from 'vitest/config';

// The conformance suite calls bare `describe`/`it`/`expect` globals rather
// than importing them from 'vitest' (step 11) — running it here needs the
// same globals turned on, same as `@pxlhut/brand-store`'s own vitest config.
export default defineConfig({
  test: {
    globals: true,
    // Every test file in this package migrates the same real Postgres
    // database in its own `beforeAll` — running files in parallel races
    // those migrations against each other (duplicate `create table`).
    fileParallelism: false,
  },
});
