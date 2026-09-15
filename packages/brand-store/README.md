# @pxlhut/brand-store

The persistence contract for brand themes: draft, publish, immutable
snapshot, rollback. Zero database dependency — bring your own, against an
~8-method interface and a conformance suite that proves you implemented it
correctly.

Part of [Brandrail](https://github.com/pxlhut/brandrail) — multi-tenant
brand theming with a per-field control-tier model the platform vendor
owns. See the [main README](https://github.com/pxlhut/brandrail#readme)
for the full pitch and the other three packages.

```bash
npm install @pxlhut/brand-store
```

## What's in this package

| Entry point | What |
|---|---|
| `@pxlhut/brand-store` | The `BrandThemeStore` contract, the typed error hierarchy, `StoreCapabilities` |
| `@pxlhut/brand-store/memory` | `MemoryBrandThemeStore` — a full reference adapter, no database, for tests and prototyping |
| `@pxlhut/brand-store/conformance` | `runConformanceSuite` — the shared test suite every adapter (including the one above) is checked against |
| `@pxlhut/brand-store/service` | Where the guideline's rules actually live: tier enforcement, publish, rate limits, the SSR read path helper |

```ts
import { MemoryBrandThemeStore } from "@pxlhut/brand-store/memory";
import { provisionSite, saveDraft, publishTheme } from "@pxlhut/brand-store/service";

const store = new MemoryBrandThemeStore();
const ctx = { store, userId: "owner-1", authorize: async () => "owner" as const };

await provisionSite("site-1", { brandColor: "#7c6cff" }, ctx);
const result = await publishTheme("site-1", ctx);
```

Writing your own adapter (Prisma, Drizzle, Kysely, raw SQL)? See
[writing-an-adapter.md](https://github.com/pxlhut/brandrail/blob/main/docs/writing-an-adapter.md)
— the contract, the seven rules, and how to run the conformance suite
against your own implementation.

`@pxlhut/brand-store-lucid` (AdonisJS/Lucid) is the one real adapter that
ships today.
