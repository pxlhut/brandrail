/**
 * Rule 7: previews are never promotable directly. `createPreview` writes to
 * a store separate from `publish()`'s — a preview id must never be usable
 * anywhere a snapshot id is, and a preview must never surface anywhere the
 * active pointer or the published history does.
 */

import { NotFoundError } from '../../contract/index.js';
import { freshSiteId, samplePublishInput } from '../fixtures.js';
import type { SuiteContext } from '../context.js';

export function registerPreviewIsolationSuite(ctx: SuiteContext): void {
  describe(`${ctx.name} — preview isolation (rule 7)`, () => {
    it('never appears in listSnapshots', async () => {
      const store = ctx.getStore();
      const siteId = freshSiteId();
      const input = samplePublishInput('preview-iso-list');

      await store.createPreview(siteId, { ...input, expiresAt: new Date(Date.now() + 60_000) });

      const list = await store.listSnapshots(siteId);
      expect(
        list,
        `[${ctx.name}] rule 7: a preview must never appear in listSnapshots`,
      ).toEqual([]);
    });

    it('does not become the active snapshot merely by existing', async () => {
      const store = ctx.getStore();
      const siteId = freshSiteId();
      const input = samplePublishInput('preview-iso-active');

      await store.createPreview(siteId, { ...input, expiresAt: new Date(Date.now() + 60_000) });

      const active = await store.getActiveSnapshot(siteId);
      expect(
        active,
        `[${ctx.name}] rule 7: creating a preview must not publish anything`,
      ).toBeNull();
    });

    it('a preview id is not a valid snapshot id — rollback rejects it', async () => {
      const store = ctx.getStore();
      const siteId = freshSiteId();

      // A real published snapshot to roll back *to*, and a preview id that
      // must not work as a substitute for one.
      await store.publish(siteId, samplePublishInput('preview-iso-rollback-base'));
      const preview = await store.createPreview(siteId, {
        ...samplePublishInput('preview-iso-rollback-preview'),
        expiresAt: new Date(Date.now() + 60_000),
      });

      await expect(store.rollback(siteId, preview.id)).rejects.toBeInstanceOf(NotFoundError);
    });

    it('publishing after a preview exists is unaffected by it — no shared version counter', async () => {
      const store = ctx.getStore();
      const siteId = freshSiteId();

      await store.createPreview(siteId, {
        ...samplePublishInput('preview-iso-counter'),
        expiresAt: new Date(Date.now() + 60_000),
      });

      const first = await store.publish(siteId, samplePublishInput('preview-iso-counter-publish'));
      expect(
        first.version,
        `[${ctx.name}] rule 7: previews must not consume this site's snapshot version sequence`,
      ).toBe(1);
    });
  });
}
