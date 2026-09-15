# @pxlhut/brand-editor

Headless React state for a brand settings screen that reshapes itself from
the platform's control config — plus a shadcn-registry `<BrandEditor />`
UI built on top of it.

Part of [Brandrail](https://github.com/pxlhut/brandrail) — multi-tenant
brand theming with a per-field control-tier model the platform vendor
owns. See the [main README](https://github.com/pxlhut/brandrail#readme)
for the full pitch and the other three packages.

```bash
npm install @pxlhut/brand-editor
```

## The hook

```ts
import { useBrandEditor } from "@pxlhut/brand-editor";

const state = useBrandEditor({
  controlConfig, // per-field tiers — see the tier-model doc below
  initial, // the site's current BrandConfig
  onSave: (patch) => fetch("/api/brand/draft", { method: "POST", body: JSON.stringify(patch) }).then((r) => r.json()),
  onPublish: () => fetch("/api/brand/publish", { method: "POST" }).then((r) => r.json()),
});

// state.fields[id]        — per-field value, error, dirty, disabled, tier-aware
// state.preview           — live tokens + serialized CSS, no server round-trip
// state.canPublish        — false while any contrast violation is outstanding
```

No markup, no styling — React-only for v0.1 (the logic ports to Vue/Svelte
cheaply, but no port exists yet). See
[tier-model.md](https://github.com/pxlhut/brandrail/blob/main/docs/tier-model.md)
for what `controlConfig` actually means.

## The UI — distributed via the shadcn registry, not npm

`<BrandEditor />` is **not** exported from this package's JS entry point.
shadcn/ui components are meant to be copied into your project and
restyled, not imported from a compiled library — so the component ships
as a registry item instead:

```bash
npx shadcn add https://raw.githubusercontent.com/pxlhut/brandrail/main/packages/brand-editor/public/r/brand-editor.json
```

This copies real, editable source into `components/brand-editor/` in your
project. It imports `useBrandEditor` from this package as a normal
dependency — restyling the UI never means forking the logic — and installs
its shadcn primitive dependencies (`button`, `input`, `select`, `slider`,
`tabs`, `textarea`, `badge`, `alert`, `label`) via the same command.

See [`registry/brand-editor/README.md`](./registry/brand-editor/README.md)
for the full per-file breakdown of what gets installed.
