import { defineConfig } from 'vitest/config';

// The conformance suite (src/conformance) calls bare `describe`/`it`/`expect`
// globals rather than importing them from 'vitest' — that's what lets an
// adapter author run it under their own Jest *or* Vitest setup with no
// bespoke runner (step 11). Exercising that here, in this package's own
// tests, needs the same globals turned on.
export default defineConfig({
  test: {
    globals: true,
  },
});
