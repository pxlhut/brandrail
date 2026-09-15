# `<BrandEditor />` — shadcn registry item

This is source, not a compiled component — that's the point. Install it with

```bash
npx shadcn add <registry-url>/r/brand-editor.json
```

and the files under this directory land directly in your project (under
`components/brand-editor/`), copied, not imported from a package. Restyle
them freely; nothing here is a stable API you have to work around.

The one thing that *is* a real npm dependency is `@pxlhut/brand-editor`
itself — every file here is a thin rendering layer over its `useBrandEditor`
hook. Upgrading that package gets you hook fixes without touching your copy
of this UI.

## Prerequisites

- A Next.js (or other React) project with `shadcn` already initialized
  (`npx shadcn init`) — this registry item assumes `@/components/ui/*` and
  `@/lib/utils` already exist the way `shadcn init` creates them.
- `@pxlhut/brand-core` and `@pxlhut/brand-store` on the consuming app, wired
  to real `saveDraft`/`publishTheme` calls (typically behind your own API
  routes — see the main package README for the client/server split).

## Usage

```tsx
import { BrandEditor } from "@/components/brand-editor";

<BrandEditor
  controlConfig={controlConfig}
  initial={brandConfig}
  onSave={(patch) => fetch("/api/brand/draft", { method: "POST", body: JSON.stringify(patch) }).then((r) => r.json())}
  onPublish={() => fetch("/api/brand/publish", { method: "POST" }).then((r) => r.json())}
  onUploadLogo={(file, variant) => uploadToYourStorage(file, variant)}
/>;
```

## What's here

| File | Renders |
|---|---|
| `brand-editor.tsx` | The top-level component: tabs, the publish bar, the live preview pane |
| `field-control.tsx` | Dispatches each §33 field to the right control by tier and shape (§31) |
| `field-row.tsx` | Label, description, dirty dot, field-level error — shared chrome |
| `field-copy.ts` | Owner-facing label/description text per field |
| `preview-pane.tsx` | The scoped live preview (§5) |
| `publish-bar.tsx` | Dirty state, `canPublish`, the conflict banner (§22) |
| `controls/locked-control.tsx` | `locked` — shown and disabled, never hidden |
| `controls/select-control.tsx` | `guided: select` — a segmented control for ≤4 options, a `<Select>` above that |
| `controls/slider-control.tsx` | `guided: slider` |
| `controls/color-control.tsx` | `direct: color` (`brandColor`, and `semanticColors`' four swatches) with live APCA feedback |
| `controls/text-control.tsx` | `direct: text` / `direct: length` / `direct: number` |
| `controls/asset-control.tsx` | `direct: asset` — the logo's `{ light, dark }` pair (§36) |
| `controls/raw-control.tsx` | `raw` — a JSON editor, clearly marked unguarded |

## Why a plain `role="radiogroup"` of buttons instead of shadcn's `ToggleGroup`

shadcn now ships multiple underlying primitive libraries (Base UI, Radix,
React Aria) depending on a project's `components.json`, and `ToggleGroup`'s
value shape isn't identical across them. A `role="radiogroup"` of `Button`s
with roving `tabIndex` and arrow-key navigation has no such split — it
compiles and behaves the same regardless of which base your project uses.
