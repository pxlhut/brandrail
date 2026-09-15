import { BaseSchema } from '@adonisjs/lucid/schema';

/**
 * §17 — the one table *not* scoped per site: a shared table of reusable
 * templates ('free', 'pro', 'agency', ...), copied into a site's own
 * `brand_configs.control_config` at provisioning. Editing a row here never
 * propagates to a site already provisioned from it — that's the whole
 * point of copying rather than joining.
 */
export default class extends BaseSchema {
  protected tableName = 'control_profiles';

  override async up() {
    this.schema.createTable(this.tableName, (table) => {
      // Text, not uuid: profile ids are human-chosen names ('free', 'pro',
      // 'agency'), not generated identifiers.
      table.text('id').primary();
      table.jsonb('config').notNullable();
    });
  }

  override async down() {
    this.schema.dropTable(this.tableName);
  }
}
