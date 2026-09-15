"use client";

import type { GenerateResult } from "@pxlhut/brand-core";
import { SEMANTIC_COLOR_ROLES, type SemanticColorRole } from "@pxlhut/brand-store/service";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";

import { fieldDescribedBy, fieldHeadingId } from "../field-row";

type Violation = GenerateResult["violations"][number];

/**
 * The APCA feedback the owner actually experiences (step 16's own framing):
 * a picker reports a colour won't pass *before* Publish is pressed, not
 * after. `violations` is already the same list a rejected publish would
 * report — this just surfaces it live.
 */
export function ColorViolations({ violations }: { violations: readonly Violation[] }) {
  if (violations.length === 0) return null;
  return (
    <Alert variant="destructive">
      <AlertDescription>
        <ul className="list-disc space-y-0.5 pl-4">
          {violations.map((violation, index) => (
            // Light and dark mode can each independently fail the same `fg`/`bg` pairing, so the pairing alone isn't a unique key.
            <li key={`${violation.fg}-${violation.bg}-${index}`}>
              <code className="text-xs">{violation.fg}</code> on <code className="text-xs">{violation.bg}</code> needs
              contrast Lc {violation.min}, got {violation.got}
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}

function ColorSwatchInput({
  id,
  label,
  labelledBy,
  value,
  setValue,
  describedBy,
  invalid,
}: {
  id: string;
  label: string;
  /** When the field has exactly one swatch, name it from `FieldRow`'s own heading instead of a generic `label` string. */
  labelledBy?: string;
  value: string;
  setValue: (value: string) => void;
  describedBy: string | undefined;
  invalid?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        aria-label={`${label} swatch`}
        value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000"}
        onChange={(event) => setValue(event.target.value)}
        className="size-8 shrink-0 cursor-pointer rounded-md border border-input bg-transparent p-0.5"
      />
      <Input
        id={id}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="#7c6cff"
        aria-label={labelledBy ? undefined : label}
        aria-labelledby={labelledBy}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
        className="font-mono"
      />
    </div>
  );
}

export interface ColorControlProps {
  id: string;
  value: string;
  setValue: (value: string) => void;
  violations: readonly Violation[];
  error: string | null;
  description: string | undefined;
}

/** `direct: color` on a single-value field (`brandColor`). `semanticColors` uses `SemanticColorsControl` instead — its value is a role map, not one hex string. */
export function ColorControl({ id, value, setValue, violations, error, description }: ColorControlProps) {
  return (
    <div className="grid gap-2">
      <ColorSwatchInput
        id={id}
        label="Colour"
        labelledBy={fieldHeadingId(id)}
        value={value}
        setValue={setValue}
        describedBy={fieldDescribedBy(id, { description, error })}
        invalid={Boolean(error)}
      />
      <ColorViolations violations={violations} />
    </div>
  );
}

const SEMANTIC_LABELS: Record<SemanticColorRole, string> = {
  destructive: "Error",
  success: "Success",
  warning: "Warning",
  info: "Info",
};

export interface SemanticColorsControlProps {
  id: string;
  value: Partial<Record<SemanticColorRole, string>>;
  setValue: (value: Partial<Record<SemanticColorRole, string>>) => void;
  violations: readonly Violation[];
  error: string | null;
  description: string | undefined;
}

/** `semanticColors` at `direct` tier (§34) — four fixed roles, each still a real colour the owner picks and each still APCA-gated. */
export function SemanticColorsControl({ id, value, setValue, violations, error, description }: SemanticColorsControlProps) {
  const describedBy = fieldDescribedBy(id, { description, error });
  return (
    <div className="grid gap-2">
      <div className="grid grid-cols-2 gap-2">
        {SEMANTIC_COLOR_ROLES.map((role) => (
          <ColorSwatchInput
            key={role}
            id={`${id}-${role}`}
            label={SEMANTIC_LABELS[role]}
            value={value[role] ?? ""}
            setValue={(next) => setValue({ ...value, [role]: next })}
            describedBy={describedBy}
            invalid={Boolean(error)}
          />
        ))}
      </div>
      <ColorViolations violations={violations} />
    </div>
  );
}
