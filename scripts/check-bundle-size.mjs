#!/usr/bin/env node
/**
 * Post-build check: the published bundle size, measured the way a consumer
 * actually experiences it — minified and gzipped — with a budget CI enforces.
 *
 * "A budget nobody enforces is a comment" (step 09, proof 6). The number
 * printed here is also the one that belongs in the README: bundle size is a
 * real buying signal in this space.
 *
 * culori and apca-w3 are excluded by construction, not by extra work here:
 * tsup already treats every `dependencies` entry as external, so
 * `dist/index.js` never contains their code — only `@pxlhut/brand-core`'s
 * own source, unminified.
 */
import { readFileSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';
import { transform } from 'esbuild';

const PKG = 'packages/brand-core';
const ENTRY = join(PKG, 'dist/index.js');
const BUDGET_BYTES = 15 * 1024;

if (!existsSync(ENTRY)) {
  console.error(`size: ${ENTRY} not found — run the build first.`);
  process.exit(1);
}

const source = readFileSync(ENTRY, 'utf8');
const { code: minified } = await transform(source, { minify: true, format: 'esm' });
const gzipped = gzipSync(Buffer.from(minified, 'utf8'));

const rawKb = (Buffer.byteLength(source) / 1024).toFixed(1);
const minKb = (Buffer.byteLength(minified) / 1024).toFixed(1);
const gzipKb = (gzipped.length / 1024).toFixed(2);
const budgetKb = (BUDGET_BYTES / 1024).toFixed(0);

console.log(
  `size: ${PKG}/dist/index.js — raw ${rawKb} KB, minified ${minKb} KB, ` +
    `minified+gzipped ${gzipKb} KB (budget ${budgetKb} KB) — culori/apca-w3 excluded (external deps)`,
);

if (gzipped.length > BUDGET_BYTES) {
  console.error(
    `\nsize check FAILED: ${gzipKb} KB exceeds the ${budgetKb} KB budget. ` +
      `Either the bundle genuinely grew (update the budget deliberately, with ` +
      `a reason) or something regressed.`,
  );
  process.exit(1);
}
