/**
 * Test-only fixture. Not part of the public surface — never imported from
 * `index.ts`, so it never reaches the built bundle.
 *
 * A hand-built `TokenTree` rather than a real `generateTheme()` call, for the
 * same reason `theme/merge.test.ts` hand-builds one: `layer('output', [...])`
 * in `.dependency-cruiser.cjs` doesn't let this feature import `theme`.
 * Values are real `toCss(finalize(...))` output, copied from an actual run,
 * so the byte-size acceptance check measures realistic bytes rather than
 * placeholders.
 */

import type { TokenTree } from '../../shared/types/index.js';

const LIGHT: Record<string, string> = {
  background: 'oklch(0.99 0.0009 106.42)',
  foreground: 'oklch(0.2373 0.0231 284.44)',
  card: 'oklch(0.99 0.0009 106.42)',
  'card-foreground': 'oklch(0.2373 0.0231 284.44)',
  popover: 'oklch(0.99 0.0009 106.42)',
  'popover-foreground': 'oklch(0.2373 0.0231 284.44)',
  primary: 'oklch(0.52 0.2192 282.9)',
  'primary-foreground': 'oklch(0.99 0.0009 106.42)',
  secondary: 'oklch(0.9456 0.0092 286.15)',
  'secondary-foreground': 'oklch(0.2373 0.0231 284.44)',
  muted: 'oklch(0.9456 0.0092 286.15)',
  'muted-foreground': 'oklch(0.4661 0.0249 282.9)',
  accent: 'oklch(0.9143 0.0257 285.02)',
  'accent-foreground': 'oklch(0.2373 0.0231 284.44)',
  destructive: 'oklch(0.5523 0.2152 27.32)',
  'destructive-foreground': 'oklch(0.99 0.0009 106.42)',
  success: 'oklch(0.5231 0.1653 148.44)',
  'success-foreground': 'oklch(0.99 0.0009 106.42)',
  warning: 'oklch(0.6842 0.1673 60.63)',
  'warning-foreground': 'oklch(0.2373 0.0231 284.44)',
  info: 'oklch(0.5231 0.1832 260.03)',
  'info-foreground': 'oklch(0.99 0.0009 106.42)',
  border: 'oklch(0.871 0.0146 285.6)',
  input: 'oklch(0.871 0.0146 285.6)',
  ring: 'oklch(0.52 0.2192 282.9)',
  sidebar: 'oklch(0.9714 0.0046 286.15)',
  'sidebar-foreground': 'oklch(0.2373 0.0231 284.44)',
  'sidebar-primary': 'oklch(0.52 0.2192 282.9)',
  'sidebar-primary-foreground': 'oklch(0.99 0.0009 106.42)',
  'sidebar-accent': 'oklch(0.9143 0.0257 285.02)',
  'sidebar-accent-foreground': 'oklch(0.2373 0.0231 284.44)',
  'sidebar-border': 'oklch(0.871 0.0146 285.6)',
  'sidebar-ring': 'oklch(0.52 0.2192 282.9)',
};

const DARK: Record<string, string> = {
  background: 'oklch(0.2035 0.0212 284.44)',
  foreground: 'oklch(0.9714 0.0046 286.15)',
  card: 'oklch(0.2373 0.0231 284.44)',
  'card-foreground': 'oklch(0.9714 0.0046 286.15)',
  popover: 'oklch(0.2373 0.0231 284.44)',
  'popover-foreground': 'oklch(0.9714 0.0046 286.15)',
  primary: 'oklch(0.7237 0.1652 282.9)',
  'primary-foreground': 'oklch(0.2035 0.0212 284.44)',
  secondary: 'oklch(0.331 0.0264 284.44)',
  'secondary-foreground': 'oklch(0.9714 0.0046 286.15)',
  muted: 'oklch(0.331 0.0264 284.44)',
  'muted-foreground': 'oklch(0.7143 0.0192 282.9)',
  accent: 'oklch(0.3937 0.0292 284.44)',
  'accent-foreground': 'oklch(0.9714 0.0046 286.15)',
  destructive: 'oklch(0.6961 0.1873 27.32)',
  'destructive-foreground': 'oklch(0.2035 0.0212 284.44)',
  success: 'oklch(0.7154 0.1601 148.44)',
  'success-foreground': 'oklch(0.2035 0.0212 284.44)',
  warning: 'oklch(0.7842 0.1573 60.63)',
  'warning-foreground': 'oklch(0.2035 0.0212 284.44)',
  info: 'oklch(0.7231 0.1552 260.03)',
  'info-foreground': 'oklch(0.2035 0.0212 284.44)',
  border: 'oklch(0.3937 0.0292 284.44)',
  input: 'oklch(0.3937 0.0292 284.44)',
  ring: 'oklch(0.7237 0.1652 282.9)',
  sidebar: 'oklch(0.2373 0.0231 284.44)',
  'sidebar-foreground': 'oklch(0.9714 0.0046 286.15)',
  'sidebar-primary': 'oklch(0.7237 0.1652 282.9)',
  'sidebar-primary-foreground': 'oklch(0.2035 0.0212 284.44)',
  'sidebar-accent': 'oklch(0.3937 0.0292 284.44)',
  'sidebar-accent-foreground': 'oklch(0.9714 0.0046 286.15)',
  'sidebar-border': 'oklch(0.3937 0.0292 284.44)',
  'sidebar-ring': 'oklch(0.7237 0.1652 282.9)',
};

const CHART_LIGHT: Record<string, string> = {
  'chart-1': 'oklch(0.62 0.22 282.9)',
  'chart-2': 'oklch(0.62 0.22 42.9)',
  'chart-3': 'oklch(0.62 0.22 162.9)',
  'chart-4': 'oklch(0.62 0.22 222.9)',
  'chart-5': 'oklch(0.62 0.22 342.9)',
};

const CHART_DARK: Record<string, string> = {
  'chart-1': 'oklch(0.72 0.19 282.9)',
  'chart-2': 'oklch(0.72 0.19 42.9)',
  'chart-3': 'oklch(0.72 0.19 162.9)',
  'chart-4': 'oklch(0.72 0.19 222.9)',
  'chart-5': 'oklch(0.72 0.19 342.9)',
};

function pairs(light: Record<string, string>, dark: Record<string, string>): Record<string, { light: string; dark: string }> {
  const out: Record<string, { light: string; dark: string }> = {};
  for (const key of Object.keys(light)) {
    out[key] = { light: light[key] as string, dark: dark[key] as string };
  }
  return out;
}

export function fullTree(): TokenTree {
  return {
    color: pairs(LIGHT, DARK) as unknown as TokenTree['color'],
    chart: pairs(CHART_LIGHT, CHART_DARK) as unknown as TokenTree['chart'],
    shape: {
      radius: '0.5rem',
      borderWidth: '1px',
      densityScale: '1',
      shadowStrength: '0.096',
    },
    typography: {
      headingFont: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      bodyFont: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    },
    meta: { sourceBrandColor: 'oklch(0.52 0.2192 282.9)', schemaVersion: 1 },
  };
}
