/**
 * Proof 4a — purity is structural, source half (step 09).
 *
 * ESLint's `no-restricted-globals` rule already flags `Date`, `Math.random`,
 * `process` and `fetch` in `src/**\/*.ts` (`eslint.config.js`) — but that rule
 * can be silenced with a single `eslint-disable` comment, and a disabled
 * rule is invisible in a diff unless someone is looking for it. This is the
 * same check again, as a grep with no escape hatch: it reads every non-test
 * source file and fails the build on a hit, full stop.
 *
 * Test files are excluded deliberately, matching ESLint's own carve-out for
 * them (`eslint.config.js`) — a test may legitimately use these globals
 * (timing, fuzzing), and none of it ships in the built bundle.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = join(HERE, '../src');

/** Every non-test, non-declaration `.ts` file under `src/`. */
function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(full));
      continue;
    }
    if (entry.endsWith('.ts') && !entry.endsWith('.test.ts') && !entry.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Regex, not a plain string search, for two reasons: `Date.now`/`Math.random`
 * need a literal `.` to avoid flagging an unrelated identifier that merely
 * contains the word, and `process.`/`fetch(` need to not fire on a comment
 * that merely *mentions* them (like this file's own doc comment above) —
 * `\bfetch\(` and `\bprocess\.` anchor to a real call/property-access shape.
 */
const FORBIDDEN_PATTERNS: readonly RegExp[] = [
  /\bDate\.now\(/,
  /\bMath\.random\(/,
  /\bprocess\.\w/,
  /\bfetch\(/,
];

describe('proof 4a — no forbidden global in brand-core source', () => {
  const files = sourceFiles(SRC_DIR);

  it('found source files to check', () => {
    // A silently-empty file list would make every other assertion in this
    // suite vacuously true.
    expect(files.length).toBeGreaterThan(20);
  });

  it.each(files.map((f) => [f.replace(SRC_DIR, 'src'), f] as const))(
    '%s has none of Date.now / Math.random / process.* / fetch(',
    (_label, file) => {
      const content = readFileSync(file, 'utf8');
      for (const pattern of FORBIDDEN_PATTERNS) {
        expect(content, `${file} matches ${pattern}`).not.toMatch(pattern);
      }
    },
  );
});
