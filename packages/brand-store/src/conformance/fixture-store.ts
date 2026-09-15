/**
 * A minimal, in-memory `BrandThemeStore` — test-only infrastructure for
 * validating the conformance suite *itself*, not a real adapter (that's
 * step 12's `@pxlhut/brand-store/memory`, a separate, from-scratch
 * deliverable). Never imported from `conformance/index.ts`'s public barrel,
 * so it never reaches the published `@pxlhut/brand-store/conformance`
 * entry point.
 *
 * `serializePublish` exists to construct a *deliberately broken* instance:
 * `false` makes concurrent `publish()` calls race (read-then-write with no
 * lock), while `capabilities` can still independently claim
 * `'transactional'` — the exact over-claim step 11's acceptance criterion
 * requires the suite to catch.
 */

import { defaultControlConfig } from '@pxlhut/brand-core';
import type { BrandConfig, Preview, Snapshot } from '@pxlhut/brand-core';

import {
  BaseBrandThemeStore,
  ConflictError,
  NotFoundError,
  type PreviewInput,
  type PublishInput,
  type StoreCapabilities,
} from '../contract/index.js';

export interface FixtureStoreOptions {
  capabilities?: StoreCapabilities;
  /** @default true */
  serializePublish?: boolean;
}

export class FixtureStore extends BaseBrandThemeStore {
  readonly capabilities: StoreCapabilities;
  private readonly serializePublish: boolean;

  private configs = new Map<string, BrandConfig>();
  private snapshots = new Map<string, Snapshot[]>();
  private active = new Map<string, string>();
  private previews = new Map<string, Preview>();
  private queues = new Map<string, Promise<unknown>>();
  private counter = 0;

  constructor(opts: FixtureStoreOptions = {}) {
    super();
    this.capabilities = opts.capabilities ?? { atomicPublish: 'transactional' };
    this.serializePublish = opts.serializePublish ?? true;
  }

  /** Not part of `BrandThemeStore` — called by this test's own `reset` between tests. */
  clear(): void {
    this.configs.clear();
    this.snapshots.clear();
    this.active.clear();
    this.previews.clear();
    this.queues.clear();
  }

  private nextId(prefix: string): string {
    this.counter += 1;
    return `${prefix}-${this.counter}`;
  }

  override async getConfig(siteId: string): Promise<BrandConfig | null> {
    return this.configs.get(siteId) ?? null;
  }

  override async saveConfig(
    siteId: string,
    patch: Partial<BrandConfig>,
    expectedVersion: number,
  ): Promise<BrandConfig> {
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
      rawOverrides: patch.rawOverrides ?? current?.rawOverrides ?? {},
      passthrough: patch.passthrough ?? current?.passthrough ?? {},
      schemaVersion: patch.schemaVersion ?? current?.schemaVersion ?? 1,
      version: currentVersion + 1,
      updatedAt: new Date().toISOString(),
      ...((patch.updatedBy ?? current?.updatedBy) !== undefined
        ? { updatedBy: (patch.updatedBy ?? current?.updatedBy) as string }
        : {}),
    };
    this.configs.set(siteId, next);
    return next;
  }

  override async publish(
    siteId: string,
    input: PublishInput,
    opts?: { expectedConfigVersion?: number; idempotencyKey?: string },
  ): Promise<Snapshot> {
    if (!this.serializePublish) {
      return this.doPublish(siteId, input, opts);
    }
    // A simple promise-chained mutex, per site: each publish waits for the
    // previous one to settle before it reads "the current version" — this
    // is what a real `'transactional'` claim requires under Promise.all.
    const prior = this.queues.get(siteId) ?? Promise.resolve();
    const task = prior.then(
      () => this.doPublish(siteId, input, opts),
      () => this.doPublish(siteId, input, opts),
    );
    this.queues.set(
      siteId,
      task.then(
        () => undefined,
        () => undefined,
      ),
    );
    return task;
  }

  private async doPublish(
    siteId: string,
    input: PublishInput,
    opts?: { expectedConfigVersion?: number },
  ): Promise<Snapshot> {
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
    const activeSnapshot = activeId ? list.find((s) => s.id === activeId) : undefined;
    if (activeSnapshot !== undefined && activeSnapshot.checksum === input.checksum) {
      return activeSnapshot; // rule 3
    }

    const nextVersion = list.length + 1;
    // Simulates the round-trip latency a real "read the current version,
    // then insert" adapter has over a network — a genuine gap where a
    // second concurrent call can interleave. Without it, this whole method
    // runs synchronously to completion (no other `await` in this file) and
    // JS's single-threaded model makes it atomic *by accident*, whether or
    // not `publish()` actually serializes per site — which would make the
    // deliberately-broken fixture (`serializePublish: false`) not actually
    // broken, and defeat the one test that has to be able to fail.
    await new Promise((resolve) => setTimeout(resolve, 1));

    const snapshot: Snapshot = {
      id: this.nextId('snap'),
      siteId,
      version: nextVersion,
      tokens: input.tokens,
      cssText: input.cssText,
      checksum: input.checksum,
      cssSha256: input.cssSha256,
      sourceConfigVersion: this.configs.get(siteId)?.version ?? 0,
      schemaVersion: input.tokens.meta.schemaVersion,
      publishedAt: new Date().toISOString(),
      ...(input.publishedBy !== undefined ? { publishedBy: input.publishedBy } : {}),
    };
    list.push(snapshot);
    this.snapshots.set(siteId, list);
    this.active.set(siteId, snapshot.id);
    return snapshot;
  }

  override async getActiveSnapshot(siteId: string): Promise<Snapshot | null> {
    const id = this.active.get(siteId);
    if (id === undefined) return null;
    const list = this.snapshots.get(siteId) ?? [];
    return list.find((s) => s.id === id) ?? null;
  }

  override async listSnapshots(siteId: string, opts?: { limit?: number }): Promise<Snapshot[]> {
    const list = [...(this.snapshots.get(siteId) ?? [])];
    return opts?.limit !== undefined ? list.slice(0, opts.limit) : list;
  }

  override async rollback(siteId: string, snapshotId: string): Promise<void> {
    const list = this.snapshots.get(siteId) ?? [];
    const found = list.find((s) => s.id === snapshotId);
    if (found === undefined) {
      throw new NotFoundError(`rollback(${siteId}): no snapshot ${snapshotId}`);
    }
    this.active.set(siteId, snapshotId);
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
    this.previews.set(preview.id, preview);
    return preview;
  }

  override async getPreview(previewId: string): Promise<Preview | null> {
    const preview = this.previews.get(previewId);
    if (preview === undefined) return null;
    if (new Date(preview.expiresAt).getTime() < Date.now()) return null;
    return preview;
  }
}
