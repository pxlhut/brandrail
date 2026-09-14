# Step 03 — Core: types and the field registry

| | |
|---|---|
| **Depends on** | 02 |
| **Unlocks** | 04, 07, 10 |
| **Output** | `brand-core/src/shared/types/`, `brand-core/src/shared/fields/` |
| **Size** | half a day |

## Why this step exists

Every other package imports this vocabulary. The store contract carries a
`TokenTree`; the service layer enforces a `ControlConfig`; the editor
renders from the field registry. Getting the shapes right once is much
cheaper than reconciling four packages' guesses later.

This is also where guideline §33's thirteen-field reference schema stops
being a table in a document and becomes data the code can iterate.

## Prerequisites

- `DECISIONS.md` D1 (`site_id`), D6 (dark is derived)
- Guideline §25 (token shape), §31 (guided control shapes), §32 (shape
  tokens), §33 (the field list), §17 (control profiles)

## Build

### `shared/types/` — the token tree

Guideline §25 establishes that a token value is either one string or a
light/dark pair, and §32 establishes that the tree has a `color` branch
and a `shape` branch. D6 says dark is always derived, so in practice
every colour token is a pair — but keep the union, because shape tokens
(radius, border width) genuinely are single values.

```ts
export type TokenValue = string | { light: string; dark: string };

export type ColorRole =
  | 'background' | 'foreground'
  | 'card' | 'card-foreground'
  | 'popover' | 'popover-foreground'
  | 'primary' | 'primary-foreground'
  | 'secondary' | 'secondary-foreground'
  | 'muted' | 'muted-foreground'
  | 'accent' | 'accent-foreground'
  | 'destructive' | 'destructive-foreground'
  | 'success' | 'success-foreground'
  | 'warning' | 'warning-foreground'
  | 'info' | 'info-foreground'
  | 'border' | 'input' | 'ring'
  // shadcn ships a sidebar block; a theme that omits it renders the
  // sidebar component unstyled. See D11.
  | 'sidebar' | 'sidebar-foreground'
  | 'sidebar-primary' | 'sidebar-primary-foreground'
  | 'sidebar-accent' | 'sidebar-accent-foreground'
  | 'sidebar-border' | 'sidebar-ring';

export interface TokenTree {
  color: Record<ColorRole, TokenValue>;
  shape: {
    radius: TokenValue;
    borderWidth: TokenValue;
    /** Spacing multiplier from the `density` field. 1 = comfortable. */
    densityScale: TokenValue;
  };
  typography: {
    headingFont: TokenValue;
    bodyFont: TokenValue;
  };
  chart: Record<`chart-${1 | 2 | 3 | 4 | 5}`, TokenValue>;
  meta: {
    /** The input this tree was generated from. Debugging and rollback. */
    sourceBrandColor: string;
    schemaVersion: number;
  };
}
```

Two notes on that shape:

- `success` / `warning` / `info` are **not** in shadcn's default variable
  set, but guideline §34 makes them first-class derived tokens. Include
  them; step 08's serializer decides how to emit them.
- `chart-1..5` is in shadcn's set and consumers will notice its absence
  immediately. Generate them in step 05.

### `shared/types/` — the control model

Guideline §31 is explicit that Guided tier needs **two** control shapes,
not one — a continuous slider is wrong for border radius, where three
discrete choices fit better. Model it as a discriminated union so the
editor in step 16 can switch exhaustively.

```ts
export type Tier = 'locked' | 'guided' | 'direct' | 'raw';

export type FieldConfig =
  | { tier: 'locked'; value?: string }
  | { tier: 'guided'; type: 'slider'; min: number; max: number; step?: number }
  | { tier: 'guided'; type: 'select'; options: { label: string; value: string }[] }
  | { tier: 'direct'; type: 'color' | 'text' | 'asset' | 'length';
      variants?: readonly string[] }
  | { tier: 'raw' };

export type ControlConfig = Record<FieldId, FieldConfig>;
```

> The `{ label, value }` option shape matters. `visual-walkthrough.html`
> currently shows a bare string array, which contradicts §31/§32. Step 01
> fixes that document; don't copy from it.

### `shared/fields/` — the reference registry

Guideline §33 is the actual field list. Encode it as data in
`shared/fields/registry.ts` with a default
tier per field, so a `control_profiles` row (§17) is a partial override of
this rather than a from-scratch object.

**Fourteen** fields, across thirteen table rows — `headingFont` and
`bodyFont` share a row in the document: `companyName`, `logo`,
`brandColor`, `semanticColors`, `headingFont`, `bodyFont`, `radius`,
`density`, `neutralTone`, `buttonStyle`, `elevation`, `advancedTokens`,
`supportUrl`, `emailSenderName`.

For each, record: id, default tier, value type, whether it feeds
`generateTheme()` or is carried alongside, and a one-line rationale
lifted from §33.

Three constraints from the guideline that must be expressed as *types*,
not comments:

1. **`semanticColors` defaults to `locked`** (§34). Its hue is fixed to
   convention — an owner repainting "error" away from red breaks a learned
   signal, and that failure is the platform's fault, not theirs.
   Everything *else* about it (lightness curve, chroma, contrast approach)
   derives from the brand colour.
2. **Fonts are `guided: select` at every tier, including raw** (§35). Not
   a default — a constraint. An arbitrary font name fails silently to a
   system fallback, and re-serving fonts on behalf of other businesses is
   real licensing exposure. Type the font fields so `{ tier: 'direct' }`
   and `{ tier: 'raw' }` are not assignable to them.
3. **`logo`, `companyName`, `supportUrl`, `emailSenderName` are not
   tokens** (§36). They never reach `generateTheme()`. Mark them
   `passthrough: true` so step 06 can assert that no passthrough field
   influenced the generated tree.

### Store-facing types

`BrandConfig`, `Snapshot`, `Preview`. Keep them here so `brand-store` can
re-export rather than redefine. Per D1 every id is `siteId`; per D7 the
snapshot carries both `checksum` (token-tree hash, for dedupe) **and**
`cssSha256` (serialised-CSS hash, for the CSP header); per D8 it carries
`sourceConfigVersion`.

## Acceptance

- [ ] `TokenTree`, `TokenValue`, `ColorRole`, `Tier`, `FieldConfig`, `ControlConfig` exported
- [ ] All **14** §33 fields present in `shared/fields/registry.ts` with default tiers matching the guideline table
- [ ] Assigning `{ tier: 'direct' }` to `headingFont` is a **compile error**
- [ ] A `{ tier: 'guided', type: 'select' }` config with a bare `string[]` for options is a compile error
- [ ] `Snapshot` carries `checksum`, `cssSha256`, `sourceConfigVersion`, `schemaVersion`
- [ ] No identifier named `tenantId` anywhere (D1)
- [ ] `pnpm --filter brand-core typecheck` passes with zero `any` in exported types

## Out of scope

No colour maths — step 04. No validation logic — step 07. No runtime
behaviour at all; this step should produce almost no JavaScript after
compilation.

## Notes for step 04

`ColorRole` is the key set the ramp has to fill — **32 roles**, including
the eight sidebar roles added by D11. The contrast floors are D5 plus
D11's four extra rows; read both before starting, not one.

`defaultControlConfig()` and `applyProfile()` deep-clone. §17's guarantee
that a provisioned config is independent of its profile is a *copy*
guarantee, and a shallow assignment silently breaks it.
