import { generateTheme, toShadcnCss } from '@pxlhut/brand-core';
import { describe, expect, it } from 'vitest';

import { runConformanceSuite } from '../conformance/index.js';
import { MemoryBrandThemeStore } from './index.js';

const store = new MemoryBrandThemeStore();

runConformanceSuite({
  name: 'MemoryBrandThemeStore',
  createStore: () => Promise.resolve(store),
  reset: () => {
    store.clear();
    return Promise.resolve();
  },
});

function samplePublishInput(label: string) {
  const { tokens } = generateTheme({ brandColor: '#7C6CFF' });
  return {
    tokens,
    cssText: toShadcnCss(tokens),
    checksum: `checksum-${label}`,
    cssSha256: `csssha-${label}`,
  };
}

describe('MemoryBrandThemeStore — beyond the conformance suite', () => {
  it('declares serialized, not transactional (D9) — a single-threaded store has no transaction to roll back', () => {
    const fresh = new MemoryBrandThemeStore();
    expect(fresh.capabilities.atomicPublish).toBe('serialized');
  });

  it('returns deep clones from getConfig — mutating the result does not corrupt the store', async () => {
    const s = new MemoryBrandThemeStore();
    const siteId = 'clone-config';
    await s.saveConfig(siteId, { brandColor: '#111111' }, 0);

    const read = await s.getConfig(siteId);
    read!.brandColor = '#CORRUPTED';
    read!.rawOverrides.injected = 'yes';

    const readAgain = await s.getConfig(siteId);
    expect(readAgain?.brandColor).toBe('#111111');
    expect(readAgain?.rawOverrides.injected).toBeUndefined();
  });

  it('returns deep clones from publish/getActiveSnapshot/listSnapshots', async () => {
    const s = new MemoryBrandThemeStore();
    const siteId = 'clone-snapshot';
    const published = await s.publish(siteId, samplePublishInput('clone-1'));

    published.cssText = 'MUTATED';
    (published.tokens as { meta: { schemaVersion: number } }).meta.schemaVersion = 999;

    const active = await s.getActiveSnapshot(siteId);
    expect(active?.cssText).not.toBe('MUTATED');
    expect(active?.tokens.meta.schemaVersion).not.toBe(999);

    const [listed] = await s.listSnapshots(siteId);
    listed!.cssText = 'ALSO MUTATED';
    const listedAgain = await s.listSnapshots(siteId);
    expect(listedAgain[0]?.cssText).not.toBe('ALSO MUTATED');
  });

  it('returns deep clones from createPreview/getPreview', async () => {
    const s = new MemoryBrandThemeStore();
    const preview = await s.createPreview('clone-preview', {
      ...samplePublishInput('clone-preview'),
      expiresAt: new Date(Date.now() + 60_000),
    });
    preview.cssText = 'MUTATED';

    const read = await s.getPreview(preview.id);
    expect(read?.cssText).not.toBe('MUTATED');
  });

  it('the clock is injectable — preview expiry is testable without sleeping', async () => {
    let now = new Date('2026-01-01T00:00:00.000Z');
    const s = new MemoryBrandThemeStore({ now: () => now });

    const preview = await s.createPreview('clock-preview', {
      ...samplePublishInput('clock-1'),
      expiresAt: new Date('2026-01-08T00:00:00.000Z'), // 7 days out
    });

    now = new Date('2026-01-07T23:59:59.000Z');
    expect(await s.getPreview(preview.id), 'one second before expiry').not.toBeNull();

    now = new Date('2026-01-08T00:00:01.000Z');
    expect(await s.getPreview(preview.id), 'one second after expiry').toBeNull();
  });

  it('seed() populates state directly, bypassing version and concurrency checks', async () => {
    const s = new MemoryBrandThemeStore();
    const { tokens } = generateTheme({ brandColor: '#ABCDEF' });
    const cssText = toShadcnCss(tokens);

    s.seed({
      snapshots: [
        {
          id: 'seeded-snap-1',
          siteId: 'seeded-site',
          version: 1,
          tokens,
          cssText,
          checksum: 'seed-checksum',
          cssSha256: 'seed-csssha',
          sourceConfigVersion: 1,
          schemaVersion: tokens.meta.schemaVersion,
          publishedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      active: [['seeded-site', 'seeded-snap-1']],
    });

    const active = await s.getActiveSnapshot('seeded-site');
    expect(active?.id).toBe('seeded-snap-1');
  });

  it('dump() returns a deep-cloned snapshot of everything currently stored', async () => {
    const s = new MemoryBrandThemeStore();
    await s.saveConfig('dump-site', { brandColor: '#222222' }, 0);
    await s.publish('dump-site', samplePublishInput('dump-1'));

    const dumped = s.dump();
    expect(dumped.configs).toHaveLength(1);
    expect(dumped.snapshots).toHaveLength(1);

    dumped.configs[0]!.brandColor = 'MUTATED';
    const config = await s.getConfig('dump-site');
    expect(config?.brandColor).not.toBe('MUTATED');
  });
});
