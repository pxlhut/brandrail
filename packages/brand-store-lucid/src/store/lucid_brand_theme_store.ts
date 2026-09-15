/**
 * The Lucid adapter (step 14) — guideline §13's dogfooding step: this is
 * the reader's own stack, so a real product with real sites exercises
 * publish, rollback and (later) the editor before any of this goes public.
 *
 * `atomicPublish: 'transactional'` — `publish()` runs inside a real
 * database transaction with a row lock, not an app-level mutex (contrast
 * `@pxlhut/brand-store/memory`, step 12, which can only ever honestly
 * claim `'serialized'`).
 */

import { defaultControlConfig } from '@pxlhut/brand-core';
import type { BrandConfig, Preview, Snapshot } from '@pxlhut/brand-core';
import {
  BaseBrandThemeStore,
  ConflictError,
  NotFoundError,
  type PreviewInput,
  type PublishInput,
  type StoreCapabilities,
} from '@pxlhut/brand-store';
import type { Database } from '@adonisjs/lucid/database';

import { runPublishTransaction } from './publish_transaction.js';
import {
  rowToBrandConfig,
  rowToPreview,
  rowToSnapshot,
  type BrandConfigRow,
  type PreviewRow,
  type SnapshotRow,
} from './rows.js';

export interface LucidBrandThemeStoreOptions {
  /** @default crypto.randomUUID */
  nextId?: () => string;
  /** @default () => new Date() */
  now?: () => Date;
}

export class LucidBrandThemeStore extends BaseBrandThemeStore {
  readonly capabilities: StoreCapabilities = { atomicPublish: 'transactional' };

  private readonly nextId: () => string;
  private readonly now: () => Date;

  constructor(
    private readonly db: Database,
    opts: LucidBrandThemeStoreOptions = {},
  ) {
    super();
    this.nextId = opts.nextId ?? (() => crypto.randomUUID());
    this.now = opts.now ?? (() => new Date());
  }

  override async getConfig(siteId: string): Promise<BrandConfig | null> {
    const row = (await this.db.from('brand_configs').where('site_id', siteId).first()) as BrandConfigRow | null;
    // `version: 0` is publish()'s lock placeholder (see `publish_transaction.ts`),
    // not a real config — the same sentinel this package uses everywhere
    // else for "no config exists yet".
    return row === null || row.version === 0 ? null : rowToBrandConfig(row);
  }

  override async saveConfig(
    siteId: string,
    patch: Partial<BrandConfig>,
    expectedVersion: number,
  ): Promise<BrandConfig> {
    return this.db.transaction(async (trx) => {
      // Guarantees a row to lock even for a site's very first call — see
      // `publish_transaction.ts`'s doc comment for why `for update` alone
      // isn't enough when no row exists yet.
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
          updated_at: this.now(),
          updated_by: null,
        });

      const current = (await trx.from('brand_configs').where('site_id', siteId).forUpdate().first()) as
        | BrandConfigRow
        | null;
      const currentVersion = current?.version ?? 0;
      if (currentVersion !== expectedVersion) {
        throw new ConflictError(
          `saveConfig(${siteId}): expected version ${expectedVersion}, current is ${currentVersion}`,
        );
      }

      const currentConfig = current === null || current.version === 0 ? null : rowToBrandConfig(current);
      const row: BrandConfigRow = {
        site_id: siteId,
        brand_color: patch.brandColor ?? currentConfig?.brandColor ?? '#000000',
        control_config: patch.controlConfig ?? currentConfig?.controlConfig ?? defaultControlConfig(),
        // Shallow-merged, not replaced (rules.md, rule 4's note): each bag
        // holds many independent fields' values.
        field_values: { ...currentConfig?.fieldValues, ...patch.fieldValues },
        raw_overrides: { ...currentConfig?.rawOverrides, ...patch.rawOverrides },
        passthrough: { ...currentConfig?.passthrough, ...patch.passthrough },
        schema_version: patch.schemaVersion ?? currentConfig?.schemaVersion ?? 1,
        version: currentVersion + 1,
        updated_at: this.now(),
        updated_by: patch.updatedBy ?? currentConfig?.updatedBy ?? null,
      };

      // The placeholder insert above guarantees a row always exists by now.
      await trx.from('brand_configs').where('site_id', siteId).update(row);

      return rowToBrandConfig(row);
    });
  }

  override async publish(
    siteId: string,
    input: PublishInput,
    opts?: { expectedConfigVersion?: number; idempotencyKey?: string },
  ): Promise<Snapshot> {
    const result = await this.db.transaction((trx) =>
      runPublishTransaction(trx, siteId, input, {
        ...(opts?.expectedConfigVersion !== undefined ? { expectedConfigVersion: opts.expectedConfigVersion } : {}),
        nextId: this.nextId,
        now: this.now,
      }),
    );
    return rowToSnapshot(result.snapshot);
  }

  override async getActiveSnapshot(siteId: string): Promise<Snapshot | null> {
    const pointer = (await this.db.from('brand_theme_active').where('site_id', siteId).first()) as {
      snapshot_id: string;
    } | null;
    if (pointer === null) return null;
    const row = (await this.db.from('brand_theme_snapshots').where('id', pointer.snapshot_id).first()) as
      | SnapshotRow
      | null;
    return row === null ? null : rowToSnapshot(row);
  }

  override async listSnapshots(siteId: string, opts?: { limit?: number }): Promise<Snapshot[]> {
    const query = this.db.from('brand_theme_snapshots').where('site_id', siteId).orderBy('version', 'asc');
    if (opts?.limit !== undefined) query.limit(opts.limit);
    const rows = (await query) as SnapshotRow[];
    return rows.map(rowToSnapshot);
  }

  override async rollback(siteId: string, snapshotId: string): Promise<void> {
    await this.db.transaction(async (trx) => {
      // Rule 6: a pointer move only. Confirming the snapshot exists *for
      // this site* first is what turns a typo'd or cross-site id into
      // NotFoundError instead of a foreign-key crash or a silent no-op.
      const snapshot = await trx
        .from('brand_theme_snapshots')
        .where('id', snapshotId)
        .where('site_id', siteId)
        .first();
      if (snapshot === null) {
        throw new NotFoundError(`rollback(${siteId}): no snapshot ${snapshotId}`);
      }

      const existingPointer = await trx.from('brand_theme_active').where('site_id', siteId).first();
      if (existingPointer === null) {
        await trx
          .table('brand_theme_active')
          .insert({ site_id: siteId, snapshot_id: snapshotId, activated_at: this.now() });
      } else {
        await trx
          .from('brand_theme_active')
          .where('site_id', siteId)
          .update({ snapshot_id: snapshotId, activated_at: this.now() });
      }
    });
  }

  override async createPreview(siteId: string, input: PreviewInput): Promise<Preview> {
    const row: PreviewRow = {
      id: this.nextId(),
      site_id: siteId,
      tokens: input.tokens,
      css_text: input.cssText,
      expires_at: input.expiresAt,
      created_by: input.createdBy ?? null,
    };
    await this.db.table('brand_theme_previews').insert(row);
    return rowToPreview(row);
  }

  override async getPreview(previewId: string): Promise<Preview | null> {
    const row = (await this.db
      .from('brand_theme_previews')
      .where('id', previewId)
      .where('expires_at', '>', this.now())
      .first()) as PreviewRow | null;
    return row === null ? null : rowToPreview(row);
  }
}
