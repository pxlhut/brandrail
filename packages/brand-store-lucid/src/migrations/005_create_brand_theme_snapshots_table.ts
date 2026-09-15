import { BaseSchema } from '@adonisjs/lucid/schema';

/**
 * §2's `brand_theme_snapshots` — immutable, append-only. `unique
 * (site_id, version)` is not just an index: it is the monotonicity
 * guarantee (rule 2) enforced by the database itself, the last line of
 * defence if `publish()`'s own row lock (see `store/`) is ever bypassed or
 * misused.
 *
 * `id` and `site_id` are `text`, not `uuid`: `id` is whatever
 * `LucidBrandThemeStoreOptions.nextId` produces (a caller can inject a
 * non-UUID generator), and `site_id` is the same opaque caller-supplied
 * string as `brand_configs.site_id` — see that migration's doc comment.
 * Neither carries a foreign key to `sites`, for the same reason.
 */
export default class extends BaseSchema {
  protected tableName = 'brand_theme_snapshots';

  override async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.text('id').primary();
      table.text('site_id').notNullable();
      table.integer('version').notNullable();
      table.jsonb('tokens').notNullable();
      table.text('css_text').notNullable();
      table.integer('schema_version').notNullable();
      /** Hash of `tokens` — dedupe (rule 3), cache invalidation. Not `css_sha256`. */
      table.text('checksum').notNullable();
      /** SHA-256 of `css_text`, base64 — the CSP header (D7). Not `checksum`. */
      table.text('css_sha256').notNullable();
      /** `brand_configs.version` this was built from (D8). */
      table.integer('source_config_version').notNullable();
      table.timestamp('published_at').notNullable();
      table.text('published_by').nullable();

      table.unique(['site_id', 'version']);
    });
  }

  override async down() {
    this.schema.dropTable(this.tableName);
  }
}
