/**
 * Draft state: the mutable `BrandConfig` the owner is editing, the 400 ms
 * debounced save (§3), and the `ConflictError` signal (§22).
 *
 * `setField` runs `enforceTiers` (the exact function `saveDraft` runs
 * server-side, from `@pxlhut/brand-store/service`) synchronously, so the
 * owner sees a tier or syntax error as they type — and the server call still
 * runs independently afterward, because the UI is never the enforcement
 * boundary (§9). Reusing the real function, rather than a client-side
 * approximation of it, is what guarantees the two can't drift apart.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BrandConfig, ControlConfig, FieldId } from '@pxlhut/brand-core';
import { ConflictError } from '@pxlhut/brand-store';
import { enforceTiers, TierViolationError, type DraftPatch } from '@pxlhut/brand-store/service';

const DEFAULT_DEBOUNCE_MS = 400;

/** One field's contribution to the patch about to be flushed, keyed the way `DraftPatch` itself is keyed. */
type PendingPatch = Partial<Omit<DraftPatch, 'expectedVersion'>>;

function mergePendingValue(pending: PendingPatch, id: FieldId, value: unknown): PendingPatch {
  if (id === 'logo') {
    const current = (pending.logo ?? {}) as { light?: string; dark?: string };
    return { ...pending, logo: { ...current, ...(value as { light?: string; dark?: string }) } };
  }
  if (id === 'semanticColors') {
    const current = pending.semanticColors ?? {};
    return { ...pending, semanticColors: { ...current, ...(value as object) } };
  }
  if (id === 'advancedTokens') {
    const current = pending.advancedTokens ?? {};
    return { ...pending, advancedTokens: { ...current, ...(value as object) } };
  }
  return { ...pending, [id]: value };
}

/** Applies an already-validated `EnforcedPatch` onto a draft, the same shallow-merge `BrandThemeStore.saveConfig` itself promises for `fieldValues`/`rawOverrides`/`passthrough` — a patch touching one field must never erase another. */
function applyEnforced(draft: BrandConfig, enforced: ReturnType<typeof enforceTiers>): BrandConfig {
  return {
    ...draft,
    ...(enforced.brandColor !== undefined ? { brandColor: enforced.brandColor } : {}),
    fieldValues: { ...draft.fieldValues, ...enforced.fieldValues },
    rawOverrides: { ...draft.rawOverrides, ...enforced.rawOverrides },
    passthrough: { ...draft.passthrough, ...enforced.passthrough },
  };
}

export interface UseDraftOptions {
  initial: BrandConfig;
  /**
   * The vendor's *current* tier authority — kept separate from
   * `initial.controlConfig` because a caller may update it across renders
   * (a plan upgrade, a demo flipping a field live) without re-fetching the
   * whole `BrandConfig` (acceptance criterion 4).
   */
  controlConfig: ControlConfig;
  onSave: (patch: DraftPatch) => Promise<BrandConfig>;
  /** @default 400 — §3: short enough to feel instant, long enough that a fast slider drag produces one write. */
  debounceMs?: number;
}

/**
 * What a `flush()` call actually accomplished — `publish()` (`publishing/`)
 * needs to tell "nothing to send, safe to proceed" apart from "there *was*
 * something pending and it did not make it to the server," which a bare
 * `Promise<void>` can't express. `dirty`/`conflict` update React state for
 * rendering; this is the same information returned synchronously to the one
 * caller (a publish) that has to make a decision before its next render.
 */
export type FlushOutcome = 'flushed' | 'nothing-pending' | 'conflict' | 'error';

export interface UseDraftResult {
  draft: BrandConfig;
  fieldErrors: Partial<Record<FieldId, string>>;
  dirty: ReadonlySet<FieldId>;
  /** A save was rejected for a stale `expectedVersion` (§22) — distinct from any other error. */
  conflict: boolean;
  saveError: string | null;
  saving: boolean;
  setField: (id: FieldId, value: unknown) => void;
  /** Sends any pending edits now, bypassing the debounce. Publish calls this first — a publish must never ship a draft older than what's on screen. */
  flush: () => Promise<FlushOutcome>;
  /** Replace the local draft with a freshly-fetched one — e.g. after the owner chooses to reload following a conflict. */
  reload: (config: BrandConfig) => void;
}

export function useDraft({
  initial,
  controlConfig,
  onSave,
  debounceMs = DEFAULT_DEBOUNCE_MS,
}: UseDraftOptions): UseDraftResult {
  const [draft, setDraft] = useState(initial);
  const [tierErrors, setTierErrors] = useState<Partial<Record<FieldId, string>>>({});
  const [dirty, setDirty] = useState<ReadonlySet<FieldId>>(new Set());
  const [conflict, setConflict] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const draftRef = useRef(draft);
  draftRef.current = draft;
  const controlConfigRef = useRef(controlConfig);
  controlConfigRef.current = controlConfig;
  const pendingRef = useRef<PendingPatch>({});
  const pendingFieldsRef = useRef<Set<FieldId>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const savingRef = useRef(false);
  const flushAgainRef = useRef(false);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  const runFlush = useCallback(async (): Promise<FlushOutcome> => {
    if (savingRef.current) {
      flushAgainRef.current = true;
      return 'nothing-pending';
    }
    if (pendingFieldsRef.current.size === 0) return 'nothing-pending';

    const sent = pendingRef.current;
    const fieldsSent = pendingFieldsRef.current;
    pendingRef.current = {};
    pendingFieldsRef.current = new Set();

    savingRef.current = true;
    setSaving(true);
    let outcome: FlushOutcome;
    try {
      const saved = await onSaveRef.current({ ...sent, expectedVersion: draftRef.current.version });
      setDraft(saved);
      setConflict(false);
      setSaveError(null);
      setDirty((prev) => {
        const next = new Set(prev);
        for (const id of fieldsSent) next.delete(id);
        return next;
      });
      outcome = 'flushed';
    } catch (err) {
      // Whatever wasn't saved goes back on the queue rather than being lost.
      pendingRef.current = { ...sent, ...pendingRef.current };
      for (const id of fieldsSent) pendingFieldsRef.current.add(id);
      if (err instanceof ConflictError) {
        setConflict(true);
        outcome = 'conflict';
      } else {
        setSaveError(err instanceof Error ? err.message : String(err));
        outcome = 'error';
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }

    if (flushAgainRef.current) {
      flushAgainRef.current = false;
      return runFlush();
    }
    return outcome;
  }, []);

  const scheduleFlush = useCallback(() => {
    if (timerRef.current !== undefined) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = undefined;
      void runFlush();
    }, debounceMs);
  }, [debounceMs, runFlush]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== undefined) clearTimeout(timerRef.current);
    };
  }, []);

  const setField = useCallback(
    (id: FieldId, value: unknown) => {
      const patch: DraftPatch = { expectedVersion: draftRef.current.version, [id]: value } as DraftPatch;
      let enforced;
      try {
        enforced = enforceTiers(patch, controlConfigRef.current);
      } catch (err) {
        if (err instanceof TierViolationError) {
          setTierErrors((prev) => ({ ...prev, [id]: err.message }));
          return;
        }
        throw err;
      }

      setTierErrors((prev) => {
        if (prev[id] === undefined) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setDraft((current) => applyEnforced(current, enforced));
      setDirty((prev) => new Set(prev).add(id));
      pendingRef.current = mergePendingValue(pendingRef.current, id, value);
      pendingFieldsRef.current.add(id);
      scheduleFlush();
    },
    [scheduleFlush],
  );

  const flush = useCallback(async (): Promise<FlushOutcome> => {
    if (timerRef.current !== undefined) {
      clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
    return runFlush();
  }, [runFlush]);

  const reload = useCallback((config: BrandConfig) => {
    if (timerRef.current !== undefined) {
      clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
    pendingRef.current = {};
    pendingFieldsRef.current = new Set();
    setDraft(config);
    setDirty(new Set());
    setConflict(false);
    setSaveError(null);
    setTierErrors({});
  }, []);

  return useMemo(
    () => ({ draft, fieldErrors: tierErrors, dirty, conflict, saveError, saving, setField, flush, reload }),
    [draft, tierErrors, dirty, conflict, saveError, saving, setField, flush, reload],
  );
}
