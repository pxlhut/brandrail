"use client";

import type { LogoVariant, LogoVariantState } from "@pxlhut/brand-editor";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { fieldDescribedBy } from "../field-row";

export interface AssetControlProps {
  id: string;
  light: LogoVariantState;
  dark: LogoVariantState;
  error: string | null;
  description: string | undefined;
}

const VARIANT_META: Record<LogoVariant, { label: string; previewClassName: string }> = {
  light: { label: "Light background", previewClassName: "bg-white" },
  dark: { label: "Dark background", previewClassName: "bg-neutral-900" },
};

function VariantUploader({
  variant,
  variantId,
  state,
  describedBy,
}: {
  variant: LogoVariant;
  variantId: string;
  state: LogoVariantState;
  describedBy: string | undefined;
}) {
  const meta = VARIANT_META[variant];
  return (
    <div className="grid gap-1.5">
      <div className={`flex h-16 items-center justify-center rounded-lg border border-dashed border-input ${meta.previewClassName}`}>
        {state.url ? (
          // Plain `<img>`, not `next/image` — the upload host is consumer-controlled and arbitrary, so a fixed loader config can't be assumed here.
          <img src={state.url} alt={`${meta.label} logo preview`} className="max-h-12 max-w-[80%] object-contain" />
        ) : (
          <span className="text-xs text-muted-foreground">No logo yet</span>
        )}
      </div>
      <Label htmlFor={variantId} className="text-xs font-normal text-muted-foreground">
        {meta.label}
      </Label>
      <Input
        id={variantId}
        type="file"
        accept="image/*"
        disabled={state.uploading}
        aria-describedby={describedBy}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void state.upload(file);
          event.target.value = "";
        }}
      />
      {state.uploading ? <p className="text-xs text-muted-foreground">Uploading…</p> : null}
      {state.error ? (
        <p role="alert" className="text-xs font-medium text-destructive">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * §36: a dark-mode logo is not optional, so both variants are always shown
 * side by side rather than a single upload plus a later-added "add a dark
 * variant" affordance.
 */
export function AssetControl({ id, light, dark, error, description }: AssetControlProps) {
  const describedBy = fieldDescribedBy(id, { description, error });
  return (
    <div className="grid grid-cols-2 gap-3">
      <VariantUploader variant="light" variantId={`${id}-light`} state={light} describedBy={describedBy} />
      <VariantUploader variant="dark" variantId={`${id}-dark`} state={dark} describedBy={describedBy} />
    </div>
  );
}
