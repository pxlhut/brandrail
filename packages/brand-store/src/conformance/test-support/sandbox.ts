/**
 * Test-only. Not exported from `conformance/index.ts`'s public barrel.
 *
 * Runs a `register()` callback — expected to synchronously call
 * `describe`/`it`/`beforeAll`/`beforeEach`/`afterEach`, exactly the way
 * `runConformanceSuite` does — against a temporary, in-process fake
 * collector instead of the real global one, and returns a pass/fail summary
 * instead of reporting to the ambient test framework.
 *
 * This is how this package proves the suite correctly FAILS for a
 * deliberately broken adapter (step 11's acceptance criterion) without a
 * permanently-red test in its own `pnpm test` run: the failure is captured
 * here as data, not surfaced as a real vitest failure. `expect` is
 * deliberately left untouched — the real one, already a global via
 * `vitest.config.ts`'s `test.globals: true`, works the same regardless of
 * who is "running" the test body; only the structural registration
 * functions need faking.
 */

export interface SandboxFailure {
  name: string;
  error: unknown;
}

export interface SandboxResult {
  total: number;
  failures: SandboxFailure[];
}

/** Deterministic shuffle (Fisher–Yates, seeded) — for proving order-independence reproducibly. */
function shuffled<T>(items: readonly T[], seed: number): T[] {
  const out = [...items];
  let state = seed;
  const next = () => {
    // A tiny xorshift PRNG — good enough to permute an array, seeded so a
    // failure is reproducible rather than depending on true randomness.
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0xffffffff;
  };
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

export async function runInSandbox(
  register: () => void,
  opts: { shuffleSeed?: number } = {},
): Promise<SandboxResult> {
  const tests: Array<{ name: string; run: () => void | Promise<void> }> = [];
  const beforeAllHooks: Array<() => void | Promise<void>> = [];
  const beforeEachHooks: Array<() => void | Promise<void>> = [];
  const afterEachHooks: Array<() => void | Promise<void>> = [];
  const nameStack: string[] = [];

  const real = {
    describe: globalThis.describe,
    it: globalThis.it,
    beforeAll: globalThis.beforeAll,
    beforeEach: globalThis.beforeEach,
    afterEach: globalThis.afterEach,
  };

  globalThis.describe = (name, fn) => {
    nameStack.push(name);
    fn();
    nameStack.pop();
  };
  globalThis.it = (name, fn) => {
    tests.push({ name: [...nameStack, name].join(' > '), run: fn });
  };
  globalThis.beforeAll = (fn) => {
    beforeAllHooks.push(fn);
  };
  globalThis.beforeEach = (fn) => {
    beforeEachHooks.push(fn);
  };
  globalThis.afterEach = (fn) => {
    afterEachHooks.push(fn);
  };

  try {
    register();
  } finally {
    // Registration is synchronous and complete before this line — restore
    // immediately, so nothing about *running* the collected tests below
    // depends on the fake versions still being installed.
    globalThis.describe = real.describe;
    globalThis.it = real.it;
    globalThis.beforeAll = real.beforeAll;
    globalThis.beforeEach = real.beforeEach;
    globalThis.afterEach = real.afterEach;
  }

  const failures: SandboxFailure[] = [];
  const order = opts.shuffleSeed !== undefined ? shuffled(tests, opts.shuffleSeed) : tests;

  for (const hook of beforeAllHooks) await hook();

  for (const test of order) {
    try {
      for (const hook of beforeEachHooks) await hook();
      await test.run();
    } catch (error) {
      failures.push({ name: test.name, error });
    } finally {
      for (const hook of afterEachHooks) await hook();
    }
  }

  return { total: tests.length, failures };
}
