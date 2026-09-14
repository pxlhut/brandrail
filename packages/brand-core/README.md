# @pxlhut/brand-core

One brand colour in, a complete OKLCH/APCA-validated design token tree out.
Pure, browser-safe, framework-agnostic (see `DECISIONS.md` D10).

## Output serializers

`generateTheme()` produces a `TokenTree`. Three functions turn it into CSS,
all reading the *same* published tree — there is no separate generation step
per output target (guideline §37).

### `toShadcnCss`

Emits shadcn/ui's exact current custom-property set (`--background`,
`--card`, `--sidebar-ring`, … — pinned in `features/output/roles.ts` against
the live docs), plus three roles shadcn does not define at all:
`--success`/`--success-foreground`, `--warning`/`--warning-foreground` and
`--info`/`--info-foreground`. Guideline §34 makes these first-class in this
package's own token model; they're emitted alongside the pinned set under
their own names rather than dropped or folded into an existing shadcn role.

Both a light and a dark block are always emitted in one string (D6, §25).
`darkMode` picks how the dark block is scoped:

- `'attribute'` (default) — `:root[data-theme="dark"]`
- `'class'` — `:root.dark`
- `'media'` — `@media (prefers-color-scheme: dark)`, no manual toggle

`selector` (default `':root'`) lets a caller scope the whole thing — the
control panel's live preview needs `[data-site-theme]` instead (guideline
§5), so it doesn't leak onto the dashboard's own chrome.

`fontStrategy` closes guideline §35's loop (self-host a curated set, but a
font that isn't actually loaded fails silently to a system fallback):

- `'none'` (default) — just the `--font-heading`/`--font-body` values.
- `'fontsource'` — adds a comment naming the exact `@fontsource/*` package(s)
  to install. Not a real `@import`: fontsource ships static files meant to be
  pulled in by the consumer's own bundler, not fetched from a URL this
  package would have to invent.
- `'inline-face'` — adds a real `@font-face` per curated family, with a
  `local()` source. This tells the browser to prefer a copy already
  installed on the visitor's system; it does **not** embed font binaries.
  Actually bundling and serving font files needs a font-asset pipeline this
  package doesn't have and isn't in scope for it (D10 — two runtime
  dependencies, no binary assets).

### `toTailwindTheme`

**Tailwind v4 (`version: 4`, the default).** The same raw `:root`/dark value
blocks as `toCssVars`, plus an `@theme inline { --color-<role>: var(--<role>) }`
bridge so Tailwind's own utilities (`bg-primary`, `text-sidebar-foreground`, …)
resolve against whichever block is active.

**Tailwind v3 (`version: 3`), legacy.** A `tailwind.config.js` fragment
mapping every role to a bare `var(--role)` reference — flat keys
(`'sidebar-primary-foreground'`) rather than shadcn's nested
`{ DEFAULT, foreground }` groups; both produce the same utility class names.
This output does not depend on the tree's actual values, deliberately: a
Tailwind v3 config is a build-time file, so the only way one static config
can serve every tenant is for it to defer to whichever CSS custom properties
are inlined at request time, never to bake a value in.

### `toCssVars`

The escape hatch for anyone not on shadcn or Tailwind: raw custom
properties, an optional `prefix`, no assumption about naming beyond that.

## Escaping and hashing

Every value passes through the validator's HTML-escaping (`escapeForHtml`,
`<` and `&`) on the way out — including values the generator produced itself
and that never touched user input. Each serializer's return value is exactly
the byte string that should be hashed for the CSP (`DECISIONS.md` D7) and
inlined into the page; there is no separate re-serialization step.
