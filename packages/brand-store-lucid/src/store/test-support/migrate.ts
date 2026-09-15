/**
 * Runs (and reverses) every migration directly against a `Database`,
 * bypassing Lucid's `Migrator`/Ace entirely — `Migrator` discovers
 * migration files from disk and tracks a `migrations` bookkeeping table,
 * both of which assume a real Ace-booted app. Tests just need the schema
 * to exist, so this instantiates each `BaseSchema` subclass directly and
 * calls `execUp()`/`execDown()`, the same two methods `Migrator` itself
 * calls per file.
 */

import type { Database } from '@adonisjs/lucid/database';

import {
  CreateAccountsTable,
  CreateBrandConfigsTable,
  CreateBrandThemeActiveTable,
  CreateBrandThemePreviewsTable,
  CreateBrandThemeSnapshotsTable,
  CreateControlProfilesTable,
  CreateSitesTable,
} from '../../migrations/index.js';

const MIGRATIONS = [
  CreateAccountsTable,
  CreateSitesTable,
  CreateControlProfilesTable,
  CreateBrandConfigsTable,
  CreateBrandThemeSnapshotsTable,
  CreateBrandThemeActiveTable,
  CreateBrandThemePreviewsTable,
];

/**
 * An arbitrary, fixed key for the advisory lock below — any number works,
 * it only has to be the same one every caller uses.
 */
const MIGRATION_LOCK_KEY = 727_001;

export async function runMigrations(db: Database): Promise<void> {
  // Several test files each call this in their own `beforeAll` against the
  // same real database. Vitest's per-project `fileParallelism: false`
  // (see `vitest.config.ts`) keeps that sequential when this package's own
  // tests run alone, but the *root* workspace run (`pnpm test` /
  // `pnpm verify` across every package) doesn't honour that in the same
  // way, so two callers can still race here. `pg_advisory_xact_lock` is
  // real, database-enforced mutual exclusion: the second caller blocks
  // until the first's transaction ends, then finds `hasTable` already
  // true and does nothing — instead of both racing `create table`.
  await db.transaction(async (trx) => {
    await trx.rawQuery(`select pg_advisory_xact_lock(${MIGRATION_LOCK_KEY})`);
    if (await trx.schema.hasTable('brand_configs')) return;
    for (const Migration of MIGRATIONS) {
      await new Migration(trx, Migration.name).execUp();
    }
  });
}

export async function rollbackMigrations(db: Database): Promise<void> {
  const client = db.connection();
  for (const Migration of [...MIGRATIONS].reverse()) {
    await new Migration(client, Migration.name).execDown();
  }
}
