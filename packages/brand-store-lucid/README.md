# @pxlhut/brand-store-lucid

AdonisJS (Lucid ORM) adapter for
[`@pxlhut/brand-store`](https://www.npmjs.com/package/@pxlhut/brand-store)
— the first real database adapter, and the reference implementation for
anyone writing a second one.

Part of [Brandrail](https://github.com/pxlhut/brandrail) — multi-tenant
brand theming with a per-field control-tier model the platform vendor
owns. See the [main README](https://github.com/pxlhut/brandrail#readme)
for the full pitch and the other three packages.

```bash
npm install @pxlhut/brand-store-lucid @pxlhut/brand-store @pxlhut/brand-core
```

## Wire it in

List the provider in `adonisrc.ts`:

```ts
export default defineConfig({
  providers: [
    // ...
    () => import("@pxlhut/brand-store-lucid/provider"),
  ],
});
```

and the container hands you a ready `LucidBrandThemeStore`, bound over
whichever connection Lucid's own `'lucid.db'` singleton resolves to:

```ts
const store = await app.container.make("brand.store");
```

See [backend-integration.md](https://github.com/pxlhut/brandrail/blob/main/docs/backend-integration.md)
for a full controller example, and this package's own migrations
(`src/migrations/`) as a real, working Postgres schema reference if you're
writing a second adapter for a different database.

## Entry points

| Entry point | What |
|---|---|
| `.` | `LucidBrandThemeStore` — the adapter class |
| `./provider` | The AdonisJS service provider (`register()` binds a singleton, aliased as `'brand.store'`) |
| `./models` | Lucid `BaseModel` subclasses, kept as a schema reference — the adapter itself queries the raw client directly, not these |

**Postgres-first.** These migrations target Postgres specifically; see
[writing-an-adapter.md](https://github.com/pxlhut/brandrail/blob/main/docs/writing-an-adapter.md)
for the schema notes worth knowing (`site_id` as `text`, not a `uuid`
foreign key; the insert-then-lock pattern for a site's first publish)
before adapting them to another database.
