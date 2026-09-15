/**
 * Publish state (§7 step 2, §22). `canPublish` gates on the live preview's
 * own violations — the same computation a rejected publish would report —
 * so a contrast failure is visible before the owner ever presses Publish,
 * per step 16's own framing of what makes this an accessibility feature and
 * not a validation error to interpret after the fact.
 *
 * A publish always flushes any pending draft save first: `onPublish` is
 * wired to the *server's* current config, and shipping whatever is on
 * screen — not whatever was last written 400 ms ago — is the whole point of
 * calling this before every publish attempt. If that flush doesn't land
 * (a conflict, or any other save failure), publish aborts rather than
 * proceeding to publish a config that doesn't include the owner's latest,
 * unsaved edit — the `conflict` flag `usePublish` was constructed with is a
 * snapshot from the render that called `publish()`, which a `flush()` awaited
 * *inside* that same call can't retroactively update, so the abort decision
 * reads `flush()`'s own return value instead of that prop.
 */

import { useCallback, useMemo, useState } from 'react';
import type { FieldId } from '@pxlhut/brand-core';
import type { PublishResult } from '@pxlhut/brand-store/service';

import type { FlushOutcome } from '../drafting/index.js';
import type { PreviewResult } from '../preview/index.js';

/** Thrown when `publish()` had to abort because the preceding flush didn't land — never a tier or contrast problem, which `publishErrors`/`preview.violations` already cover. */
export class PublishAbortedError extends Error {
  constructor(public readonly reason: 'conflict' | 'error') {
    super(`publish aborted: the pending draft save did not complete (${reason})`);
    this.name = 'PublishAbortedError';
  }
}

export interface UsePublishOptions {
  onPublish: () => Promise<PublishResult>;
  /** Flushes any pending draft save; resolves once the server has the latest edit, or reports why it couldn't. */
  flush: () => Promise<FlushOutcome>;
  preview: PreviewResult;
  conflict: boolean;
}

export interface UsePublishResult {
  canPublish: boolean;
  publishing: boolean;
  publishErrors: Partial<Record<FieldId, string>>;
  lastResult: PublishResult | null;
  publish: () => Promise<PublishResult>;
}

export function usePublish({ onPublish, flush, preview, conflict }: UsePublishOptions): UsePublishResult {
  const [publishing, setPublishing] = useState(false);
  const [lastResult, setLastResult] = useState<PublishResult | null>(null);

  const publish = useCallback(async (): Promise<PublishResult> => {
    setPublishing(true);
    try {
      const flushed = await flush();
      if (flushed === 'conflict' || flushed === 'error') {
        throw new PublishAbortedError(flushed);
      }
      const result = await onPublish();
      setLastResult(result);
      return result;
    } finally {
      setPublishing(false);
    }
  }, [flush, onPublish]);

  const publishErrors = useMemo(() => {
    if (lastResult === null || lastResult.ok) return {};
    const out: Partial<Record<FieldId, string>> = {};
    for (const violation of lastResult.violations) {
      const field = preview.fieldForViolation(violation);
      out[field] = `${violation.fg} on ${violation.bg} needs contrast Lc ${violation.min}, got ${violation.got}`;
    }
    return out;
  }, [lastResult, preview]);

  const canPublish = preview.violations.length === 0 && !conflict;

  return { canPublish, publishing, publishErrors, lastResult, publish };
}
