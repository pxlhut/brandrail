import { describe, expect, it } from 'vitest';

import { noopMetricsEmitter } from './index.js';

describe('noopMetricsEmitter', () => {
  it('does nothing, successfully — the default so publishTheme works with no metrics backend wired up', () => {
    expect(() => noopMetricsEmitter({ name: 'publish_latency_ms', value: 12 })).not.toThrow();
  });
});
