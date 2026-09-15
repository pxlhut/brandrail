import { defineConfig } from 'tsup';

// Two entry points, two subpath exports — `.` for the store class itself,
// `./provider` for the Adonis service provider (kept separate so importing
// the store doesn't pull in `@adonisjs/core`'s `ApplicationService` type,
// and so a host app's `adonisrc.ts` can reference the provider by path the
// same way it references Lucid's own `@adonisjs/lucid/database_provider`).
export default defineConfig({
  entry: {
    index: 'src/index.ts',
    provider: 'src/provider/brand_store_provider.ts',
    models: 'src/models/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
});
