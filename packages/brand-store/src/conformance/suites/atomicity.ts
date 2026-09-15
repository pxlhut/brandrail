/**
 * Rule 1, gated on the declared capability (D9). This is the test that
 * makes the declaration meaningful rather than decorative: an adapter can't
 * earn a `'transactional'` (or `'serialized'`) badge by writing the word in
 * a config object — it has to survive genuinely concurrent publishes to the
 * same site without torn state (a duplicate version, a gap, or the active
 * pointer landing anywhere but the highest version written).
 *
 * `'transactional'` and `'serialized'` are held to the *same* outcome here
 * deliberately: both promise "no torn state under concurrent publish", and
 * that's the one thing an external behavioural test can actually observe.
 * The difference between a real database transaction and an app-level lock
 * is a difference in mechanism, not in the guarantee this suite checks.
 *
 * `'none'` gets no concurrency assertion at all — races are the adapter's
 * declared, honest limitation, not a bug — only a much weaker check that
 * ordinary sequential use still works.
 */

import { freshSiteId, samplePublishInput } from '../fixtures.js';
import type { SuiteContext } from '../context.js';

const CONCURRENT_PUBLISHES = 8;

export function registerAtomicitySuite(ctx: SuiteContext): void {
  describe(`${ctx.name} — atomicity (rule 1, D9)`, () => {
    it("honours its declared atomicPublish capability under concurrent publishes — or fails for over-claiming it", async () => {
      const store = ctx.getStore();
      const capability = store.capabilities.atomicPublish;
      const siteId = freshSiteId();

      if (capability === 'none') {
        // Races are allowed and unasserted for 'none' — but sequential use
        // still has to work; 'none' is a licence to race, not to be broken.
        for (let i = 0; i < 3; i += 1) {
          await store.publish(siteId, samplePublishInput(`atomic-none-${i}`));
        }
        const list = await store.listSnapshots(siteId);
        expect(
          list.length,
          `[${ctx.name}] rule 1 (none): ordinary sequential publishes must still work`,
        ).toBe(3);
        return;
      }

      const inputs = Array.from({ length: CONCURRENT_PUBLISHES }, (_, i) =>
        samplePublishInput(`atomic-${i}`),
      );
      const results = await Promise.allSettled(
        inputs.map((input) => store.publish(siteId, input)),
      );

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      expect(
        fulfilled.length,
        `[${ctx.name}] rule 1 (${capability}): every concurrent publish must succeed — only 'none' is allowed to lose one`,
      ).toBe(CONCURRENT_PUBLISHES);

      const versions = fulfilled
        .map((r) => (r as PromiseFulfilledResult<{ version: number }>).value.version)
        .sort((a, b) => a - b);
      const expectedVersions = Array.from({ length: CONCURRENT_PUBLISHES }, (_, i) => i + 1);
      expect(
        versions,
        `[${ctx.name}] rule 1 (${capability}): concurrent publishes must produce exactly ` +
          `{1..${CONCURRENT_PUBLISHES}} — a duplicate or a gap here is torn state, and an adapter ` +
          `that produces one is over-claiming '${capability}'`,
      ).toEqual(expectedVersions);

      const active = await store.getActiveSnapshot(siteId);
      expect(
        active?.version,
        `[${ctx.name}] rule 1 (${capability}): the active pointer must land on the highest version written, never an intermediate one`,
      ).toBe(CONCURRENT_PUBLISHES);
    });
  });
}
