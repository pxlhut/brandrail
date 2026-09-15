import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * The rules that matter here are the brand-core purity constraints. Core must
 * run in a browser (live preview, guideline §3) and must be pure, because SSR
 * correctness depends on it (§39). These catch the common ways that breaks.
 */
const PURITY_GLOBALS = [
  { name: 'process', message: 'brand-core must run in a browser. No Node globals.' },
  { name: 'fetch', message: 'brand-core is pure. No I/O.' },
  { name: 'crypto', message: 'Hashing belongs in the service layer (D7), not core.' },
  { name: 'Date', message: 'brand-core is deterministic. No clock.' },
];

const PURITY_PROPERTIES = [
  { object: 'Math', property: 'random', message: 'brand-core is deterministic. No randomness.' },
  { object: 'Date', property: 'now', message: 'brand-core is deterministic. No clock.' },
];

/** Build tooling and scripts run in Node, not in a browser. */
const NODE_GLOBALS = {
  module: 'readonly',
  require: 'readonly',
  console: 'readonly',
  process: 'readonly',
  __dirname: 'readonly',
  URL: 'readonly',
  Buffer: 'readonly',
};

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/.changeset/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['packages/brand-core/src/**/*.ts'],
    rules: {
      'no-restricted-globals': ['error', ...PURITY_GLOBALS],
      'no-restricted-properties': ['error', ...PURITY_PROPERTIES],
    },
  },
  {
    files: ['**/*.test.ts', 'packages/brand-core/proofs/**', 'packages/brand-core/fixtures/**'],
    rules: { 'no-restricted-globals': 'off', 'no-restricted-properties': 'off' },
  },
  {
    files: ['scripts/**', '**/*.cjs', '*.config.{js,ts}', '**/tsup.config.ts'],
    languageOptions: { globals: NODE_GLOBALS },
  },
);
