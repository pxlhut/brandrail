# Writing a store adapter

`@pxlhut/brand-store-lucid` is the one real adapter that ships today. This
is what it would take to write the next one — Drizzle, Prisma, Kysely,
raw SQL, whatever you're already on. If you're productive with your ORM,
this is an afternoon, not a project.

## The interface

`BrandThemeStore` (`@pxlhut/brand-store`, `src/contract/index.ts`) is eight
methods plus one property:

```ts
interface BrandThemeStore {
  readonly capabilities: StoreCapabilities;

  getConfig(siteId: string): Promise<BrandConfig | null>;
  saveConfig(siteId: string, patch: ConfigPatch, expectedVersion: number): Promise<BrandConfig>;

  publish(siteId: string, input: PublishInput): Promise<Snapshot>;
  getActiveSnapshot(siteId: string): Promise<Snapshot | null>;
  listSnapshots(siteId: string, opts?: { limit?: number }): Promise<Snapshot[]>;
  rollback(siteId: string, snapshotId: string): Promise<void>;

  createPreview(siteId: string, input: PreviewInput): Promise<Preview>;
  getPreview(previewId: string): Promise<Preview | null>;
}
```

There is no `createSite`/`provisionSite` method. A site's very first
`saveConfig` call — with `expectedVersion: 0`, a sentinel that can never
collide with a real version — is what brings its `BrandConfig` row into
existence. One fewer method to implement, one fewer place for "does this
site exist yet" to be ambiguous.

## The seven rules

`src/contract/rules.md` in `@pxlhut/brand-store` is the actual spec — read
it before writing code. In short, an adapter must guarantee:

1. **`publish` is atomic** at whatever level it honestly declares (see
   capabilities, below) — never a snapshot row with no active pointer, or
   vice versa.
2. **Versions are monotonic per site** — starting at 1, no gaps, no
   duplicates, even under concurrent publishes.
3. **An identical checksum is a no-op** — publishing the same theme twice
   doesn't burn a version or write a duplicate row.
4. **A stale `expectedVersion` throws `ConflictError`, and writes nothing.**
   `fieldValues`/`rawOverrides`/`passthrough` are shallow-merged on a
   partial `saveConfig`, never replaced wholesale.
5. **Unknown-site lookups return `null`, never throw** — `getConfig`,
   `getActiveSnapshot`, `getPreview`. `NotFoundError` is reserved for an
   operation that names something specific that isn't there (a `rollback`
   naming a snapshot id that doesn't exist).
6. **`rollback` only ever flips the active pointer** to an existing
   snapshot — it never regenerates CSS, never mutates the snapshot rows
   themselves.
7. *(See `rules.md` for the seventh — it covers preview expiry.)*

Each rule is at least one test in the conformance suite below. If you
can't figure out how to test a rule you're implementing, that's usually a
sign the rule is ambiguous to you, not that the test is hard — open an
issue.

## Declare what you actually deliver

```ts
interface StoreCapabilities {
  atomicPublish: "transactional" | "serialized" | "none";
}
```

| You declare | The conformance suite runs |
|---|---|
| `'transactional'` | Full concurrency: N parallel publishes to one site, exactly one wins per intent, no torn state. |
| `'serialized'` | Sequential ordering only — but your adapter itself must serialize concurrent publishes to one site (an app-level lock), so they still can't interleave. |
| `'none'` | Only documents the limitation. The suite doesn't run parallel assertions, but fails you if you claim otherwise. |

**The suite fails an adapter that claims more than it delivers.** You
can't earn `'transactional'` by writing the word in a config object — say
what your database actually gives you.

## Run the conformance suite against your adapter

This is the whole value proposition: you don't write your own test suite
for "did I implement this contract correctly," you run the shared one.

```ts
// your-adapter.conformance.test.ts
import { runConformanceSuite } from "@pxlhut/brand-store/conformance";
import { YourAdapter } from "./your-adapter.js";

runConformanceSuite({
  name: "YourAdapter",
  createStore: async () => new YourAdapter(/* your db handle */),
  reset: async () => {
    // Truncate/clear every table this adapter touches. Runs before *every*
    // test, not once per suite — "no hidden state between tests" is a
    // design requirement the suite itself checks for.
  },
  teardown: async () => {
    /* optional: close connections, restore a mocked clock, etc. */
  },
});
```

Green here is the actual acceptance bar — not "it compiles," not "it
passes my own three tests I thought to write."

## Typed errors, not message strings

Throw the same error *classes* every other adapter throws
(`@pxlhut/brand-store`'s `ConflictError`, `NotFoundError`,
`VersionConflictError`, `NotSupportedError`) — never a generic `Error` with
a similar-sounding message. The conformance suite asserts `instanceof`,
and so should your callers: `catch (e) { if (e instanceof ConflictError) … }`
has to work identically regardless of which adapter is behind the
interface, or the contract isn't actually portable.

## Schema notes from the one adapter that exists

`@pxlhut/brand-store-lucid`'s own migrations are a real, working reference
if you're designing SQL tables from scratch. Two things worth knowing
before you copy them:

- `site_id` (and every adapter-generated id column alongside it —
  `snapshot_id`, `updated_by`, `published_by`, `created_by`) is `text`,
  **not** a `uuid` foreign key into a `sites` table. The contract has no
  site-provisioning step, so a real `saveConfig`/`publish` call can be the
  *first* thing that ever references a given `site_id` — a foreign key
  would reject it.
- A first-ever `publish`/`saveConfig` for a site needs its own concurrency
  handling distinct from the "existing row" case: `select ... for update`
  locks nothing when the row doesn't exist yet. The Lucid adapter's fix —
  an `insert ... on conflict (site_id) do nothing` immediately before the
  row lock — is a reusable pattern for any SQL adapter.

## NestJS, Express, Fastify, Koa, Adonis — as documentation, not dependencies

`BrandThemeStore` never imports a web framework's request/response types
or DI container. If you want `BrandThemeStore` as an injectable NestJS
provider, wrap it — `useValue`/`useFactory` around a plain instance — the
same way `@pxlhut/brand-store-lucid`'s optional `./provider` entry point
wraps it for AdonisJS's IoC container without the base package or contract
ever knowing AdonisJS exists. See
[backend-integration.md](./backend-integration.md) for the wiring snippet
per framework.
