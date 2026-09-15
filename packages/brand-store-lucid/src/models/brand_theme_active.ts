import { BaseModel, column } from '@adonisjs/lucid/orm';

/** §2's `brand_theme_active`. See `Account`'s doc comment. */
export default class BrandThemeActive extends BaseModel {
  static override table = 'brand_theme_active';
  static override primaryKey = 'site_id';

  @column({ isPrimary: true })
  declare siteId: string;

  @column()
  declare snapshotId: string;
}
