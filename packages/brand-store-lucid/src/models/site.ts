import { BaseModel, column } from '@adonisjs/lucid/orm';

/** §38's `sites` table. See `Account`'s doc comment: not used by `LucidBrandThemeStore` itself. */
export default class Site extends BaseModel {
  static override table = 'sites';

  @column({ isPrimary: true })
  declare id: string;

  @column()
  declare accountId: string;

  @column()
  declare domain: string | null;

  @column()
  declare sslStatus: string;
}
