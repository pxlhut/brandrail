import { BaseSchema } from '@adonisjs/lucid/schema';

/**
 * §38 — an account can own several sites. Intentionally minimal: this
 * package doesn't know anything about billing, auth, or plan tiers, and
 * shouldn't invent columns for concerns it doesn't own. A real platform
 * likely already has a richer `accounts`/`organizations` table; where it
 * does, point `sites.account_id` at that table instead of this migration.
 */
export default class extends BaseSchema {
  protected tableName = 'accounts';

  override async up() {
    // §38's own DDL is deliberately this minimal — `create table accounts
    // (id uuid primary key);` — no timestamps, no name column. Anything
    // beyond an id is this package inventing columns for a concern (identity,
    // billing) it doesn't own.
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary();
    });
  }

  override async down() {
    this.schema.dropTable(this.tableName);
  }
}
