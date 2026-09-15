import type { BrandConfig, Preview, Snapshot } from '@pxlhut/brand-core';
import { describe, expect, it } from 'vitest';

import type { StoreCapabilities } from './capabilities.js';
import { NotSupportedError } from './errors.js';
import { BaseBrandThemeStore } from './index.js';

/**
 * The bare-minimum shape check: does a class extending `BaseBrandThemeStore`
 * compile once every abstract member is implemented? Not a real adapter —
 * that's step 12/14's job — just proof the contract as drafted is
 * implementable, not merely typeable.
 */
class StubStore extends BaseBrandThemeStore {
  readonly capabilities: StoreCapabilities = { atomicPublish: 'none' };

  async getConfig(): Promise<BrandConfig | null> {
    return null;
  }

  async saveConfig(): Promise<BrandConfig> {
    return this.unsupported('saveConfig');
  }

  async publish(): Promise<Snapshot> {
    return this.unsupported('publish');
  }

  async getActiveSnapshot(): Promise<Snapshot | null> {
    return null;
  }

  async listSnapshots(): Promise<Snapshot[]> {
    return [];
  }

  async rollback(): Promise<void> {
    // no-op stub
  }

  async getPreview(): Promise<Preview | null> {
    return null;
  }

  /** Exposes the protected helper so the test below can call it directly. */
  callUnsupported(feature: string): never {
    return this.unsupported(feature);
  }

  async createPreview(): Promise<Preview> {
    return this.unsupported('createPreview');
  }
}

describe('BaseBrandThemeStore', () => {
  it('can be extended with every abstract member implemented', () => {
    const store = new StubStore();
    expect(store.capabilities.atomicPublish).toBe('none');
  });

  it('has a protected `unsupported` helper that throws NotSupportedError, naming the feature and the class', () => {
    const store = new StubStore();
    expect(() => store.callUnsupported('exampleFeature')).toThrow(NotSupportedError);
    expect(() => store.callUnsupported('exampleFeature')).toThrow(/StubStore/);
    expect(() => store.callUnsupported('exampleFeature')).toThrow(/exampleFeature/);
  });
});

describe('type-level constraints', () => {
  it('requires `atomicPublish` — StoreCapabilities has no optional fields (D9)', () => {
    // @ts-expect-error atomicPublish is required
    const missing: StoreCapabilities = {};

    // Positive controls: every declared level compiles.
    const ok1: StoreCapabilities = { atomicPublish: 'transactional' };
    const ok2: StoreCapabilities = { atomicPublish: 'serialized' };
    const ok3: StoreCapabilities = { atomicPublish: 'none' };

    expect([missing, ok1, ok2, ok3]).toHaveLength(4);
  });
});
