import { BaseModel, column } from '@adonisjs/lucid/orm';
import type { TokenTree } from '@pxlhut/brand-core';

/** §2's `brand_theme_snapshots`. See `Account`'s doc comment. */
export default class BrandThemeSnapshot extends BaseModel {
  static override table = 'brand_theme_snapshots';

  @column({ isPrimary: true })
  declare id: string;

  @column()
  declare siteId: string;

  @column()
  declare version: number;

  @column()
  declare tokens: TokenTree;

  @column()
  declare cssText: string;

  @column()
  declare schemaVersion: number;

  @column()
  declare checksum: string;

  @column()
  declare cssSha256: string;

  @column()
  declare sourceConfigVersion: number;

  @column()
  declare publishedBy: string | null;
}
