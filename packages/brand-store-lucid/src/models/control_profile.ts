import { BaseModel, column } from '@adonisjs/lucid/orm';
import type { ControlProfile as ControlProfileData } from '@pxlhut/brand-core';

/** §17's `control_profiles` — the one table not scoped per site. See `Account`'s doc comment. */
export default class ControlProfile extends BaseModel {
  static override table = 'control_profiles';

  @column({ isPrimary: true })
  declare id: string;

  @column()
  declare config: ControlProfileData;
}
