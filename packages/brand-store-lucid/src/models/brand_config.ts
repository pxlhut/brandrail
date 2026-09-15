import { BaseModel, column } from '@adonisjs/lucid/orm';
import type { ControlConfig } from '@pxlhut/brand-core';

/** §2's `brand_configs`. See `Account`'s doc comment: `LucidBrandThemeStore` reads and writes this table through the raw query client, not through this model. */
export default class BrandConfigModel extends BaseModel {
  static override table = 'brand_configs';
  static override primaryKey = 'site_id';

  @column({ isPrimary: true })
  declare siteId: string;

  @column()
  declare brandColor: string;

  @column()
  declare controlConfig: ControlConfig;

  @column()
  declare fieldValues: Record<string, string>;

  @column()
  declare rawOverrides: Record<string, string>;

  @column()
  declare passthrough: Record<string, string>;

  @column()
  declare schemaVersion: number;

  @column()
  declare version: number;

  @column()
  declare updatedBy: string | null;
}
