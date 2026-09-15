/**
 * Ships this adapter as an Adonis service provider (§13's "registers like
 * any other Adonis package"), the same shape as Lucid's own
 * `database_provider` — a host app lists this in `adonisrc.ts`'s
 * `providers` array and gets a ready-to-inject `LucidBrandThemeStore`
 * back, instead of constructing one by hand at every call site.
 *
 * Depends on Lucid's own provider having already registered `'lucid.db'`
 * (Lucid's provider always runs first in practice: this package's peer
 * dependency on `@adonisjs/lucid` means a host app that lists both always
 * lists Lucid's provider too, and AdonisJS registers providers in the
 * array's order).
 */

import type { ApplicationService } from '@adonisjs/core/types';
// Side-effect import: pulls in Lucid's own module augmentation of
// `ContainerBindings['lucid.db']`, so `resolver.make('lucid.db')` below
// resolves typed as `Database` without a cast.
import '@adonisjs/lucid/database_provider';

import { LucidBrandThemeStore } from '../store/lucid_brand_theme_store.js';

declare module '@adonisjs/core/types' {
  interface ContainerBindings {
    /**
     * The singleton {@link LucidBrandThemeStore}, bound over whichever
     * connection Lucid's own `'lucid.db'` singleton resolves to.
     *
     * @example
     * const store = await app.container.make('brand.store');
     */
    'brand.store': LucidBrandThemeStore;
  }
}

export default class BrandStoreProvider {
  constructor(protected app: ApplicationService) {}

  register(): void {
    this.app.container.singleton(LucidBrandThemeStore, async (resolver) => {
      const db = await resolver.make('lucid.db');
      return new LucidBrandThemeStore(db);
    });
    this.app.container.alias('brand.store', LucidBrandThemeStore);
  }
}
