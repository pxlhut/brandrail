/**
 * Rule 2: versions are monotonic per site, starting at 1, with no gaps and
 * no duplicates.
 *
 * The *concurrent* half of this rule — no duplicate minted under parallel
 * publishes — lives in `atomicity.ts`, gated on the declared capability
 * (D9): asserting it unconditionally here would fail every adapter honestly
 * declaring `atomicPublish: 'none'`, which is allowed to race.
 */

import { freshSiteId, samplePublishInput } from '../fixtures.js';
import type { SuiteContext } from '../context.js';

export function registerVersionMonotonicitySuite(ctx: SuiteContext): void {
  describe(`${ctx.name} — version monotonicity (rule 2)`, () => {
    it('assigns 1 through 5 with no gaps across five sequential publishes', async () => {
      const store = ctx.getStore();
      const siteId = freshSiteId();

      const versions: number[] = [];
      for (let i = 1; i <= 5; i += 1) {
        // Distinct checksums — rule 3's dedupe must not collapse these.
        const snapshot = await store.publish(siteId, samplePublishInput(`vm-${i}`, `#${i}${i}${i}${i}${i}${i}`));
        versions.push(snapshot.version);
      }

      expect(versions, `[${ctx.name}] rule 2: expected versions 1..5 with no gaps`).toEqual([
        1, 2, 3, 4, 5,
      ]);
    });

    it('starts a new site at version 1, never at 0 or an arbitrary value', async () => {
      const store = ctx.getStore();
      const siteId = freshSiteId();

      const first = await store.publish(siteId, samplePublishInput('vm-first'));
      expect(first.version, `[${ctx.name}] rule 2: first publish must be version 1`).toBe(1);
    });

    it('numbers versions independently per site', async () => {
      const store = ctx.getStore();
      const siteA = freshSiteId();
      const siteB = freshSiteId();

      await store.publish(siteA, samplePublishInput('vm-a1'));
      await store.publish(siteA, samplePublishInput('vm-a2', '#abcabc'));
      const bFirst = await store.publish(siteB, samplePublishInput('vm-b1', '#bcdbcd'));

      expect(
        bFirst.version,
        `[${ctx.name}] rule 2: a second site's version numbering must not be affected by another site's history`,
      ).toBe(1);
    });
  });
}
