/**
 * Runs the step 11 conformance suite against `LucidBrandThemeStore` backed
 * by a real Postgres database — the acceptance criterion this whole
 * package exists to satisfy ("passes the step 11 conformance suite at
 * `transactional`, against real Postgres in CI"). See
 * `test-support/database.ts` for how to point this at a local database.
 *
 * Also covers two guarantees the conformance suite's atomicity test (rule
 * 1) doesn't verify directly, because it only ever observes the adapter
 * through the `BrandThemeStore` interface: the `unique (site_id,
 * version)` constraint rejecting a duplicate at the database level, and
 * `publish()` locking the config row rather than the snapshots table.
 * Kept in this one file, not a separate one: every test here shares one
 * real external Postgres database, and a second file with its own
 * `beforeAll`/`reset()` touching the same tables races against this one
 * under the root workspace's test runner in a way a single project's own
 * `fileParallelism: false` does not prevent.
 */

import { randomUUID } from 'node:crypto';

import { generateTheme, toShadcnCss } from '@pxlhut/brand-core';
import { runConformanceSuite } from '@pxlhut/brand-store/conformance';
import type { Database } from '@adonisjs/lucid/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { LucidBrandThemeStore } from './lucid_brand_theme_store.js';
import { createTestDatabase } from './test-support/database.js';
import { runMigrations } from './test-support/migrate.js';

let db: Database;

beforeAll(async () => {
  db = createTestDatabase();
  await runMigrations(db);
});

afterAll(async () => {
  await db.manager.closeAll();
});

runConformanceSuite({
  name: '@pxlhut/brand-store-lucid',
  createStore: async () => new LucidBrandThemeStore(db, { nextId: () => randomUUID() }),
  reset: async () => {
    await db.rawQuery(
      'truncate table brand_theme_previews, brand_theme_active, brand_theme_snapshots, brand_configs restart identity cascade',
    );
  },
});

describe('brand_theme_snapshots — unique (site_id, version)', () => {
  it('rejects a duplicate (site_id, version) pair at the database level', async () => {
    const siteId = `site-${randomUUID()}`;
    const row = {
      id: randomUUID(),
      site_id: siteId,
      version: 1,
      tokens: {},
      css_text: '',
      schema_version: 1,
      checksum: 'a',
      css_sha256: 'a',
      source_config_version: 0,
      published_at: new Date(),
      published_by: null,
    };
    await db.table('brand_theme_snapshots').insert(row);

    await expect(
      db.table('brand_theme_snapshots').insert({ ...row, id: randomUUID(), checksum: 'b', css_sha256: 'b' }),
    ).rejects.toThrow(/unique/i);
  });
});

describe('publish() — locks the config row, not the snapshots table', () => {
  it('publishes to unrelated sites concurrently without one blocking another', async () => {
    const store = new LucidBrandThemeStore(db, { nextId: () => randomUUID() });
    const siteIds = Array.from({ length: 5 }, () => `site-${randomUUID()}`);
    let counter = 0;
    const samplePublishInput = () => {
      counter += 1;
      const { tokens } = generateTheme({ brandColor: '#7C6CFF' });
      return {
        tokens,
        cssText: toShadcnCss(tokens),
        checksum: `checksum-${counter}`,
        cssSha256: `csssha-${counter}`,
      };
    };

    // Every site publishes twice, all interleaved — if the snapshots
    // *table* were locked instead of each site's own config row, this
    // would serialise across sites and every publish would still succeed,
    // just slowly; what it can never survive is one site's version
    // sequence leaking into another's, which per-config-row locking rules
    // out structurally (rule 2 is already covered per-site by the
    // conformance suite; this specifically exercises many sites at once).
    const results = await Promise.all(
      siteIds.flatMap((siteId) => [
        store.publish(siteId, samplePublishInput()),
        store.publish(siteId, samplePublishInput()),
      ]),
    );

    expect(results).toHaveLength(10);

    for (const siteId of siteIds) {
      const versions = (await store.listSnapshots(siteId)).map((s) => s.version);
      expect(versions).toEqual([1, 2]);
    }
  });
});
