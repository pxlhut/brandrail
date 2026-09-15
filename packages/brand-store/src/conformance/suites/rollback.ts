/**
 * Rule 6: `rollback` flips the active pointer only — it never regenerates.
 * The `cssText` a rollback serves must be byte-identical to what was
 * originally published, which is what makes "go back to how it looked
 * last Tuesday" safe even if the generation algorithm has changed since.
 */

import { NotFoundError } from '../../contract/index.js';
import { freshSiteId, samplePublishInput } from '../fixtures.js';
import type { SuiteContext } from '../context.js';

export function registerRollbackSuite(ctx: SuiteContext): void {
  describe(`${ctx.name} — rollback (rule 6)`, () => {
    it('moves the active pointer back and serves the original snapshot byte-identically', async () => {
      const store = ctx.getStore();
      const siteId = freshSiteId();

      const v1 = await store.publish(siteId, samplePublishInput('rb-v1', '#111111'));
      const v2 = await store.publish(siteId, samplePublishInput('rb-v2', '#222222'));

      const activeBeforeRollback = await store.getActiveSnapshot(siteId);
      expect(activeBeforeRollback?.id).toBe(v2.id);

      await store.rollback(siteId, v1.id);

      const active = await store.getActiveSnapshot(siteId);
      expect(active?.id, `[${ctx.name}] rule 6: rollback must move the active pointer`).toBe(v1.id);
      expect(
        active?.cssText,
        `[${ctx.name}] rule 6: rollback must serve the original cssText byte-identically, never regenerate it`,
      ).toBe(v1.cssText);
      expect(active?.version).toBe(v1.version);
    });

    it('leaves both snapshot rows in place — rollback does not delete history', async () => {
      const store = ctx.getStore();
      const siteId = freshSiteId();

      const v1 = await store.publish(siteId, samplePublishInput('rb-hist-1', '#111111'));
      await store.publish(siteId, samplePublishInput('rb-hist-2', '#222222'));
      await store.rollback(siteId, v1.id);

      const list = await store.listSnapshots(siteId);
      expect(list, `[${ctx.name}] rule 6: rollback is a pointer move, not a history edit`).toHaveLength(2);
    });

    it('rolling back to the currently-active snapshot is a no-op that still succeeds', async () => {
      const store = ctx.getStore();
      const siteId = freshSiteId();

      const v1 = await store.publish(siteId, samplePublishInput('rb-noop'));
      await store.rollback(siteId, v1.id);

      const active = await store.getActiveSnapshot(siteId);
      expect(active?.id).toBe(v1.id);
    });

    it('throws NotFoundError for a snapshot id that does not exist', async () => {
      const store = ctx.getStore();
      const siteId = freshSiteId();
      await store.publish(siteId, samplePublishInput('rb-notfound'));

      await expect(store.rollback(siteId, 'no-such-snapshot-id')).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });
  });
}
