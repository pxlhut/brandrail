/**
 * The conformance suite (step 11) — guideline §16's argument: since §7–§9's
 * guarantees *are* the entire point of the store, ship them as a runnable
 * suite that takes any `BrandThemeStore` and verifies it end to end, the
 * same role a driver conformance kit plays for a database client library.
 *
 * Strategically, this is what makes `DECISIONS.md` D10 safe: cutting from
 * thirteen packages to four is only defensible because a Prisma or Drizzle
 * adapter becomes a weekend's work for anyone once this exists. This suite
 * is the thing that lets that cut not mean six adapters never get written.
 *
 * One file per contract rule under `suites/`, so a failing adapter points
 * an author at a rule (`rules.md`) rather than at a line number in one
 * large file. Every assertion is on an error *type*, never a message
 * string, and every failure message names the rule it belongs to.
 */

import { registerAtomicitySuite } from './suites/atomicity.js';
import { registerChecksumDedupeSuite } from './suites/checksum-dedupe.js';
import { registerOptimisticConcurrencySuite } from './suites/optimistic-concurrency.js';
import { registerPreviewIsolationSuite } from './suites/preview-isolation.js';
import { registerRollbackSuite } from './suites/rollback.js';
import { registerRoundTripSuite } from './suites/round-trips.js';
import { registerUnknownSiteSuite } from './suites/unknown-site.js';
import { registerVersionMonotonicitySuite } from './suites/version-monotonicity.js';
import type { ConformanceOptions, SuiteContext } from './context.js';

export type { ConformanceOptions } from './context.js';

/**
 * Run every conformance test group against one `BrandThemeStore`.
 *
 * Calls bare `describe`/`it`/`beforeAll`/`beforeEach`/`afterEach` — never
 * imported from 'vitest' or 'jest' here (see `globals.d.ts`) — so an
 * adapter author runs this inside their own Vitest (with `test.globals:
 * true`) or Jest setup, no bespoke runner:
 *
 * ```ts
 * import { runConformanceSuite } from '@pxlhut/brand-store/conformance';
 *
 * runConformanceSuite({
 *   name: 'my-drizzle-adapter',
 *   createStore: () => createDrizzleStore(testDb),
 *   reset: () => truncateAllTables(testDb),
 * });
 * ```
 *
 * `createStore` is called once, in a `beforeAll`; `reset` runs before
 * *every* test, not once per suite (design note: "no hidden state between
 * tests" — an adapter that only passes in declaration order is broken, and
 * this suite runs its own tests in whatever order the host runner chooses).
 */
export function runConformanceSuite(opts: ConformanceOptions): void {
  describe(opts.name, () => {
    let store: Awaited<ReturnType<ConformanceOptions['createStore']>>;

    beforeAll(async () => {
      store = await opts.createStore();
    });

    beforeEach(async () => {
      await opts.reset();
    });

    afterEach(async () => {
      await opts.teardown?.();
    });

    const ctx: SuiteContext = {
      name: opts.name,
      getStore: () => store,
    };

    registerRoundTripSuite(ctx);
    registerVersionMonotonicitySuite(ctx);
    registerChecksumDedupeSuite(ctx);
    registerOptimisticConcurrencySuite(ctx);
    registerRollbackSuite(ctx);
    registerUnknownSiteSuite(ctx);
    registerAtomicitySuite(ctx);
    registerPreviewIsolationSuite(ctx);
  });
}
