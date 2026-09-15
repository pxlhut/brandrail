/**
 * Every migration, in the order they must run — read by
 * `store/test-support/migrate.ts` to build a schema with no Ace/Migrator
 * machinery involved (see that file's doc comment for why), and available
 * to a host app that wants to point its own migration paths at this
 * package instead of copying the files.
 */
export { default as CreateAccountsTable } from './001_create_accounts_table.js';
export { default as CreateSitesTable } from './002_create_sites_table.js';
export { default as CreateControlProfilesTable } from './003_create_control_profiles_table.js';
export { default as CreateBrandConfigsTable } from './004_create_brand_configs_table.js';
export { default as CreateBrandThemeSnapshotsTable } from './005_create_brand_theme_snapshots_table.js';
export { default as CreateBrandThemeActiveTable } from './006_create_brand_theme_active_table.js';
export { default as CreateBrandThemePreviewsTable } from './007_create_brand_theme_previews_table.js';
