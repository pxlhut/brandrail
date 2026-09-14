# Multi-Tenant Theming — Database & Runtime Guideline

Config-driven, not install-based: every tenant's brand lives as rows in your
database, resolved per request. The core idea below is the one decision that
makes 50,000 tenants behave like 5: **separate the write path (a business
owner edits a slider) from the read path (a visitor loads a page).** They
have completely different performance and correctness requirements, so they
should not share the same code path.

> **Vocabulary (D1).** A **site** is the unit that has a theme — one
> domain, one brand. An **account** owns one or more sites, so an agency
> managing ten client brands is one account with ten sites (§38). Every
> identifier in this document and in the code is `site_id`; "tenant"
> survives only as prose and UI copy, where it reads more naturally to a
> business audience. If you see `tenant_id` anywhere, it is stale.
>
> Decisions D1–D10 referenced below are recorded in
> [`../DECISIONS.md`](../DECISIONS.md). They resolve contradictions and
> gaps found while validating this document; where a decision and an
> older passage disagree, the decision wins and the passage is a bug.

---

## 1. Two different "isolation" problems

It's worth naming these separately, because they're solved differently.

**Data isolation** — never let tenant A's config leak into a query answering
for tenant B. This is ordinary multi-tenant hygiene: every table below is
scoped by `site_id`, every query filters on it, no exceptions.

**Visual isolation** — CSS custom properties cascade to *all* descendants.
This only becomes a real bug in one specific place: your own admin dashboard,
where a live theme preview renders next to your product's own chrome. If
both use `--primary`, the tenant's brand color can leak onto your UI. Public-facing
tenant pages don't have this problem (each request renders exactly one
tenant), so don't over-engineer isolation there — solve it only where two
themes exist on screen at once (see §5).

---

## 2. Schema

> `sites(id)` is defined in §38 — one row per themed unit, owned by an
> `accounts` row. §2's tables are read first but depend on it, so skim §38
> if the reference is unfamiliar.

Four tables. `brand_configs` is the mutable draft a business owner is
currently editing; `brand_theme_snapshots` is the immutable, precompiled
result that actually gets served — the same pattern your Forge snapshot
publishing already uses for site content, applied here to themes.

```sql
-- The live, editable draft. One row per site.
create table brand_configs (
  site_id               uuid primary key references sites(id),
  brand_color           text not null,               -- source hex/oklch input
  control_config        jsonb not null default '{}', -- per-field tier: locked/guided/direct/raw
  raw_overrides         jsonb not null default '{}', -- only populated if a field's tier = 'raw'
  schema_version        int  not null,               -- token-generation algorithm version
  version               int  not null default 1,     -- optimistic concurrency, see §22
  updated_at            timestamptz not null default now(),
  updated_by            uuid references users(id)
);

-- Immutable published output. Append-only — never updated, only inserted.
create table brand_theme_snapshots (
  id                    uuid primary key default gen_random_uuid(),
  site_id               uuid not null references sites(id),
  version               int  not null,               -- monotonic per site: 1, 2, 3...
  tokens                jsonb not null,              -- resolved token tree (for tooling/debugging)
  css_text              text not null,               -- precompiled ":root{--primary:...}" ready to inline
  schema_version        int  not null,
  checksum              text not null,               -- hash of TOKENS — dedupe, cache invalidation
  css_sha256            text not null,               -- hash of CSS_TEXT — the CSP header, see D7
  source_config_version int  not null,               -- brand_configs.version this was built from, see D8
  published_at          timestamptz not null default now(),
  published_by          uuid references users(id),

  unique (site_id, version)
);

-- Which snapshot is currently live. Separate table (not a column on
-- sites) so "publish" and "rollback" are both a single-row upsert here,
-- never a write to the sites table itself.
create table brand_theme_active (
  site_id      uuid primary key references sites(id),
  snapshot_id  uuid not null references brand_theme_snapshots(id),
  activated_at timestamptz not null default now()
);
```

`checksum` and `css_sha256` are **different hashes over different things**
and both are load-bearing. `checksum` hashes the token tree and drives the
publish dedupe in §7 and cache invalidation in §8. `css_sha256` hashes the
serialised CSS and is what the server emits as `style-src 'sha256-...'`
(D7). Conflating them produces a CSP header that doesn't match the served
bytes, which fails closed and is unpleasant to debug.

Why split `brand_configs` from `brand_theme_snapshots`: a business owner
dragging a slider writes to `brand_configs` constantly (every drag event,
if you want live preview) — that churn should never touch the table your
production traffic reads from. Publishing is the one moment `brand_configs`
gets read, resolved, and written as a new row in `brand_theme_snapshots`.

---

## 3. Request lifecycle

**Write path (business owner edits theme):**
1. Slider change → write to `brand_configs` (draft), debounced 400ms after
   the last change — short enough to feel instant, long enough that a fast
   drag produces one write instead of dozens.
2. Live preview in the control panel calls `generateTheme()` **client-side**
   or via a cheap endpoint — reads the draft, never touches snapshots.
3. "Publish" → server calls `generateTheme(config)` once, computes `css_text`
   and `checksum`, inserts into `brand_theme_snapshots`, upserts
   `brand_theme_active`.

**Read path (a visitor loads the tenant's site):**
1. Resolve `site_id` from Host header (your existing routing).
2. Look up the active snapshot's `css_text` — this is the only query your
   public traffic makes, and it never runs `generateTheme()`.
3. Inline the CSS text into `<head>`. No client JS required for this case.

This is what makes it scale: production requests do a lookup, not a
computation. `generateTheme()` only ever runs at publish time, which happens
orders of magnitude less often than page views.

---

## 4. Scaling the read path

Don't build for 50,000 tenants on day one — add a layer only when the
previous one is measurably the bottleneck.

| Tenant count | Read path |
|---|---|
| ~5–50 | Direct query to `brand_theme_active` joined to `brand_theme_snapshots`. Fine as-is. |
| ~500 | Add a cache in front (Redis or in-process LRU), keyed by `site_id`, short TTL. Invalidate explicitly on publish rather than waiting for TTL expiry. |
| ~50,000 | Push `css_text` to the edge — CDN key-value store (Cloudflare KV, Vercel Edge Config) keyed by tenant domain. Publish triggers a write-through to the edge store; origin DB is no longer in the read path at all. |

The `checksum` column earns its keep here: cache/edge invalidation can
compare checksums instead of trusting timestamps, which is more robust
against clock skew or re-publishing identical content.

---

## 5. Visual isolation, for the one place it matters

In the control panel, wrap the live preview in a container that scopes the
CSS variables so they can't leak onto your dashboard's own chrome:

```css
[data-site-theme] {
  --primary: var(--site-primary);
  --background: var(--site-background);
  /* your app's own --primary elsewhere is untouched */
}
```

Or render the preview inside a Shadow DOM / iframe if the preview needs to
show real tenant page content rather than just a swatch — either fully
contains the cascade.

---

## 6. Versioning & rollback

Because snapshots are append-only and `brand_theme_active` just points at
one, rollback is "point `brand_theme_active` at an older `snapshot_id`" —
no regeneration, no risk of the algorithm producing a slightly different
result on rollback than it did originally. `schema_version` on each snapshot
also means you can safely change the token-generation algorithm later
without invalidating history: old snapshots keep serving their original
`css_text` exactly as published, and only new publishes use the new schema.

---

## 7. Publish, as a single transaction

The lifecycle in §3 said "publish computes and inserts a snapshot" — here's
what that needs to actually guarantee:

1. Lock the tenant's row: `select * from brand_configs where site_id = $1 for update`.
   This serializes concurrent publishes for the same tenant (a double-click,
   or an auto-publish debounce that fires twice) so two snapshots never get
   minted for the same intent.
2. Run `generateTheme()`. If any Direct/Raw field fails its APCA contrast
   check, **reject the publish** with field-level errors — don't silently
   auto-correct at this stage. Auto-correct belongs at edit time (Guided
   tier); publish is the last gate, and a silent correction here means the
   owner's saved color isn't what actually shipped.
3. Compute `checksum := hash(tokens)`. If it equals the checksum on the
   currently active snapshot, no-op the publish — return success without
   writing a duplicate row.
4. Inside one transaction: compute `version := coalesce(max(version), 0) + 1
   from brand_theme_snapshots where site_id = $1`, insert the new
   snapshot, upsert `brand_theme_active`. Commit both writes together —
   never leave an inserted snapshot without an active pointer, or an active
   pointer referencing a snapshot from a rolled-back transaction.
5. After commit (not before), emit an invalidation event: `{site_id,
   snapshot_id, checksum}`.

## 8. Cache invalidation, concretely

§4 said "invalidate explicitly on publish" — the mechanism:

- Step 5 above emits an event. Postgres `LISTEN/NOTIFY` is enough at
  moderate scale; a real queue (SQS, Cloudflare Queues) once you're pushing
  to edge KV, since queues survive a worker restart and NOTIFY doesn't.
- A worker consumes the event and writes `css_text` to the edge store,
  keyed by tenant domain, using `checksum` as the value's version tag.
- Treat the event as best-effort, not the only path to correctness: keep a
  short in-process/Redis TTL (even 60s) as a fallback, so a dropped or
  delayed event self-heals within a minute instead of leaving a tenant on
  stale branding indefinitely.

## 9. Enforce control tiers at the write boundary, not just the UI

`control_config` (the per-field tier from your control-tier model) needs to
gate the API that accepts owner edits, not only hide/show controls
client-side — otherwise a bypassed UI or a direct API call can write beyond
what the developer configured for that tenant:

- **Locked** fields: reject any incoming write for that field outright.
- **Guided** fields: only accept the small set of known slider/enum values,
  not arbitrary strings.
- **Direct / Raw**: accept the value, subject to the APCA gate in §7 for
  Direct; Raw bypasses that gate by design.

This check belongs in the same service that writes `brand_configs`, reading
`control_config` first on every write — not duplicated per-client.

## 10. Retention

`brand_theme_snapshots` is append-only and will grow forever if left alone.
Run a nightly job (not synchronous with publish) that keeps: the currently
active snapshot (never delete, regardless of age), the most recent 20
snapshots per tenant, and one snapshot per month beyond that for audit
history. Archive the rest to cold storage rather than hard-deleting, if you
want publish history to remain inspectable. Twenty is sized for "a few
weeks of active back-and-forth editing plus room to spare" — most tenants
publish far less often than that, so it rarely triggers at all; it exists
mainly to bound the worst case of a tenant who publishes many times a day.

## 11. Ephemeral preview links

For a shareable "preview before publish" link, add a separate table rather
than reusing snapshots directly:

```sql
create table brand_theme_previews (
  id          uuid primary key default gen_random_uuid(),
  site_id   uuid not null references sites(id),
  tokens      jsonb not null,
  css_text    text not null,
  expires_at  timestamptz not null,
  created_by  uuid references users(id)
);
```

A preview link renders from this table and is never wired directly into
`brand_theme_active` — "promote this preview" re-runs the full §7 publish
pipeline (including the APCA gate) rather than flipping the active pointer
straight to a preview row. That way a preview link outliving its intended
use can't silently become the live theme. Default `expires_at` to 7 days
from creation — long enough to share with a client or a team for review,
short enough that a forgotten link doesn't linger indefinitely.

## 12. The store as a contract, not a schema

Everything in §2–§11 assumes Postgres with a specific table shape. That's
one valid implementation — but the actual requirement is narrower than "use
these three tables." It's: *config writes and published reads are separate,
publish is atomic, versions are monotonic, checksums dedupe.* Express that
as an interface, ship it with zero database dependency, and let each
database/ORM combination satisfy it its own way.

```ts
// @yourscope/brand-tokens-store — pure TypeScript, no DB client imported

interface BrandThemeStore {
  // D9: the suite in §16 scales its concurrency assertions to this, and
  // fails any adapter that claims more than it delivers.
  readonly capabilities: { atomicPublish: 'transactional' | 'serialized' | 'none' };

  getConfig(siteId: string): Promise<BrandConfig | null>;

  // §22: optimistic concurrency is part of the contract, not the caller's
  // problem. Stale expectedVersion => throw ConflictError, write nothing.
  saveConfig(
    siteId: string,
    patch: Partial<BrandConfig>,
    expectedVersion: number
  ): Promise<BrandConfig>;

  // MUST be atomic: serialize per site, assign the next version, write
  // the snapshot and flip the active pointer as one unit — or reject
  // entirely. This single method is where every guarantee in §7 lives.
  publish(
    siteId: string,
    input: {
      tokens: TokenTree;
      cssText: string;
      checksum: string;    // hash of tokens — dedupe (§7 step 3)
      cssSha256: string;   // hash of cssText — the CSP header (D7)
      publishedBy?: string;
    },
    opts?: { expectedConfigVersion?: number; idempotencyKey?: string }
  ): Promise<Snapshot>;

  // Returns null for an unknown site — never throws. §20 makes "no active
  // snapshot" impossible for a provisioned site, but unknown sites
  // (deleted, typo'd domain) are real, and the caller renders the default.
  getActiveSnapshot(siteId: string): Promise<Snapshot | null>;
  listSnapshots(siteId: string, opts?: { limit?: number }): Promise<Snapshot[]>;

  // Flips the active pointer only. Never regenerates — that is the whole
  // point of §6, and it must hold even after the algorithm has changed.
  rollback(siteId: string, snapshotId: string): Promise<void>;

  createPreview(siteId: string, input: {
    tokens: TokenTree; cssText: string; expiresAt: Date;
  }): Promise<Preview>;
  getPreview(previewId: string): Promise<Preview | null>;
}
```

Your `generateTheme()` core, the API layer, and the control-panel UI only
ever talk to this interface — never to Prisma, Knex, or Mongoose directly.
Swapping databases means swapping which class satisfies `BrandThemeStore`,
nothing upstream changes.

## 13. Reference adapters, per ORM/database

Ship a small number of official adapters as separate packages, so most
developers never write one themselves. Current npm download share (mid-2026)
puts Prisma, Drizzle, and Kysely well ahead of TypeORM and Sequelize, but all
five are common enough in production codebases to justify first-class
support — and Lucid gets its own adapter rather than being left to the Knex
one, since it's AdonisJS's native ORM and your own stack runs on it:

| Package | Targets | Note |
|---|---|---|
| `@yourscope/brand-tokens-store-lucid` | AdonisJS (Lucid ORM) | `publish()` uses Lucid's `db.transaction()`; ships as an Adonis service provider so it registers like any other Adonis package |
| `@yourscope/brand-tokens-store-prisma` | Postgres/MySQL/SQLite via Prisma | `publish()` uses `prisma.$transaction([...])` |
| `@yourscope/brand-tokens-store-drizzle` | Postgres/MySQL/SQLite via Drizzle | `publish()` uses `db.transaction(async tx => ...)` |
| `@yourscope/brand-tokens-store-typeorm` | Postgres/MySQL/SQLite via TypeORM | `publish()` uses a `QueryRunner` transaction; entities via decorators matching §2 |
| `@yourscope/brand-tokens-store-sequelize` | Postgres/MySQL/SQLite via Sequelize | `publish()` uses `sequelize.transaction(...)`; covers teams on older/legacy codebases |
| `@yourscope/brand-tokens-store-knex` | Any SQL dialect Knex supports | Raw SQL under the hood — also the right base for anyone on a query builder you don't have a named adapter for |
| `@yourscope/brand-tokens-store-mongoose` | MongoDB | See §14 — needs a different physical shape, same contract |

Lucid is itself built on Knex, so its adapter can share most of its
transaction-handling internals with the Knex adapter rather than being
written from scratch — worth building Knex first and having Lucid wrap it,
rather than the two diverging independently.

Each ships its own schema snippet (Adonis migration file, Prisma
`schema.prisma` block, Drizzle schema file, TypeORM entity classes,
Sequelize model definitions, raw SQL DDL, or a Mongoose schema) matching
§2's tables.

Someone on something else (a query builder you didn't ship, a different
NoSQL store, an internal ORM at their company) implements the ~7-method
interface directly against their own client — a few hours of work bounded
entirely by their own database's transaction primitives, not by anything
in your package.

## 14. Mapping the contract onto non-relational stores

MongoDB and other document stores can satisfy the same interface, but the
physical shape changes — don't force three relational tables onto a
document model:

- **MongoDB**: use its multi-document transactions (available since 4.0)
  to implement `publish()` with the same atomicity as a SQL transaction —
  the logical operation (insert snapshot + flip active pointer) stays
  identical, only the API changes. Alternatively, embed the active
  snapshot directly inside the tenant's document and keep a separate
  `snapshots` collection for history, so the common read (`getActiveSnapshot`)
  is a single-document read with no transaction needed at all.
- **DynamoDB or similar**: `TransactWriteItems` gives the same atomic
  guarantee across the snapshot item and the active-pointer item.
- **Anything without cross-item transactions**: this is the one real
  constraint — `publish()` needs *some* atomicity primitive from the
  underlying store. If a target store genuinely has none, that store isn't
  a fit for being the source of truth (it can still be the edge-cache layer
  from §8, which was already designed to be eventually-consistent).

## 15. Backend framework independence

None of the above should import Express, Fastify, Adonis, NestJS, or Koa
types. The store interface and the service layer that calls it (validate
tier → call `store.publish()` → emit invalidation event) are plain async
functions taking a `siteId` and plain data — they don't know what's
calling them. Each backend framework's route/controller is just a thin
caller:

```ts
// Adonis controller
async publish({ params, request }: HttpContext) {
  return brandThemeService.publish(params.siteId, request.body());
}

// NestJS controller
@Post(':id/theme/publish')
publish(@Param('id') id: string, @Body() body: PublishDto) {
  return this.brandThemeService.publish(id, body);
}

// Express route
app.post('/tenants/:id/theme/publish', (req, res) =>
  brandThemeService.publish(req.params.id, req.body).then(res.json));

// Fastify route
fastify.post('/tenants/:id/theme/publish', async (req) =>
  brandThemeService.publish(req.params.id, req.body));
```

Ship these as documentation snippets per framework — Adonis, Express,
Fastify, NestJS, Koa cover the large majority of Node backends in
production — not as real dependencies. The moment the package imports a
framework's request/response or DI container types, it stops being
backend-agnostic. NestJS is the one framework worth a slightly longer note:
its DI container can wrap `BrandThemeStore` as an injectable provider if a
consumer wants that, but the interface itself still can't assume NestJS
exists.

## 16. A conformance suite, so custom adapters are trustworthy

Since §7–9's guarantees (atomic publish, checksum dedup, monotonic
versions, tier enforcement) are the entire point of the store, ship them as
a runnable test suite — `@yourscope/brand-tokens-store-conformance` — that
takes any `BrandThemeStore` implementation and verifies it end to end:
concurrent publishes never produce duplicate version numbers, publishing an
identical checksum is a no-op, rollback actually flips the active pointer.
Anyone writing a custom adapter for an unsupported database runs this suite
against their implementation before trusting it in production — the same
role a driver conformance kit plays for database client libraries.

## 17. Control config lives per tenant, with profiles as reusable starting points

Each tenant owns its own full `control_config` — not a shared reference
that every tenant points to, and not a small delta on top of one. A
profile is a template you copy from at tenant creation (or apply on
demand), not a live join a tenant stays permanently attached to:

```sql
create table control_profiles (
  id       text primary key,     -- e.g. 'free', 'pro', 'agency' — reusable templates only
  config   jsonb not null
);

alter table brand_configs
  add column control_config jsonb not null;  -- this tenant's actual, live config
```

Provisioning a tenant copies a profile's `config` into that tenant's own
`control_config` once — after that, the two are independent. Editing a
tenant's config afterward (through an admin tool, a support action, a
plan change) only ever touches that one tenant's row.

**The trade-off, stated plainly:** updating a profile no longer propagates
to tenants that were provisioned from it — since the copy already happened,
they're independent afterward. If a bulk change across many tenants on the
same plan is ever needed, that's an explicit "re-apply this profile" action
run per tenant, not something that happens automatically. That's the right
trade to make here: per-tenant customization being first-class matters more
than bulk edits being free, and profiles still do real work as templates
for provisioning and as the plan-tiering pattern validated in §33.

## 18. Merge precedence, decided once, at publish time

The plan never said what wins when a Direct-tier edit and the generated
base theme disagree. Decide it explicitly, and do the merge exactly once —
inside `publish()`, before hashing and generating `css_text` — never at
read time:

```
finalTokens = merge(generatedBase, guidedAdjustments, directEdits, rawOverrides)
// precedence, low to high: base < guided < direct < raw
```

The merged result is what gets checksummed (§7) and stored. The read path
in §3 never merges anything — it only ever reads an already-finished result.

## 19. Raw tier still needs a validator

"Raw" means *any valid CSS value*, not *any string*. Since `css_text` is
built by concatenating token values into a `<style>` block, an unvalidated
raw value is a direct injection point into every visitor's page for that
tenant. Add a value validator that runs even for Raw tier — accept legal
CSS custom-property values (colors, lengths, valid syntax), reject anything
that isn't, before it's written to a snapshot.

## 20. Guarantee an active snapshot always exists

§3's read path assumes `getActiveSnapshot()` returns something — it won't,
for a tenant that signed up and never touched their theme. Rather than
handling null everywhere a theme is read, remove the case entirely:
generate and publish a default snapshot in the same transaction that
creates the tenant row, so "no active snapshot" becomes an invariant that
can't happen in production.

## 21. Two separate checks: tier and role

§9 enforces *which fields* a request can touch (tier). Nothing in the plan
yet enforces *who* can act on a tenant's theme at all. These are different
checks and both need to run, in this order, before any write:

1. Is this user authorized to edit this tenant at all? (role check —
   owner/editor/viewer scoped to the tenant)
2. Is this field editable at this user's tier? (§9's existing check)

Add a lightweight `site_members(site_id, user_id, role)` table if one
doesn't already exist elsewhere in the platform, and check it first.

---

## 22. Concurrent edits on the draft

Two admins with two open tabs currently means the second save silently
overwrites the first — no warning, no merge. Fix with optimistic
concurrency, enforced by the store interface itself so every adapter
behaves the same way:

```sql
alter table brand_configs add column version int not null default 1;
```

```ts
// saveConfig now takes the version the client last saw
saveConfig(siteId: string, patch: Partial<BrandConfig>, expectedVersion: number): Promise<BrandConfig>;
// implementation: UPDATE ... WHERE site_id = $1 AND version = $2, SET version = version + 1
// zero rows affected => throw ConflictError, caller must refetch and reapply
```

The control panel's UI response to `ConflictError` is a product decision
(silently refetch, or show "someone else changed this — reload?"), but the
store guaranteeing the conflict is detectable at all is not optional.

## 23. Versioning the store interface itself

We're asking outside developers to write adapters for Prisma, Drizzle,
Lucid, and anything else. If `BrandThemeStore` grows a new *required*
method later, every existing adapter breaks simultaneously on upgrade.
Two rules going forward:

- New capabilities are added as **optional** methods with a default
  fallback (a `BaseBrandThemeStore` class implements them as a no-op or a
  clear "not supported by this adapter" error), never as required additions
  to the interface.
- The `@yourscope/brand-tokens-store` package (which defines the interface)
  follows strict semver. Adapter packages declare a `peerDependency` on it
  (e.g. `^1.0.0`), so an incompatible pairing surfaces as an install-time
  warning, not a runtime crash. The conformance suite (§16) is pinned per
  major version of the interface, so "does my adapter still satisfy the
  contract" stays answerable after either side changes.

## 24. Rate limiting, on both paths

- **Publish**: a per-tenant sliding-window limit of 10 publishes per 5
  minutes, returning 429 with a retry-after past that. Sized against
  realistic human editing — even an owner rapidly trying out several
  brand colors in a row publishes at most a few times a minute; 10/5min
  comfortably covers that while still catching a runaway script well before
  it fills the snapshot table faster than §10's nightly retention job can
  keep up. Repeated hits from one tenant are worth logging distinctly —
  it's as likely to be a buggy auto-publish integration as it is abuse.
- **Draft saves**: lighter touch, since slider drags are naturally
  high-frequency. The 400ms client-side debounce from §3 is the primary
  defense; a server-side cap of 1 write/second per tenant is the backstop
  in case a client-side bug removes the debounce entirely.

## 25. Light/dark mode, decided in the token shape now

Retrofitting this later changes the shape of every stored snapshot — a
real migration, not an additive change. Decide the token shape up front
even if dark mode itself ships later:

```ts
type TokenValue = string | { light: string; dark: string };
type TokenTree = Record<string, TokenValue>;
```

`css_text` generation emits both blocks in one string at publish time —
`:root{...}` and `:root[data-theme="dark"]{...}` (or a
`prefers-color-scheme` media block) — so the read path in §3 is still a
single lookup even once dark mode is live, not two.

## 26. What to actually measure

Minimum instrumentation before this goes to production, not after:

| Metric | Why |
|---|---|
| `publish_latency_ms` | Catches a slow adapter or a contention hotspot on the row lock in §7 |
| `apca_rejection_rate` | A rising rate signals an owner-facing UX problem, not just validation doing its job |
| `edge_cache_hit_ratio` | Confirms §8's invalidation pipeline is actually keeping the edge warm |
| `snapshot_row_count` per tenant | Feeds back into whether §10's retention job is keeping up |
| `publish_rate_limit_hits` | Ties directly to §24 |
| `store_adapter_error_rate`, tagged by adapter | Community-built adapters (§13) will vary in reliability — this catches a broken custom one early, before a tenant notices |

## 27. Releasing roughly ten packages without breaking combinations

Core, three output adapters, six-plus store adapters, two framework
bindings, and a conformance suite is a real monorepo, not a handful of
independent packages:

- pnpm workspaces, one repo, `packages/*` for core and bindings,
  `adapters/*` for shadcn/tailwind/css, `stores/*` for each ORM adapter.
- Changesets for coordinated version bumps and changelogs across all of
  them from one PR.
- CI runs the conformance suite (§16) against every store adapter before
  any release goes out — a broken Lucid adapter should fail CI, not surface
  as a support ticket.

## 28. Idempotency, in addition to checksum dedup

§7's checksum dedup catches "the same content got published twice." It
can't distinguish a legitimate rapid second edit from a network retry of
the same request arriving twice before the first finished. Add an optional
`Idempotency-Key` header on the publish endpoint: the server caches
`{key → snapshot result}` for 24 hours, and a retried request with the same key
returns the original result rather than re-entering the pipeline. Belt and
suspenders with §7, not a replacement for it.

## 29. Tenant offboarding

When a tenant churns or is deleted: mark it inactive immediately (stop
serving, remove from active caches) rather than deleting data synchronously
on the delete request. Hard-delete `brand_configs`, snapshots, and previews
for that tenant via the same nightly-job pattern as §10's retention, after
a 30-day grace period — long enough to cover an accidental cancellation or
a billing dispute reversing the churn, short enough to keep storage and
any data-retention obligations bounded — not a special one-off deletion
script that has to be remembered and run by hand.

## 30. Multi-region — deliberately deferred, not ignored

Don't build this speculatively. §8's edge cache already solves *read*
latency globally regardless of where the database of record lives — multi-
region mainly matters for the *write* side. Revisit only when one of two
concrete triggers actually happens: a tenant contract requires data
residency in a specific region, or measured write latency from a real
region is shown to matter. Document the trigger, not a guessed solution.

## 31. Guided tier isn't only a slider

So far Guided tier only had one shape — a continuous min/max range. That's
wrong for a field like border radius, where "Sharp / Soft / Round" as three
discrete choices is a better fit than a drag handle. Guided tier needs two
control shapes, not one, and the config just says which:

```ts
type GuidedControl =
  | { tier: 'guided'; type: 'slider'; min: number; max: number }
  | { tier: 'guided'; type: 'select'; options: { label: string; value: string }[] };
```

This is also the fix for "not always one edit option" more generally: a
`control_profiles` row was never limited to one field — it's already a map
of as many fields as the developer wants exposed at once (font, color,
radius, spacing, all simultaneously, each independently tiered). What was
actually missing was that *within* one field, Guided tier could only offer
one kind of control. Now it can offer either, per field.

## 32. Border radius as a shape token

Radius, border width, and shadow depth aren't color — they don't run
through OKLCH or get an APCA contrast check at all. The core package needs
a second, separate generator alongside the color one, and the token tree
needs a place for it:

```ts
type TokenTree = {
  color: Record<string, TokenValue>;   // existing OKLCH/APCA output
  shape: {
    radius: TokenValue;                // e.g. '0.125rem' | '0.5rem' | '1rem'
    borderWidth: TokenValue;
  };
};
```

A sensible default: expose radius as Guided/select with three presets
(`Sharp` → `0.125rem`, `Soft` → `0.5rem`, `Round` → `1rem`), and let Direct
tier accept any valid length value instead (still passed through §19's
validator, since it's a token value like any other — the injection risk in
§19 wasn't specific to color, it applies to every raw-writable field).

```json
{
  "fontFamily":   { "tier": "locked",  "value": "Inter" },
  "accentColor":  { "tier": "direct" },
  "intensity":    { "tier": "guided",  "type": "slider", "min": 0, "max": 100 },
  "radius":       { "tier": "guided",  "type": "select", "options": [
                      { "label": "Sharp", "value": "0.125rem" },
                      { "label": "Soft",  "value": "0.5rem" },
                      { "label": "Round", "value": "1rem" }
                    ] },
  "advancedTokens": { "tier": "raw" }
}
```

Note this config already has five fields active for one tenant at once —
the "one edit option" limitation didn't exist in the schema, only in the
Guided tier's control shape (§31) and in the walkthrough's mockup only
showing four fields as illustration, not as a hard limit.

## 33. The reference brand-kit schema

§17–§32 covers the *mechanism* (tiers, storage, publishing). This is the
actual field list — what a real business needs branded, and what the
platform needs to protect regardless of tier:

| Field | Default tier | Type | Why |
|---|---|---|---|
| `companyName` | direct | text | Identity, not a token |
| `logo` | direct | asset, `{light, dark}` variants | A dark-mode logo is not optional — a light logo disappears on a dark navbar |
| `brandColor` | direct | color | The one true input; most color output still derives from this |
| `semanticColors` | **locked** | derived | Fixed hues (green/amber/red/blue); lightness, chroma, and contrast style still match brand color — see §34 |
| `headingFont` / `bodyFont` | guided · select | curated list | See §35 — never free text, even at Direct |
| `radius` | guided · select | Sharp / Soft / Round | §32 |
| `density` | guided · select | Compact / Comfortable | Spacing-scale multiplier — cheap to offer, disproportionately requested |
| `neutralTone` | guided · select | Warm gray / Cool gray | Changes the feel of every border and background without touching brand color |
| `buttonStyle` | guided · select | Solid / Outline | Affects the default look of every primary CTA |
| `elevation` | guided · slider | 0–100 | Reuses Forge's existing surface-depth/border-strength control rather than reinventing one |
| `advancedTokens` | raw | jsonb | Still subject to §19's validator regardless of tier |
| `supportUrl` | direct | text | Not a token — a plain link to the tenant's own help/support page. Absent from earlier drafts of this schema; every real white-label platform surveyed treats it as part of "complete branding," not an edge case |
| `emailSenderName` | direct | text | The "From" display name on transactional emails — distinct from §37's email *styling*, this is sender identity |

Two things deliberately **not** in this list, even though real platforms bundle
them under "white-label": custom sending domains/SPF/DKIM for email
deliverability, and SMS sender branding. Both are email/telephony
infrastructure, not tokens — they belong to whatever part of the platform
already handles outbound messaging, not to `brand-tokens`. Worth keeping
that line explicit so this package doesn't quietly grow into an email
infrastructure project.

An agency/expert profile (§17) is just this same table with a handful of
tiers flipped — e.g. `semanticColors` moved to `direct` — not a different
schema; it's what gets copied into a tenant's own `control_config` at
provisioning time. This isn't a theoretical nicety: it's how the market
actually prices white-label depth. A widely-used marketing platform gates
branding almost exactly this way across its own pricing tiers — its entry
plan ships zero branding, its mid plan unlocks domain and logo only, and
only its top plan unlocks email sender identity, help-doc links, and a
branded mobile app together. A ~$200/month jump between plans is,
functionally, exactly the kind of profile-to-profile field-tier change
§17 describes.

## 34. Semantic colors are derived, not edited

`success` / `warning` / `error` / `info` default to Locked. They're
generated, not picked — but the derivation has to be precise about what
comes from where, or it stops making sense:

- **Hue stays fixed** to the conventional ones (green/amber/red/blue) —
  never taken from the brand color's hue. "Error" has to read as red
  regardless of whether the brand color is blue or purple; that's a
  universal, learned convention, not a stylistic choice a theme should be
  free to override by accident.
- **Everything else — lightness curve, chroma/saturation level, and the
  APCA contrast approach — comes from the same generation pipeline as the
  brand color.** A bold, saturated brand color produces a bold, saturated
  error red; a soft, muted brand color produces a correspondingly muted
  one. This is what makes semantic colors feel like part of the same theme
  without losing what makes them recognizable.

This split is why Locked is the sensible default rather than a limitation:
if an owner could freely repaint "error" itself (not just its intensity),
error states stop reading as errors, and that failure is the platform's
fault, not theirs. Raw editing of semantic colors — including hue — is
reserved for the tier where the person doing it is presumed to know what
they're overriding.

## 35. Fonts are a curated list, never free text — at any tier

Unlike every other Direct-tier field, font choice stays Guided/select even
for the highest tiers, for two concrete reasons: an arbitrary font name
that isn't actually loaded fails silently to a system fallback, and font
licensing is a real legal exposure for a platform re-serving fonts on
behalf of other businesses. Ship a small, pre-vetted, properly-licensed,
self-hosted set (a Google Fonts subset covers most needs) and let owners
choose from it — never accept an arbitrary font-family string, even in
the Raw tier's JSON blob.

## 36. Assets aren't tokens, but they live alongside them

`logo` doesn't run through `generateTheme()` at all — it's a file, stored
in object storage, with a URL saved on the brand config/snapshot the same
way any other field is. Two things worth deciding now rather than later:

- Store both `light` and `dark` logo variants from the start, even before
  dark mode (§25) ships — retrofitting a second logo slot later means
  re-touching every tenant's stored config.
- Auto-generate a favicon from the uploaded logo at publish time (crop,
  downscale, cache) rather than asking the owner to provide one separately
  — one more thing that's "complete branding" when done for them, and
  incomplete-looking when left as a manual step.

## 37. Output has to reach past CSS

The market research earlier in this plan specifically found that buyers
test whether a vendor's own branding disappears *everywhere* — not just
the web app, but transactional emails and exported PDFs (invoices,
reports). If the token system only emits CSS, those two surfaces quietly
keep the platform's own branding by default, which is exactly the failure
mode buyers screen for. This means two more thin output adapters, same
shape as shadcn/Tailwind/CSS:

- `@yourscope/brand-tokens-email` — emits inline `style=""` attributes
  (email clients don't reliably support `<style>` blocks or CSS variables),
  computed from the same resolved token tree.
- `@yourscope/brand-tokens-pdf` — emits plain color/font values consumable
  by a PDF generation library, for invoice and report exports.

Both read the *same* published snapshot as the CSS adapter — there's no
separate generation step, just a different serialization of tokens that
already exist.

## 38. One account, multiple brand kits

Agencies managing several client sites are a distinct, real segment (the
same market research flagged this explicitly). Nothing so far requires a
1:1 mapping between a login and a theme — the schema in §2 already keys
everything by an ID (`site_id`) that can just as well mean "site" as
"company." The one addition worth making explicit: an `accounts` table
that can own several `sites`, where every table in §2/§17 keys off
`site_id` rather than assuming one theme per account:

```sql
create table accounts (id uuid primary key);
create table sites (
  id          uuid primary key,
  account_id  uuid not null references accounts(id),
  domain      text unique,              -- e.g. app.clientbrand.com
  ssl_status  text not null default 'pending'  -- pending | verified | active
);
-- brand_configs, brand_theme_snapshots and brand_theme_active all key
-- off sites(id), as §2 already declares. control_profiles is the one
-- exception: a shared table of templates (§17), scoped to no site.
```

`domain` and `ssl_status` live on `sites`, not inside the token schema —
every real white-label platform surveyed treats custom domain as
inseparable from brand identity even though it's routing, not a token, so
it's worth tracking alongside the rest of a site's identity rather than in
a separate, easy-to-forget table.

An agency account managing ten client sites is then just ten rows in
`sites` under one `accounts` row — no schema change beyond this, since
every other table was already scoped per themed unit, not per login.

## 39. Supporting SSR delivery

§3's read path was already designed SSR-first — theme resolved server-side
per request, inlined as a `<style>` block before the page renders, zero
client JS required. That part needs no change. One real gap, though: what
happens to a page that's *cached*, not rendered fresh every time.

Three different situations, only one of which is actually a gap:

- **Rendered fresh every request** — already correct, nothing to add.
- **Rendered once and cached (ISR-style)** — the gap. Publishing a new
  theme doesn't reach a cached page until that cache expires on its own,
  because nothing ties a publish to invalidating a *page* cache — only the
  token-lookup cache from §8.
- **Fully static export, no server at request time** — a different
  situation entirely; "live" theme changes there require a rebuild, not an
  invalidation. Worth knowing which of these each SSR site actually is.

The fix for the ISR case: tag the *theme data fetch* with the site's ID,
not the page. Revalidating that tag on publish means every page that reads
the theme picks up the change on its next render, without tracking which
pages to purge:

```ts
// the read — tagged so a publish can invalidate it precisely
async function getActiveSnapshot(siteId: string) {
  const res = await fetch(`${API_BASE}/sites/${siteId}/theme/active`, {
    next: { tags: [`theme:${siteId}`] },
  });
  return res.json();
}

// inside publish(), right after §8's invalidation event
revalidateTag(`theme:${siteId}`);
```

Two guarantees the rest of the plan already provides, worth stating
explicitly for SSR specifically: `generateTheme()` is a pure function
(same guarantee §15 relies on for framework independence), so there's
never a hydration mismatch between server-rendered CSS and anything
recomputed client-side — there's nothing to reconcile, only a lookup to
repeat. And since the `<style>` block lives in the document shell that
flushes first, streaming SSR (Suspense boundaries resolving below it) never
produces a flash of unbranded content.

---

## Still open

- Whether a "re-apply profile" bulk action (§17) is ever actually needed,
  or whether per-tenant edits stay rare enough that it's not worth
  building until someone asks for it.

---
