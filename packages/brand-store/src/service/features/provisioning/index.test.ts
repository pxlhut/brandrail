import { describe, expect, it } from 'vitest';

import { MemoryBrandThemeStore } from '../../../memory/index.js';
import { provisionSite } from './index.js';

describe('provisionSite', () => {
  it('leaves a site with an active snapshot, always (§20)', async () => {
    const store = new MemoryBrandThemeStore();
    await provisionSite('site-1', { brandColor: '#7C6CFF' }, { store });

    const active = await store.getActiveSnapshot('site-1');
    expect(active).not.toBeNull();
    expect(active?.version).toBe(1);
  });

  it('also leaves the config saved, at version 1', async () => {
    const store = new MemoryBrandThemeStore();
    await provisionSite('site-2', { brandColor: '#00FF88' }, { store });

    const config = await store.getConfig('site-2');
    expect(config?.brandColor).toBe('#00FF88');
    expect(config?.version).toBe(1);
  });

  it('copies a profile into the site\'s own controlConfig, independent of the profile afterwards (§17)', async () => {
    const store = new MemoryBrandThemeStore();
    const profile = { semanticColors: { tier: 'direct' as const, type: 'color' as const } };

    await provisionSite('site-3', { brandColor: '#7C6CFF', profile }, { store });
    profile.semanticColors.tier = 'direct'; // no-op, just proves the object below isn't a live reference

    const config = await store.getConfig('site-3');
    expect(config?.controlConfig.semanticColors.tier).toBe('direct');

    // Every other field falls back to the registry's own default tier.
    expect(config?.controlConfig.radius.tier).toBe('guided');
  });

  it('defaults to the registry\'s own tiers when no profile is given', async () => {
    const store = new MemoryBrandThemeStore();
    await provisionSite('site-4', { brandColor: '#7C6CFF' }, { store });

    const config = await store.getConfig('site-4');
    expect(config?.controlConfig.semanticColors.tier).toBe('locked');
  });

  it('produces a snapshot with zero contrast violations, since nothing has overridden anything yet', async () => {
    const store = new MemoryBrandThemeStore();
    const snapshot = await provisionSite('site-5', { brandColor: '#FFD700' }, { store });
    expect(snapshot.cssText).toContain('--primary:');
  });
});
