/**
 * Rule 4: `saveConfig` with a stale `expectedVersion` throws `ConflictError`
 * and writes nothing. The second half of that sentence matters more than
 * the first — an adapter that throws correctly but still writes the patch
 * underneath the error has a worse bug than one that doesn't throw at all.
 */

import { ConflictError } from '../../contract/index.js';
import { freshSiteId, sampleConfigPatch } from '../fixtures.js';
import type { SuiteContext } from '../context.js';

export function registerOptimisticConcurrencySuite(ctx: SuiteContext): void {
  describe(`${ctx.name} — optimistic concurrency (rule 4)`, () => {
    it('succeeds when expectedVersion matches the current version', async () => {
      const store = ctx.getStore();
      const siteId = freshSiteId();

      await store.saveConfig(siteId, sampleConfigPatch('#111111'), 0);
      const saved = await store.saveConfig(siteId, sampleConfigPatch('#222222'), 1);

      expect(saved.brandColor).toBe('#222222');
      expect(saved.version, `[${ctx.name}] rule 2: saveConfig also versions monotonically`).toBe(2);
    });

    it('throws ConflictError, and writes nothing, for a stale expectedVersion', async () => {
      const store = ctx.getStore();
      const siteId = freshSiteId();

      await store.saveConfig(siteId, sampleConfigPatch('#111111'), 0);
      await store.saveConfig(siteId, sampleConfigPatch('#222222'), 1); // now at version 2

      // The version this site was last seen at, per this test — now stale.
      await expect(
        store.saveConfig(siteId, sampleConfigPatch('#333333'), 1),
      ).rejects.toBeInstanceOf(ConflictError);

      const current = await store.getConfig(siteId);
      expect(
        current?.brandColor,
        `[${ctx.name}] rule 4: a rejected save must not have written its patch`,
      ).toBe('#222222');
      expect(current?.version).toBe(2);
    });

    it('rejects expectedVersion: 0 when a config already exists — 0 only means "does not exist yet"', async () => {
      const store = ctx.getStore();
      const siteId = freshSiteId();

      await store.saveConfig(siteId, sampleConfigPatch('#111111'), 0);

      await expect(
        store.saveConfig(siteId, sampleConfigPatch('#999999'), 0),
      ).rejects.toBeInstanceOf(ConflictError);

      const current = await store.getConfig(siteId);
      expect(current?.brandColor).toBe('#111111');
    });

    it('creates a site\'s first config with expectedVersion: 0, at version 1', async () => {
      const store = ctx.getStore();
      const siteId = freshSiteId();

      const created = await store.saveConfig(siteId, sampleConfigPatch('#7C6CFF'), 0);
      expect(created.version, `[${ctx.name}] rule 4: creation is expectedVersion 0 → version 1`).toBe(1);
    });
  });
}
