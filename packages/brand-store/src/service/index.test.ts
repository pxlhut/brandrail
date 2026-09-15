/**
 * Guideline §15: the moment the service layer imports Express, Fastify,
 * Adonis or NestJS request/response or DI types, it stops being
 * backend-agnostic. Checked against the *built* output (`pnpm build` first)
 * rather than the source — a framework import hiding behind a type-only
 * import or a dev-only branch would still show up here, since this is what
 * actually ships.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST_ENTRIES = ['../../dist/service.js', '../../dist/service.cjs'].map((p) => join(HERE, p));

const FRAMEWORK_NAMES = ['express', 'fastify', '@adonisjs', 'nestjs', '@nestjs'];

describe('service layer — zero framework imports (§15)', () => {
  it('the built bundle exists (run `pnpm build` first)', () => {
    expect(DIST_ENTRIES.some((p) => existsSync(p))).toBe(true);
  });

  it.each(DIST_ENTRIES)('%s names no backend framework', (path) => {
    if (!existsSync(path)) return; // one of esm/cjs, whichever tsup produced for this run
    const content = readFileSync(path, 'utf8');
    for (const name of FRAMEWORK_NAMES) {
      expect(content.toLowerCase(), `${path} references "${name}"`).not.toContain(name);
    }
  });
});
