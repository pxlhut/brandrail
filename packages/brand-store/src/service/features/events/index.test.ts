import { describe, expect, it } from 'vitest';

import { noopInvalidationEmitter } from './index.js';

describe('noopInvalidationEmitter', () => {
  it('does nothing, successfully — the default so the service works standalone', () => {
    expect(() =>
      noopInvalidationEmitter({ siteId: 's', snapshotId: 'sn', checksum: 'c' }),
    ).not.toThrow();
  });
});
