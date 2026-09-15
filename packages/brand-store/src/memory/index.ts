/**
 * The in-memory reference adapter (step 12).
 *
 * Three jobs, in order: prove the step 11 conformance suite is
 * satisfiable at all; give the service layer (step 13) and the editor
 * (step 16) a store that needs no database to develop or test against; be
 * the short, obvious thing an adapter author reads first.
 *
 * Four `Map`s, mirroring guideline §2's four tables — configs, snapshots,
 * active pointers, previews — everything keyed by `siteId` (D1).
 */

import { defaultControlConfig } from '@pxlhut/brand-core';
import type { BrandConfig, Preview, Snapshot } from '@pxlhut/brand-core';

import {
  BaseBrandThemeStore,
  ConflictError,
  NotFoundError,
  type PreviewInput,
  type PublishInput,
} from '../contract/index.js';

export interface MemoryBrandThemeStoreOptions {
  /** Injectable clock, so preview-expiry tests control time rather than sleeping. @default () => new Date() */
  now?: () => Date;
}

/**
 * Fixtures for `seed()` — not the full write paths (no version/concurrency
 * checks), just a direct way to get data into a fresh store for a test or a
 * local dev server. Not part of `BrandThemeStore` — an adapter extra.
 */
export interface SeedData {
  configs?: readonly BrandConfig[];
  snapshots?: readonly Snapshot[];
  /** `[siteId, snapshotId]` — which snapshot is active per site. */
  active?: ReadonlyArray<readonly [string, string]>;
  previews?: readonly Preview[];
}

export class MemoryBrandThemeStore extends BaseBrandThemeStore {
  readonly capabilities = { atomicPublish: 'serialized' as const };

  private readonly now: () => Date;
  private configs = new Map<string, BrandConfig>();
  private snapshots = new Map<string, Snapshot[]>();
  private active = new Map<string, string>();
  private previews = new Map<string, Preview>();
  /** A per-site promise chain — the mutex that makes `'serialized'` true rather than aspirational. */
  private queues = new Map<string, Promise<unknown>>();
  private counter = 0;

  constructor(opts: MemoryBrandThemeStoreOptions = {}) {
    super();
    this.now = opts.now ?? (() => new Date());
  }

  /** Not part of `BrandThemeStore` — a dev/test convenience, e.g. between conformance-suite runs. */
  clear(): void {
    this.configs.clear();
    this.snapshots.clear();
    this.active.clear();
    this.previews.clear();
    this.queues.clear();
  }

  /** Not part of `BrandThemeStore` — a dev/test convenience. Skips version and concurrency checks entirely. */
  seed(data: SeedData): void {
    for (const config of data.configs ?? []) this.configs.set(config.siteId, structuredClone(config));
    for (const snapshot of data.snapshots ?? []) {
      const list = this.snapshots.get(snapshot.siteId) ?? [];
      list.push(structuredClone(snapshot));
      this.snapshots.set(snapshot.siteId, list);
    }
    for (const [siteId, snapshotId] of data.active ?? []) this.active.set(siteId, snapshotId);
    for (const preview of data.previews ?? []) this.previews.set(preview.id, structuredClone(preview));
  }

  /** Not part of `BrandThemeStore` — for debugging a local dev server. */
  dump(): { configs: BrandConfig[]; snapshots: Snapshot[]; previews: Preview[] } {
    return {
      configs: structuredClone([...this.configs.values()]),
      snapshots: structuredClone([...this.snapshots.values()].flat()),
      previews: structuredClone([...this.previews.values()]),
    };
  }

  private nextId(prefix: string): string {
    this.counter += 1;
    return `${prefix}-${this.counter}`;
  }

  /** Serializes every write for one site — `publish`, `saveConfig` and `rollback` alike — behind one queue. */
  private enqueue<T>(siteId: string, task: () => Promise<T>): Promise<T> {
    const prior = this.queues.get(siteId) ?? Promise.resolve();
    const settled = prior.then(task, task);
    this.queues.set(
      siteId,
      settled.then(
        () => undefined,
        () => undefined,
      ),
    );
    return settled;
  }

  override async getConfig(siteId: string): Promise<BrandConfig | null> {
    const config = this.configs.get(siteId);
    return config === undefined ? null : structuredClone(config);
  }

  override async saveConfig(
    siteId: string,
    patch: Partial<BrandConfig>,
    expectedVersion: number,
  ): Promise<BrandConfig> {
    return this.enqueue(siteId, async () => {
      const current = this.configs.get(siteId);
      const currentVersion = current?.version ?? 0;
      if (currentVersion !== expectedVersion) {
        throw new ConflictError(
          `saveConfig(${siteId}): expected version ${expectedVersion}, current is ${currentVersion}`,
        );
      }
      const next: BrandConfig = {
        siteId,
        brandColor: patch.brandColor ?? current?.brandColor ?? '#000000',
        controlConfig: patch.controlConfig ?? current?.controlConfig ?? defaultControlConfig(),
        // Shallow-merged, not replaced: each bag holds many independent
        // fields' values, and a patch touching one must not erase another
        // (rules.md, rule 4's note).
        fieldValues: { ...current?.fieldValues, ...patch.fieldValues },
        rawOverrides: { ...current?.rawOverrides, ...patch.rawOverrides },
        passthrough: { ...current?.passthrough, ...patch.passthrough },
        schemaVersion: patch.schemaVersion ?? current?.schemaVersion ?? 1,
        version: currentVersion + 1,
        updatedAt: this.now().toISOString(),
        ...((patch.updatedBy ?? current?.updatedBy) !== undefined
          ? { updatedBy: (patch.updatedBy ?? current?.updatedBy) as string }
          : {}),
      };
      this.configs.set(siteId, structuredClone(next));
      return structuredClone(next);
    });
  }

  override async publish(
    siteId: string,
    input: PublishInput,
    opts?: { expectedConfigVersion?: number },
  ): Promise<Snapshot> {
    return this.enqueue(siteId, async () => {
      if (opts?.expectedConfigVersion !== undefined) {
        const actual = this.configs.get(siteId)?.version ?? 0;
        if (actual !== opts.expectedConfigVersion) {
          throw new ConflictError(
            `publish(${siteId}): expected config version ${opts.expectedConfigVersion}, current is ${actual}`,
          );
        }
      }

      const list = this.snapshots.get(siteId) ?? [];
      const activeId = this.active.get(siteId);
      const activeSnapshot = activeId !== undefined ? list.find((s) => s.id === activeId) : undefined;
      if (activeSnapshot !== undefined && activeSnapshot.checksum === input.checksum) {
        return structuredClone(activeSnapshot); // rule 3
      }

      const snapshot: Snapshot = {
        id: this.nextId('snap'),
        siteId,
        version: list.length + 1,
        tokens: input.tokens,
        cssText: input.cssText,
        checksum: input.checksum,
        cssSha256: input.cssSha256,
        sourceConfigVersion: this.configs.get(siteId)?.version ?? 0,
        schemaVersion: input.tokens.meta.schemaVersion,
        publishedAt: this.now().toISOString(),
        ...(input.publishedBy !== undefined ? { publishedBy: input.publishedBy } : {}),
      };
      // Append-only: never mutate a stored snapshot, only ever push a new one.
      list.push(structuredClone(snapshot));
      this.snapshots.set(siteId, list);
      this.active.set(siteId, snapshot.id);
      return structuredClone(snapshot);
    });
  }

  override async getActiveSnapshot(siteId: string): Promise<Snapshot | null> {
    const id = this.active.get(siteId);
    if (id === undefined) return null;
    const list = this.snapshots.get(siteId) ?? [];
    const found = list.find((s) => s.id === id);
    return found === undefined ? null : structuredClone(found);
  }

  override async listSnapshots(siteId: string, opts?: { limit?: number }): Promise<Snapshot[]> {
    const list = this.snapshots.get(siteId) ?? [];
    const sliced = opts?.limit !== undefined ? list.slice(0, opts.limit) : list;
    return structuredClone(sliced);
  }

  override async rollback(siteId: string, snapshotId: string): Promise<void> {
    await this.enqueue(siteId, async () => {
      const list = this.snapshots.get(siteId) ?? [];
      const found = list.find((s) => s.id === snapshotId);
      if (found === undefined) {
        throw new NotFoundError(`rollback(${siteId}): no snapshot ${snapshotId}`);
      }
      // A pointer move only — rollback never regenerates and never touches
      // the snapshot rows themselves (rule 6).
      this.active.set(siteId, snapshotId);
    });
  }

  override async createPreview(siteId: string, input: PreviewInput): Promise<Preview> {
    const preview: Preview = {
      id: this.nextId('preview'),
      siteId,
      tokens: input.tokens,
      cssText: input.cssText,
      expiresAt: input.expiresAt.toISOString(),
      ...(input.createdBy !== undefined ? { createdBy: input.createdBy } : {}),
    };
    this.previews.set(preview.id, structuredClone(preview));
    return structuredClone(preview);
  }

  override async getPreview(previewId: string): Promise<Preview | null> {
    const preview = this.previews.get(previewId);
    if (preview === undefined) return null;
    if (new Date(preview.expiresAt).getTime() < this.now().getTime()) return null;
    return structuredClone(preview);
  }
}
