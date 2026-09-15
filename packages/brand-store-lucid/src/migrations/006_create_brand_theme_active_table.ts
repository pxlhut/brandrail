import { BaseSchema } from '@adonisjs/lucid/schema';

/**
 * §2's `brand_theme_active` — which snapshot is currently live. A separate
 * table, not a column on `sites`, so publish and rollback are each a
 * single-row upsert here and never a write to `sites` itself.
 *
 * `site_id` is `text` with no foreign key to `sites`, matching
 * `brand_configs.site_id` (see that migration's doc comment). `snapshot_id`
 * keeps its foreign key to `brand_theme_snapshots.id` — that row always
 * exists first, since only `publish()`/`rollback()` ever write here.
 */
export default class extends BaseSchema {
  protected tableName = 'brand_theme_active';

  override async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.text('site_id').primary();
      table.text('snapshot_id').notNullable().references('id').inTable('brand_theme_snapshots');
      table.timestamp('activated_at').notNullable();
    });
  }

  override async down() {
    this.schema.dropTable(this.tableName);
  }
}
