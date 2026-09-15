import { BaseModel, column } from '@adonisjs/lucid/orm';
import type { TokenTree } from '@pxlhut/brand-core';

/** §11's `brand_theme_previews`. See `Account`'s doc comment. */
export default class BrandThemePreview extends BaseModel {
  static override table = 'brand_theme_previews';

  @column({ isPrimary: true })
  declare id: string;

  @column()
  declare siteId: string;

  @column()
  declare tokens: TokenTree;

  @column()
  declare cssText: string;

  @column()
  declare createdBy: string | null;
}
