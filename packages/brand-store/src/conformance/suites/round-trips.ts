/**
 * Basic round-trips. Not tied to one contract rule — mechanical checks that
 * catch half of all adapter bugs: does a write actually come back out the
 * way it went in.
 */

import { freshSiteId, samplePublishInput, sampleConfigPatch } from '../fixtures.js';
import type { SuiteContext } from '../context.js';

export function registerRoundTripSuite(ctx: SuiteContext): void {
  describe(`${ctx.name} — basic round-trips`, () => {
    it('saves and reads back a config', async () => {
      const store = ctx.getStore();
      const siteId = freshSiteId();

      const saved = await store.saveConfig(siteId, sampleConfigPatch('#112233'), 0);
      expect(saved.brandColor, `[${ctx.name}] saveConfig did not persist brandColor`).toBe(
        '#112233',
      );

      const read = await store.getConfig(siteId);
      expect(read, `[${ctx.name}] getConfig did not read back the saved config`).not.toBeNull();
      expect(read?.brandColor).toBe('#112233');
      expect(read?.siteId).toBe(siteId);
    });

    it('publishes and reads the active snapshot', async () => {
      const store = ctx.getStore();
      const siteId = freshSiteId();

      const published = await store.publish(siteId, samplePublishInput('rt-1'));
      expect(published.checksum, `[${ctx.name}] publish did not persist checksum`).toBe(
        'checksum-rt-1',
      );
      expect(published.siteId).toBe(siteId);
      expect(published.version, `[${ctx.name}] first publish must be version 1 (rule 2)`).toBe(1);

      const active = await store.getActiveSnapshot(siteId);
      expect(
        active,
        `[${ctx.name}] getActiveSnapshot did not find the snapshot publish() just wrote`,
      ).not.toBeNull();
      expect(active?.id).toBe(published.id);
      expect(active?.cssText).toBe(published.cssText);
    });

    it('lists snapshots in order', async () => {
      const store = ctx.getStore();
      const siteId = freshSiteId();

      await store.publish(siteId, samplePublishInput('rt-a', '#111111'));
      await store.publish(siteId, samplePublishInput('rt-b', '#222222'));
      await store.publish(siteId, samplePublishInput('rt-c', '#333333'));

      const list = await store.listSnapshots(siteId);
      expect(list.map((s) => s.version), `[${ctx.name}] listSnapshots order`).toEqual([1, 2, 3]);
    });

    it('creates and reads back a preview', async () => {
      const store = ctx.getStore();
      const siteId = freshSiteId();
      const input = samplePublishInput('rt-preview');
      const expiresAt = new Date(Date.now() + 60_000);

      const created = await store.createPreview(siteId, { ...input, expiresAt });
      expect(created.siteId).toBe(siteId);
      expect(created.cssText).toBe(input.cssText);

      const read = await store.getPreview(created.id);
      expect(read, `[${ctx.name}] getPreview did not read back the preview createPreview just wrote`).not.toBeNull();
      expect(read?.id).toBe(created.id);
    });
  });
}
