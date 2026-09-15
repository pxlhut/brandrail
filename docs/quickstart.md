# Quickstart

Generate a complete theme from one brand colour, in the browser or on the
server — `@pxlhut/brand-core` has no dependency on either.

```bash
npm install @pxlhut/brand-core
```

```ts
import { generateTheme, toShadcnCss } from "@pxlhut/brand-core";

const result = generateTheme({ brandColor: "#7c6cff" });

// result.tokens        — the full OKLCH token tree, light + dark
// result.violations     — contrast floors a Direct/Raw override failed (empty on the base output)
// result.advisories     — non-fatal notes, e.g. your brand colour reads close to the `info` hue
// result.buttonStyle    — 'solid' | 'outline' — not a token, a variant your components branch on

const css = toShadcnCss(result.tokens, { buttonStyle: result.buttonStyle });
// :root{--background:oklch(...);--primary:oklch(...);...}
// [data-theme="dark"]{--background:oklch(...);...}
```

Drop `css` into a `<style>` tag (or inline it server-side — see
[versioning.md](./versioning.md) for how a published snapshot serves this
without ever calling `generateTheme()` again) and every shadcn/ui component
in your app picks up the new palette. That's the whole core API surface for
the common case.

## Adding persistence

`@pxlhut/brand-core` only generates tokens — it doesn't know what a "site"
is or where a draft lives. `@pxlhut/brand-store` adds that, against **any**
database, via a small adapter interface (see
[writing-an-adapter.md](./writing-an-adapter.md)). The reference in-memory
adapter is enough to try the whole draft → publish → snapshot flow with no
database at all:

```bash
npm install @pxlhut/brand-store
```

```ts
import { MemoryBrandThemeStore } from "@pxlhut/brand-store/memory";
import { provisionSite, saveDraft, publishTheme } from "@pxlhut/brand-store/service";

const store = new MemoryBrandThemeStore();
const ctx = { store, userId: "owner-1", authorize: async () => "owner" as const };

// provisionSite returns the site's first Snapshot; saveDraft's `expectedVersion`
// tracks the draft *config*, so fetch that separately.
await provisionSite("site-1", { brandColor: "#7c6cff" }, ctx);
const config = await store.getConfig("site-1");
await saveDraft("site-1", { companyName: "Acme", expectedVersion: config!.version }, ctx);

const result = await publishTheme("site-1", ctx);
if (result.ok) {
  // result.snapshot.cssText / cssSha256 — ready to inline, see versioning.md
} else {
  // result.violations — reject with field-level errors, never a generic 500
}
```

The one real adapter shipped today is `@pxlhut/brand-store-lucid` (AdonisJS).
Everything else — Prisma, Drizzle, Kysely, your own raw SQL — is the same
handful of methods against `@pxlhut/brand-store`'s conformance suite; see
[writing-an-adapter.md](./writing-an-adapter.md).

## Adding the settings screen

If your platform is React and you want the owner-facing settings screen
rather than building your own against the hook:

```bash
npx shadcn add https://raw.githubusercontent.com/pxlhut/brandrail/main/packages/brand-editor/public/r/brand-editor.json
```

The source lands directly in your project, copied, not imported — restyle
it freely. See `packages/brand-editor/registry/brand-editor/README.md` for
the full per-file breakdown and [tier-model.md](./tier-model.md) for what
`controlConfig` means.
