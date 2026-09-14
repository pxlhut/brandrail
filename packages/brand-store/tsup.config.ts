import { defineConfig } from 'tsup';

// Four entry points, four subpath exports (D10). Declared up front:
// retrofitting subpath exports after consumers exist is a breaking change.
export default defineConfig({
  entry: {
    index: 'src/contract/index.ts',
    conformance: 'src/conformance/index.ts',
    memory: 'src/memory/index.ts',
    service: 'src/service/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
});
