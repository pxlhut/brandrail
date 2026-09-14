import { describe, expect, it } from 'vitest';

import { CHART_ROLE_ORDER, COLOR_ROLE_ORDER, EXTRA_COLOR_ROLES, SHADCN_PINNED_VARS } from './roles.js';

/**
 * Transcribed independently from the live `:root`/`.dark` blocks in
 * ui.shadcn.com's manual-installation guide (fetched 2026-09-14) — not
 * derived from `roles.ts` itself. If this ever needs to change, it's because
 * shadcn's own variable set changed, which is exactly what this test exists
 * to catch (step 08: "when shadcn adds one, this is how you find out").
 */
const SHADCN_LIVE_DOCS_VARS = [
  '--background',
  '--foreground',
  '--card',
  '--card-foreground',
  '--popover',
  '--popover-foreground',
  '--primary',
  '--primary-foreground',
  '--secondary',
  '--secondary-foreground',
  '--muted',
  '--muted-foreground',
  '--accent',
  '--accent-foreground',
  '--destructive',
  '--destructive-foreground',
  '--border',
  '--input',
  '--ring',
  '--chart-1',
  '--chart-2',
  '--chart-3',
  '--chart-4',
  '--chart-5',
  '--sidebar',
  '--sidebar-foreground',
  '--sidebar-primary',
  '--sidebar-primary-foreground',
  '--sidebar-accent',
  '--sidebar-accent-foreground',
  '--sidebar-border',
  '--sidebar-ring',
  '--radius',
];

describe('SHADCN_PINNED_VARS', () => {
  it('matches shadcn/ui\'s own variable set exactly, order aside', () => {
    expect([...SHADCN_PINNED_VARS].sort()).toEqual([...SHADCN_LIVE_DOCS_VARS].sort());
  });

  it('excludes the non-shadcn extra roles (§34)', () => {
    for (const extra of EXTRA_COLOR_ROLES) {
      expect(SHADCN_PINNED_VARS).not.toContain(`--${extra}`);
    }
  });
});

describe('COLOR_ROLE_ORDER', () => {
  it('has no duplicates', () => {
    expect(new Set(COLOR_ROLE_ORDER).size).toBe(COLOR_ROLE_ORDER.length);
  });

  it('includes every extra role', () => {
    for (const extra of EXTRA_COLOR_ROLES) expect(COLOR_ROLE_ORDER).toContain(extra);
  });
});

describe('CHART_ROLE_ORDER', () => {
  it('is chart-1 through chart-5, in order', () => {
    expect(CHART_ROLE_ORDER).toEqual(['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5']);
  });
});
