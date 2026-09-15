/**
 * Rule 3: an incoming checksum equal to the currently-active snapshot's is
 * a no-op — return the existing snapshot successfully, write nothing.
 *
 * Publishing the same theme twice is a normal action (re-saving without
 * changes, a retried request), not an edge case: it must not burn a version
 * number or create a second, byte-identical row.
 */

import { freshSiteId, samplePublishInput } from '../fixtures.js';
import type { SuiteContext } from '../context.js';

export function registerChecksumDedupeSuite(ctx: SuiteContext): void {
  describe(`${ctx.name} — checksum dedupe (rule 3)`, () => {
    it('returns the existing snapshot, unchanged, for a repeated identical checksum', async () => {
      const store = ctx.getStore();
      const siteId = freshSiteId();
      const input = samplePublishInput('dedupe');

      const first = await store.publish(siteId, input);
      const second = await store.publish(siteId, input);

      expect(
        second.id,
        `[${ctx.name}] rule 3: an identical checksum must return the existing snapshot, not create one`,
      ).toBe(first.id);
      expect(second.version, `[${ctx.name}] rule 3: a dedupe no-op must not mint a new version`).toBe(
        first.version,
      );
    });

    it('does not add a row: listSnapshots still shows exactly one entry', async () => {
      const store = ctx.getStore();
      const siteId = freshSiteId();
      const input = samplePublishInput('dedupe-list');

      await store.publish(siteId, input);
      await store.publish(siteId, input);
      await store.publish(siteId, input);

      const list = await store.listSnapshots(siteId);
      expect(
        list.length,
        `[${ctx.name}] rule 3: three publishes with the same checksum must leave exactly one snapshot`,
      ).toBe(1);
    });

    it('does mint a new version when the checksum genuinely changes', async () => {
      const store = ctx.getStore();
      const siteId = freshSiteId();

      const first = await store.publish(siteId, samplePublishInput('dedupe-change-1'));
      const second = await store.publish(siteId, samplePublishInput('dedupe-change-2', '#654321'));

      expect(
        second.version,
        `[${ctx.name}] rule 3 only applies to an *identical* checksum — a genuine change must still version`,
      ).toBe(first.version + 1);
    });
  });
}
