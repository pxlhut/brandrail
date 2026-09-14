#!/usr/bin/env node
/**
 * Post-build check: brand-core must be browser-safe and must not have grown a
 * third runtime dependency without a recorded decision (D10, step 02).
 *
 * The ESLint rules catch source-level violations. This catches a *dependency*
 * dragging a Node built-in into the bundle, which source linting cannot see.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const PKG = 'packages/brand-core';
const ALLOWED_DEPS = ['culori', 'apca-w3'];
const BUILTINS = [
  'fs', 'path', 'os', 'crypto', 'child_process', 'http', 'https', 'net',
  'stream', 'worker_threads', 'perf_hooks', 'util', 'url', 'zlib', 'buffer',
];

const problems = [];

const pkg = JSON.parse(readFileSync(join(PKG, 'package.json'), 'utf8'));
const deps = Object.keys(pkg.dependencies ?? {});
for (const d of deps) {
  if (!ALLOWED_DEPS.includes(d)) {
    problems.push(
      `${PKG} depends on "${d}". Core's dependency list is fixed at ` +
      `${ALLOWED_DEPS.join(' + ')} (D10). Adding a third needs a recorded decision.`,
    );
  }
}

const dist = join(PKG, 'dist');
if (!existsSync(dist)) {
  console.error(`purity: ${dist} not found — run the build first.`);
  process.exit(1);
}

const pattern = new RegExp(
  `(?:require\\(|from\\s*)["'](?:node:)?(${BUILTINS.join('|')})["']`,
  'g',
);

for (const file of readdirSync(dist).filter((f) => /\.(js|cjs|mjs)$/.test(f))) {
  const src = readFileSync(join(dist, file), 'utf8');
  for (const m of src.matchAll(pattern)) {
    problems.push(`${PKG}/dist/${file} imports Node built-in "${m[1]}" — core must run in a browser.`);
  }
}

if (problems.length) {
  console.error('\npurity check FAILED:\n');
  for (const p of problems) console.error('  • ' + p);
  console.error('');
  process.exit(1);
}
console.log(`purity: ok — ${PKG} is browser-safe, deps = [${deps.join(', ')}]`);
