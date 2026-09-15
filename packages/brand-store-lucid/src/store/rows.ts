/**
 * Row ↔ domain object mapping. Deliberately not going through the Lucid
 * models in `models/` — `LucidBrandThemeStore` reads and writes every table
 * through the raw query client (`db.from`/`db.transaction`), so that
 * `publish()`'s row lock, version computation and upsert all live in one
 * place instead of half in the ORM and half below it. The models exist for
 * the rest of a host app's own code.
 */

import type { BrandConfig, Preview, Snapshot } from '@pxlhut/brand-core';

/** Column names, snake_case, exactly as the migrations declare them — this file is the only place that needs to know that. */
export interface BrandConfigRow {
  site_id: string;
  brand_color: string;
  control_config: unknown;
  field_values: unknown;
  raw_overrides: unknown;
  passthrough: unknown;
  schema_version: number;
  version: number;
  updated_at: Date | string;
  updated_by: string | null;
}

export interface SnapshotRow {
  id: string;
  site_id: string;
  version: number;
  tokens: unknown;
  css_text: string;
  schema_version: number;
  checksum: string;
  css_sha256: string;
  source_config_version: number;
  published_at: Date | string;
  published_by: string | null;
}

export interface PreviewRow {
  id: string;
  site_id: string;
  tokens: unknown;
  css_text: string;
  expires_at: Date | string;
  created_by: string | null;
}

/** `pg` parses jsonb columns into JS values already; this only exists so a driver that doesn't (a future adapter) has one place to add `JSON.parse`. */
function asJson<T>(value: unknown): T {
  return (typeof value === 'string' ? JSON.parse(value) : value) as T;
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function rowToBrandConfig(row: BrandConfigRow): BrandConfig {
  return {
    siteId: row.site_id,
    brandColor: row.brand_color,
    controlConfig: asJson(row.control_config),
    fieldValues: asJson(row.field_values),
    rawOverrides: asJson(row.raw_overrides),
    passthrough: asJson(row.passthrough),
    schemaVersion: row.schema_version,
    version: row.version,
    updatedAt: toIso(row.updated_at),
    ...(row.updated_by !== null ? { updatedBy: row.updated_by } : {}),
  };
}

export function rowToSnapshot(row: SnapshotRow): Snapshot {
  return {
    id: row.id,
    siteId: row.site_id,
    version: row.version,
    tokens: asJson(row.tokens),
    cssText: row.css_text,
    checksum: row.checksum,
    cssSha256: row.css_sha256,
    sourceConfigVersion: row.source_config_version,
    schemaVersion: row.schema_version,
    publishedAt: toIso(row.published_at),
    ...(row.published_by !== null ? { publishedBy: row.published_by } : {}),
  };
}

export function rowToPreview(row: PreviewRow): Preview {
  return {
    id: row.id,
    siteId: row.site_id,
    tokens: asJson(row.tokens),
    cssText: row.css_text,
    expiresAt: toIso(row.expires_at),
    ...(row.created_by !== null ? { createdBy: row.created_by } : {}),
  };
}
