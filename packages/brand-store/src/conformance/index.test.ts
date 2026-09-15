/**
 * Tests the conformance suite *itself* — not a store adapter. Runs it, via
 * `test-support/sandbox.ts`, against:
 *
 * - a correct fixture store, asserting the suite passes entirely and in a
 *   shuffled order (design notes: "no hidden state between tests", "passes
 *   in a randomised order");
 * - a fixture that claims `atomicPublish: 'transactional'` but does not
 *   actually serialize `publish()` — proving the suite's over-claim check
 *   (D9) genuinely fails an adapter that claims more than it delivers,
 *   which is step 11's most important acceptance criterion.
 */

import { describe, expect, it } from 'vitest';

import { FixtureStore } from './fixture-store.js';
import { runConformanceSuite } from './index.js';
import { runInSandbox } from './test-support/sandbox.js';

function register(store: FixtureStore) {
  runConformanceSuite({
    name: 'fixture-store',
    createStore: () => Promise.resolve(store),
    reset: () => {
      store.clear();
      return Promise.resolve();
    },
  });
}

describe('runConformanceSuite — against a correct adapter', () => {
  it('passes every test, with no failures', async () => {
    const result = await runInSandbox(() => register(new FixtureStore()));

    expect(
      result.failures,
      `expected zero failures, got: ${result.failures.map((f) => `${f.name}: ${String(f.error)}`).join('; ')}`,
    ).toEqual([]);
    // A real number of tests actually ran — a suite that silently
    // registered nothing would "pass" vacuously otherwise.
    expect(result.total).toBeGreaterThan(15);
  });

  it('passes in a randomised order — no test depends on another having run first', async () => {
    for (const seed of [1, 2, 3]) {
      const result = await runInSandbox(() => register(new FixtureStore()), {
        shuffleSeed: seed,
      });
      expect(
        result.failures,
        `seed ${seed}: ${result.failures.map((f) => f.name).join(', ')}`,
      ).toEqual([]);
    }
  });

  it('calls reset() between every test, not once per suite', async () => {
    let resetCalls = 0;
    const store = new FixtureStore();

    const result = await runInSandbox(() =>
      runConformanceSuite({
        name: 'reset-count-check',
        createStore: () => Promise.resolve(store),
        reset: () => {
          resetCalls += 1;
          store.clear();
          return Promise.resolve();
        },
      }),
    );

    expect(resetCalls).toBe(result.total);
  });
});

describe('runConformanceSuite — against an adapter that over-claims its capability', () => {
  it('fails the atomicity test for a store claiming transactional without serializing publish', async () => {
    const broken = new FixtureStore({
      capabilities: { atomicPublish: 'transactional' },
      serializePublish: false,
    });

    const result = await runInSandbox(() => register(broken));

    const atomicityFailure = result.failures.find((f) => f.name.includes('atomicity'));
    expect(
      atomicityFailure,
      `expected an atomicity failure; failures were: ${result.failures.map((f) => f.name).join(', ')}`,
    ).toBeDefined();
    // Names the rule, per the design notes — not just "assertion 34 failed".
    expect(String(atomicityFailure?.error)).toMatch(/rule 1/);
  });

  it('does not fail the atomicity test for the same store honestly claiming "none"', async () => {
    const honest = new FixtureStore({
      capabilities: { atomicPublish: 'none' },
      serializePublish: false,
    });

    const result = await runInSandbox(() => register(honest));

    const atomicityFailure = result.failures.find((f) => f.name.includes('atomicity'));
    expect(
      atomicityFailure,
      "an honestly-declared 'none' must not be held to a concurrency guarantee it never promised",
    ).toBeUndefined();
  });
});
