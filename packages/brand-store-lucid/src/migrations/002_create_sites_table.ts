import { BaseSchema } from '@adonisjs/lucid/schema';

/**
 * §38. `domain`/`ssl_status` live here, not in the token schema — every
 * real white-label platform surveyed treats a custom domain as inseparable
 * from brand identity, even though it's routing, not a token.
 */
export default class extends BaseSchema {
  protected tableName = 'sites';

  override async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary();
      table.uuid('account_id').notNullable().references('id').inTable('accounts');
      table.text('domain').unique();
      table.text('ssl_status').notNullable().defaultTo('pending');
    });
  }

  override async down() {
    this.schema.dropTable(this.tableName);
  }
}
