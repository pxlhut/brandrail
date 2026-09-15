import { BaseModel, column } from '@adonisjs/lucid/orm';

/**
 * §38's `accounts` table, as a Lucid model — for the rest of a host app's
 * own code (relations, admin tooling) to query naturally. `LucidBrandThemeStore`
 * itself never uses this: the adapter's read/write paths go through the raw
 * query client directly (see `store/`), the same way for every table, so
 * that `publish()`'s row lock and upsert stay in one place rather than half
 * in the ORM and half below it.
 */
export default class Account extends BaseModel {
  static override table = 'accounts';

  @column({ isPrimary: true })
  declare id: string;
}
