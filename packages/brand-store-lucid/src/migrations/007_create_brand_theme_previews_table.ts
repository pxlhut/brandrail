import { BaseSchema } from '@adonisjs/lucid/schema';

/**
 * §11 — a shareable "preview before publish" link, deliberately a separate
 * table from `brand_theme_snapshots`: a preview is never wired into
 * `brand_theme_active`. "Promote this preview" re-runs the full §7 publish
 * pipeline instead (rule 7), so a forgotten link can't silently become the
 * live theme.
 *
 * `id` and `site_id` are `text`, matching `brand_theme_snapshots` — see
 * that migration's doc comment.
 */
export default class extends BaseSchema {
  protected tableName = 'brand_theme_previews';

  override async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.text('id').primary();
      table.text('site_id').notNullable();
      table.jsonb('tokens').notNullable();
      table.text('css_text').notNullable();
      table.timestamp('expires_at').notNullable();
      table.text('created_by').nullable();
    });
  }

  override async down() {
    this.schema.dropTable(this.tableName);
  }
}
