"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface FieldRowProps {
  id: string;
  label: string;
  /** Always passed (possibly `undefined`) from `FieldControl` — a required key of a union type, not an omittable one, so `exactOptionalPropertyTypes` doesn't reject the call site. */
  description: string | undefined;
  error: string | null;
  dirty: boolean;
  children: ReactNode;
  className?: string;
}

/** The ids a control's own `aria-describedby` should list — computed once here so every control agrees on the scheme. */
export function fieldDescribedBy(id: string, opts: { description: string | undefined; error: string | null }): string | undefined {
  const descriptionId = opts.description ? `${id}-description` : undefined;
  const errorId = opts.error ? `${id}-error` : undefined;
  return [descriptionId, errorId].filter(Boolean).join(" ") || undefined;
}

/**
 * `FieldRow`'s group heading id. A single-input control (`TextControl`,
 * `SliderControl`, the `<Select>` branch of `SelectControl`, the lone swatch
 * in `ColorControl`) points its own `aria-labelledby` here — `role="group"`
 * alone only announces the name on entering the group, not on the input
 * itself. Multi-part controls skip this and give each sub-item its own
 * `aria-label` instead (`SemanticColorsControl`, the logo's light/dark pair).
 */
export function fieldHeadingId(id: string): string {
  return `${id}-heading`;
}

/**
 * Label + optional description + control + field-level error, as an ARIA
 * group rather than a `<label htmlFor>` — some controls here are a single
 * input (`htmlFor` would work), others are several (`semanticColors`'
 * four swatches, the logo's light/dark pair), and a group heading is the
 * one relationship that's correct for both. The control itself (passed as
 * `children`) still wires its own `aria-describedby` via `fieldDescribedBy`.
 */
export function FieldRow({ id, label, description, error, dirty, children, className }: FieldRowProps) {
  const headingId = fieldHeadingId(id);
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div role="group" aria-labelledby={headingId} className={cn("grid gap-1.5", className)}>
      <span id={headingId} className="flex items-center gap-1.5 text-sm font-medium leading-none">
        {label}
        {dirty ? (
          <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" title="Unsaved change" />
        ) : null}
      </span>
      {description ? (
        <p id={descriptionId} className="text-xs text-muted-foreground">
          {description}
        </p>
      ) : null}
      {children}
      {error ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
