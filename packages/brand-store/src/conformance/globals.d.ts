/**
 * The conformance suite calls `describe`/`it`/`expect`/`beforeEach`/
 * `beforeAll`/`afterEach` as bare globals — never imported from 'vitest' or
 * 'jest' anywhere in this file tree. That's what lets `runConformanceSuite`
 * run inside an adapter author's own Vitest *or* Jest setup with no bespoke
 * runner (step 11): both frameworks provide these as true globals (Jest
 * always; Vitest when the host's config sets `test.globals: true`, which
 * `packages/brand-store/vitest.config.ts` does for this package's own use
 * of the suite against its fixtures).
 *
 * Declared here rather than pulled in via `@types/jest` or `vitest/globals`
 * so the suite doesn't take a *type* dependency on one specific framework's
 * shape either — this is the minimal, common surface both actually provide.
 * `expect`'s return is intentionally untyped: modelling every matcher two
 * frameworks both happen to support is not this file's job, and the real
 * type safety that matters here is on `BrandThemeStore`, not on assertions.
 */

declare global {
  // `var`, not `function` — this package's own meta-tests (`index.test.ts`,
  // via `test-support/sandbox.ts`) temporarily *reassign* `describe`/`it`/
  // the hooks to a fake in-process collector, to prove the suite fails a
  // deliberately broken adapter without leaving a permanently-red test in
  // this package's own `pnpm test` run. A `function` declaration doesn't
  // typecheck as reassignable the same unambiguous way.
  var describe: (name: string, fn: () => void) => void;
  var it: (name: string, fn: () => void | Promise<void>) => void;
  var beforeAll: (fn: () => void | Promise<void>) => void;
  var beforeEach: (fn: () => void | Promise<void>) => void;
  var afterEach: (fn: () => void | Promise<void>) => void;
  // Second param: both Vitest and Jest's `expect` accept an optional custom
  // failure message as the second argument (Vitest natively; Jest via
  // `jest-expect-message` — common enough in Jest setups that it's worth
  // this ambient type allowing it rather than rejecting the call outright).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  var expect: (actual: unknown, message?: string) => any;
}

export {};
