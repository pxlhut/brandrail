import type { BrandThemeStore } from '../contract/index.js';

/** What `runConformanceSuite` accepts from an adapter author. */
export interface ConformanceOptions {
  /** Named in every `describe` block and every failure message. */
  name: string;
  createStore: () => Promise<BrandThemeStore>;
  /**
   * Clears all state. Runs before *every* test, not once per suite — "No
   * hidden state between tests" is a design requirement, not a suggestion:
   * an adapter that only passes in declaration order is a broken adapter.
   */
  reset: () => Promise<void>;
  /** Runs after every test. Some adapters need real clock movement or connection cleanup. */
  teardown?: () => Promise<void>;
}

/** Passed to each `suites/*.ts` file — the store handle plus the run's own name for failure messages. */
export interface SuiteContext {
  name: string;
  getStore: () => BrandThemeStore;
}
