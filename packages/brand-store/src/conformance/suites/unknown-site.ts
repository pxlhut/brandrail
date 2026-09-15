/**
 * Rule 5: a lookup that legitimately has nothing to find returns `null`,
 * never throws. `getActiveSnapshot`, `getConfig` and `getPreview` all share
 * this — an unknown site (deleted, a typo'd domain, a request that never
 * should have resolved here) is a real, ordinary case, and the caller's job
 * is to render the platform default, not to catch an exception.
 */

import { freshSiteId } from '../fixtures.js';
import type { SuiteContext } from '../context.js';

export function registerUnknownSiteSuite(ctx: SuiteContext): void {
  describe(`${ctx.name} — unknown site (rule 5)`, () => {
    it('getActiveSnapshot returns null for a site that was never published', async () => {
      const store = ctx.getStore();
      const result = await store.getActiveSnapshot(freshSiteId());
      expect(result, `[${ctx.name}] rule 5: must return null, not throw`).toBeNull();
    });

    it('getConfig returns null for a site that was never saved', async () => {
      const store = ctx.getStore();
      const result = await store.getConfig(freshSiteId());
      expect(result, `[${ctx.name}] rule 5: must return null, not throw`).toBeNull();
    });

    it('getPreview returns null for an id that was never created', async () => {
      const store = ctx.getStore();
      const result = await store.getPreview(`no-such-preview-${crypto.randomUUID()}`);
      expect(result, `[${ctx.name}] rule 5: must return null, not throw`).toBeNull();
    });

    it('listSnapshots returns an empty list, not an error, for an unknown site', async () => {
      const store = ctx.getStore();
      const result = await store.listSnapshots(freshSiteId());
      expect(result).toEqual([]);
    });
  });
}
