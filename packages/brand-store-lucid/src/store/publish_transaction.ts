/**
 * §7's publish sequence, inside one transaction — kept in its own module,
 * independent of the rest of the adapter's setup/wiring code, so a future
 * Knex adapter (§13 notes Lucid is itself built on Knex) can lift it with
 * little more than an import-path change: nothing Lucid-ORM-specific (no
 * models, no decorators) appears here, only `TransactionClientContract`'s
 * query-builder surface, which mirrors a plain `Knex.Transaction` closely
 * by design.
 *
 * **Locks the config row, not the snapshots table.** `select ... for
 * update` on `brand_configs` is what serialises concurrent publishes for
 * one site: a second transaction's own `for update` on the same row blocks
 * until the first commits or rolls back. Locking the snapshots table
 * instead would serialise publishes *across every site*, which would show
 * up as a contention hotspot on `publish_latency_ms` (§26) the moment more
 * than one site publishes at once.
 *
 * **A row to lock has to exist first.** `select ... for update` locks
 * nothing when it matches zero rows — a site that has never called
 * `saveConfig` has no `brand_configs` row yet, so a first-ever `publish()`
 * with nothing to lock would let concurrent calls race on
 * `max(version)` freely. The `insert ... on conflict (site_id) do nothing`
 * below guarantees a row exists before the lock is taken: for a genuinely
 * concurrent first publish, the *insert* itself is what serialises the
 * callers (a second transaction's insert of the same `site_id` blocks
 * until the first commits), and the `for update` immediately after is then
 * always locking a real row. The placeholder it creates has `version: 0`
 * — the sentinel this package already uses everywhere for "no config
 * exists yet" — so `getConfig` keeps returning `null` for a site that has
 * published but never called `saveConfig`.
 */

import { ConflictError } from '@pxlhut/brand-store';
import type { PublishInput } from '@pxlhut/brand-store';
import type { TransactionClientContract } from '@adonisjs/lucid/types/database';

import type { BrandConfigRow, SnapshotRow } from './rows.js';

export interface PublishTransactionResult {
  snapshot: SnapshotRow;
  /** `true` when this was rule 3's dedupe no-op — no row was written. */
  deduped: boolean;
}

export async function runPublishTransaction(
  trx: TransactionClientContract,
  siteId: string,
  input: PublishInput,
  opts: { expectedConfigVersion?: number; nextId: () => string; now: () => Date },
): Promise<PublishTransactionResult> {
  await trx
    .table('brand_configs')
    .onConflict('site_id')
    .ignore()
    .insert({
      site_id: siteId,
      brand_color: '#000000',
      control_config: {},
      field_values: {},
      raw_overrides: {},
      passthrough: {},
      schema_version: 1,
      version: 0,
      updated_at: opts.now(),
      updated_by: null,
    });

  // Locks `brand_configs`, even though publish never writes to it — this
  // row is the one every concurrent publish for this site contends on.
  const config = (await trx.from('brand_configs').where('site_id', siteId).forUpdate().first()) as
    | BrandConfigRow
    | null;

  if (opts.expectedConfigVersion !== undefined) {
    const actual = config?.version ?? 0;
    if (actual !== opts.expectedConfigVersion) {
      throw new ConflictError(
        `publish(${siteId}): expected config version ${opts.expectedConfigVersion}, current is ${actual}`,
      );
    }
  }

  const activePointer = (await trx.from('brand_theme_active').where('site_id', siteId).first()) as {
    snapshot_id: string;
  } | null;

  if (activePointer !== null) {
    const activeSnapshot = (await trx
      .from('brand_theme_snapshots')
      .where('id', activePointer.snapshot_id)
      .first()) as SnapshotRow | null;
    if (activeSnapshot !== null && activeSnapshot.checksum === input.checksum) {
      return { snapshot: activeSnapshot, deduped: true }; // rule 3
    }
  }

  const maxVersionRow = (await trx
    .from('brand_theme_snapshots')
    .where('site_id', siteId)
    .max('version', 'max_version')
    .first()) as { max_version: number | string | null } | null;
  const nextVersion = Number(maxVersionRow?.max_version ?? 0) + 1;

  const id = opts.nextId();
  const now = opts.now();
  const snapshotRow: SnapshotRow = {
    id,
    site_id: siteId,
    version: nextVersion,
    tokens: input.tokens,
    css_text: input.cssText,
    schema_version: input.tokens.meta.schemaVersion,
    checksum: input.checksum,
    css_sha256: input.cssSha256,
    source_config_version: config?.version ?? 0,
    published_at: now,
    published_by: input.publishedBy ?? null,
  };

  await trx.table('brand_theme_snapshots').insert(snapshotRow);

  // Upsert the pointer — one row per site, so this is either an insert (a
  // site's first publish) or an update (every publish after). The row is
  // already locked against a *concurrent* upsert by the config-row lock
  // above; this only needs to pick insert vs. update correctly.
  const existingPointer = await trx.from('brand_theme_active').where('site_id', siteId).first();
  if (existingPointer === null) {
    await trx.table('brand_theme_active').insert({ site_id: siteId, snapshot_id: id, activated_at: now });
  } else {
    await trx.from('brand_theme_active').where('site_id', siteId).update({ snapshot_id: id, activated_at: now });
  }

  return { snapshot: snapshotRow, deduped: false };
}
