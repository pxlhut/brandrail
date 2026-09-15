"use client";

import { Slider } from "@/components/ui/slider";

import { fieldDescribedBy, fieldHeadingId } from "../field-row";

export interface SliderControlProps {
  id: string;
  /** The hook stores every scalar field as a string (§13's `DraftPatch` shape) — parsed here, formatted back on change. */
  value: string;
  setValue: (value: string) => void;
  min: number;
  max: number;
  step: number | undefined;
  error: string | null;
  description: string | undefined;
}

/** §31's continuous shape — right for elevation, wrong for radius (that's `SelectControl`). */
export function SliderControl({ id, value, setValue, min, max, step, error, description }: SliderControlProps) {
  const numeric = Number(value);
  const current = Number.isFinite(numeric) ? numeric : min;

  return (
    <div className="flex items-center gap-3">
      <Slider
        id={id}
        value={[current]}
        min={min}
        max={max}
        step={step ?? 1}
        onValueChange={(next) => {
          // Some slider implementations report a lone thumb as a plain `number`, others as `number[]` — this control only ever renders one thumb.
          const resolved = Array.isArray(next) ? next[0] : next;
          if (resolved !== undefined) setValue(String(resolved));
        }}
        aria-labelledby={fieldHeadingId(id)}
        aria-describedby={fieldDescribedBy(id, { description, error })}
        aria-invalid={error ? true : undefined}
        className="flex-1"
      />
      <output htmlFor={id} className="w-10 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
        {current}
      </output>
    </div>
  );
}
