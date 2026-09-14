# Step 14 — Store: the Lucid adapter

| | |
|---|---|
| **Depends on** | 13 |
| **Unlocks** | 15, and the first real users |
| **Output** | `brand-store-lucid/src/{store,models,migrations,provider}/` |
| **Size** | one to two days |

## Why this step exists

Guideline §13 puts Lucid first among the adapters for a concrete reason:
it's AdonisJS's native ORM and **your own stack runs on it**. This is the
dogfooding step. A real product with real sites exercises publish,
rollback and (later) the editor before any of this goes public.

Expect this step to send you back to `DECISIONS.md` at least once. That's
why it comes before the other six adapters rather than after — discovering
a contract problem with one adapter written costs an afternoon; with seven
it costs a week and a major version.

## Prerequisites

- Steps 10–13 complete, conformance suite green against the in-memory adapter
- Guideline §2 (the reference schema, as revised by D1), §13 (adapter
  notes), §38 (`accounts` / `sites`)
- A Postgres database for tests

## Build

### Migrations

Adonis migration files for guideline §2's tables, **with the step 01
revisions applied**:

- Everything keys on `site_id` (D1). Not `tenant_id`.
- `brand_theme_snapshots` carries `css_sha256` (D7) and
  `source_config_version` (D8) alongside `tokens`, `css_text`, `checksum`,
  `schema_version`.
- `brand_configs` carries the `version int not null default 1` column from
  §22.
- `sites` and `accounts` per §38, with `domain` and `ssl_status` on
  `sites` — §38's reasoning is that every white-label platform surveyed
  treats custom domain as inseparable from brand identity, so it's worth
  tracking alongside the rest of a site's identity rather than in a
  separate, easy-to-forget table.
- `control_profiles` is the one table **not** scoped per site (§17) — it's
  a shared table of templates.

Indexes that matter: `unique (site_id, version)` on snapshots (§2, and
the monotonicity guarantee depends on it), and `brand_theme_active` keyed
by `site_id` as primary key so publish and rollback are both a single-row
upsert.

### The adapter

```ts
export class LucidBrandThemeStore extends BaseBrandThemeStore {
  readonly capabilities = { atomicPublish: 'transactional' as const };
}
```

`publish()` uses Lucid's `db.transaction()` (§13). Inside it, §7's
sequence: `select … for update` on the config row, compute
`version := coalesce(max(version), 0) + 1`, insert the snapshot, upsert
the active pointer, commit both together.

The `for update` row lock is what serialises concurrent publishes for the
same site — §7 names the realistic triggers as a double-click or an
auto-publish debounce firing twice. **Lock the config row, not the
snapshots table**; locking the table serialises across sites and will
show up as a contention hotspot in the `publish_latency_ms` metric §26
asks for.

Ship it as an Adonis service provider so it registers like any other
Adonis package (§13).

### Reuse, per §13

§13 notes Lucid is itself built on Knex, and suggests building the Knex
adapter first so Lucid wraps it rather than the two diverging. **For
v0.1, skip that** — there is no Knex adapter (D10) and writing one to
wrap costs more than it saves today. Keep the transaction handling in a
small internal module so a future Knex adapter can lift it. Record this
as a deviation from §13 in `DECISIONS.md`.

### Wire into Forge

The actual point of the step. Provision a real site, publish a real
theme, roll it back, and serve it. Whatever breaks here is worth more
than the adapter itself.

## Acceptance

- [ ] Passes the step 11 conformance suite at `transactional`, against real Postgres in CI
- [ ] Migrations create §2's schema with D1/D7/D8 revisions applied
- [ ] `unique (site_id, version)` exists and a concurrency test proves it holds
- [ ] `publish` locks the **config row**, not the snapshots table
- [ ] Registers as an Adonis service provider
- [ ] No `tenant_id` anywhere in migrations or code
- [ ] A real site in Forge publishes, rolls back, and serves the right CSS
- [ ] Any contract ambiguity found is written back into step 10 and `DECISIONS.md`

## Out of scope

Prisma, Drizzle, Kysely, TypeORM, Sequelize, Knex, Mongoose — all
demand-driven (D10). The conformance suite is what makes each of them a
weekend for whoever asks.

Guideline §10 (retention) and §29 (offboarding) are nightly jobs, not
adapter concerns. Note them for later as **one** job module with two
tasks, not two separate cron entries — one place to monitor, one place to
fail.

## Notes for step 15

Once a real site serves a real snapshot, the read path is testable
end-to-end for the first time: Host header → `site_id` → active snapshot →
inlined CSS.
