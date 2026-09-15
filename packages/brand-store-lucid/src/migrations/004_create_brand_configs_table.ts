import { BaseSchema } from '@adonisjs/lucid/schema';

/**
 * §2's `brand_configs` — the live, editable draft, one row per site — with
 * §22's `version` column.
 *
 * §2's own DDL only has one jsonb bag (`raw_overrides`). This table has
 * three, because `@pxlhut/brand-store`'s `BrandConfig` (step 13) added a
 * second: `field_values`, for guided/direct-tier scalar fields
 * (`headingFont`, `radius`, `elevation`, …) that §2's original draft had
 * nowhere to put — see `plan/STATUS.md`'s step 13 entry for why. Every
 * `BrandThemeStore` adapter needs all three columns to satisfy the current
 * contract, not just this one.
 *
 * No foreign key from `updated_by` to a `users` table: this package
 * doesn't own identity, and a real Adonis app installing it almost
 * certainly already has its own `users` (or similar) table under a name
 * this package can't predict. The column is a plain, unconstrained
 * identifier for whatever the host app's own user model uses.
 *
 * `site_id` is `text`, not `uuid`, and carries no foreign key to `sites`:
 * the `BrandThemeStore` contract (step 10) treats `siteId` as an opaque
 * caller-supplied string (the conformance suite deliberately exercises
 * non-UUID-shaped ids), and `saveConfig`'s very first call for a site *is*
 * how its config row comes into being — there is no separate provisioning
 * step that would guarantee a matching `sites` row already exists. See
 * `DECISIONS.md`.
 */
export default class extends BaseSchema {
  protected tableName = 'brand_configs';

  override async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.text('site_id').primary();
      table.text('brand_color').notNullable();
      table.jsonb('control_config').notNullable().defaultTo('{}');
      table.jsonb('field_values').notNullable().defaultTo('{}');
      table.jsonb('raw_overrides').notNullable().defaultTo('{}');
      table.jsonb('passthrough').notNullable().defaultTo('{}');
      table.integer('schema_version').notNullable();
      table.integer('version').notNullable().defaultTo(1);
      table.timestamp('updated_at').notNullable();
      table.text('updated_by').nullable();
    });
  }

  override async down() {
    this.schema.dropTable(this.tableName);
  }
}
