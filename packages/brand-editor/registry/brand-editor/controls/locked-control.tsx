"use client";

import { LockIcon } from "lucide-react";

export interface LockedControlProps {
  id: string;
  /** `undefined` when the developer didn't pin a display value (§33 — the value is still derived, just not shown as literal text here). */
  value: string | undefined;
}

/**
 * Step 17's own framing: **show it, don't hide it.** An owner seeing
 * "Semantic colours · managed by the platform" understands the product; a
 * missing field looks like a bug. The explanation is real, visible text —
 * not `sr-only` — so it reaches sighted and screen-reader users the same way.
 */
export function LockedControl({ id, value }: LockedControlProps) {
  return (
    <div
      id={id}
      className="flex h-8 items-center justify-between gap-2 rounded-lg border border-input bg-muted/40 px-2.5 text-sm text-muted-foreground"
    >
      <span className="truncate">{value && value.length > 0 ? value : "Set by the platform"}</span>
      <span className="inline-flex shrink-0 items-center gap-1 text-xs">
        <LockIcon aria-hidden="true" className="size-3" />
        Managed by the platform
      </span>
    </div>
  );
}
