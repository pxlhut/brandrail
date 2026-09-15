"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export interface PublishBarProps {
  dirty: boolean;
  saving: boolean;
  saveError: string | null;
  /** An `onPublish` rejection that wasn't a conflict abort or a contrast rejection — e.g. the consumer's own API route threw. Neither of those two other cases reach here: a conflict is `conflict`, and a contrast rejection resolves normally into per-field errors instead of throwing. */
  publishError: string | null;
  conflict: boolean;
  canPublish: boolean;
  publishing: boolean;
  onPublish: () => void;
  /** Wired by the consumer to refetch the site's current config; `undefined` to just show the conflict message with no action (also `undefined` transiently while a reload is already in flight). */
  onReloadRequested: (() => void) | undefined;
}

function statusText(dirty: boolean, saving: boolean, saveError: string | null): string {
  if (saveError) return "Draft save failed";
  if (saving) return "Saving…";
  if (dirty) return "Unsaved changes";
  return "All changes saved";
}

/**
 * Dirty state, `canPublish`, and the conflict signal step 16's own hook
 * makes distinct from a generic error (§22) — a stale `expectedVersion`
 * needs "someone else changed this" messaging, not a toast that reads like
 * this owner's own save failed.
 */
export function PublishBar({
  dirty,
  saving,
  saveError,
  publishError,
  conflict,
  canPublish,
  publishing,
  onPublish,
  onReloadRequested,
}: PublishBarProps) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <p aria-live="polite" className="text-sm text-muted-foreground">
          {statusText(dirty, saving, saveError)}
        </p>
        <Button type="button" onClick={onPublish} disabled={!canPublish || publishing}>
          {publishing ? "Publishing…" : "Publish"}
        </Button>
      </div>

      {conflict ? (
        <Alert variant="destructive">
          <AlertTitle>Someone else changed this</AlertTitle>
          <AlertDescription>
            {onReloadRequested ? (
              <span className="flex items-center justify-between gap-2">
                This draft is out of date.
                <Button type="button" size="sm" variant="outline" onClick={onReloadRequested}>
                  Reload latest
                </Button>
              </span>
            ) : (
              "This draft is out of date. Reload the page to see the latest version."
            )}
          </AlertDescription>
        </Alert>
      ) : null}

      {saveError ? (
        <Alert variant="destructive">
          <AlertDescription>{saveError}</AlertDescription>
        </Alert>
      ) : null}

      {publishError ? (
        <Alert variant="destructive">
          <AlertTitle>Publish failed</AlertTitle>
          <AlertDescription>{publishError}</AlertDescription>
        </Alert>
      ) : null}

      {!canPublish && !conflict ? (
        <p className="text-xs text-muted-foreground">Resolve the contrast issues below before publishing.</p>
      ) : null}
    </div>
  );
}
