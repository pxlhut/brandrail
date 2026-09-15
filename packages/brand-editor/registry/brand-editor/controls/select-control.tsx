"use client";

import type { KeyboardEvent } from "react";
import type { SelectOption } from "@pxlhut/brand-core";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { fieldDescribedBy, fieldHeadingId } from "../field-row";

export interface SelectControlProps {
  id: string;
  value: string;
  setValue: (value: string) => void;
  options: readonly SelectOption[];
  error: string | null;
  description: string | undefined;
}

/**
 * A plain `role="radiogroup"` of `Button`s rather than shadcn's own
 * `ToggleGroup` — that component's underlying value shape (single value vs.
 * an array) differs across the base libraries shadcn now ships (Base UI,
 * Radix, React Aria), and every consumer's copy of this file has to compile
 * against whichever one their own project uses. `Button` and native
 * `role="radio"` semantics don't have that problem. Arrow keys move the
 * roving tab stop, matching native radio-group behaviour.
 */
function SegmentedControl({
  id,
  value,
  setValue,
  options,
  describedBy,
  labelledBy,
  invalid,
}: {
  id: string;
  value: string;
  setValue: (value: string) => void;
  options: readonly SelectOption[];
  describedBy: string | undefined;
  labelledBy: string;
  invalid: boolean;
}) {
  const move = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const index = options.findIndex((option) => option.value === value);
    const delta = event.key === "ArrowRight" ? 1 : -1;
    const next = options[(index + delta + options.length) % options.length];
    if (next) {
      setValue(next.value);
      document.getElementById(`${id}-${next.value}`)?.focus();
    }
  };

  return (
    <div
      id={id}
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      onKeyDown={move}
      className="flex flex-wrap gap-1.5"
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Button
            key={option.value}
            id={`${id}-${option.value}`}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            variant={selected ? "default" : "outline"}
            size="sm"
            onClick={() => setValue(option.value)}
          >
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}

/**
 * §31's two Guided shapes are different renders, and within `select` there's
 * a second split step 17 owns: a segmented control reads better than a
 * dropdown for a handful of choices, but stops scaling past that — a
 * `<Select>` takes over once there are more than four (matches the
 * Sharp/Soft/Round, Compact/Comfortable, Warm/Cool, Solid/Outline options,
 * all ≤4, while the five curated fonts fall through to `<Select>`).
 */
export function SelectControl({ id, value, setValue, options, error, description }: SelectControlProps) {
  const describedBy = fieldDescribedBy(id, { description, error });

  if (options.length <= 4) {
    return (
      <SegmentedControl
        id={id}
        value={value}
        setValue={setValue}
        options={options}
        describedBy={describedBy}
        labelledBy={fieldHeadingId(id)}
        invalid={Boolean(error)}
      />
    );
  }

  return (
    <Select
      value={value}
      onValueChange={(next) => {
        if (next) setValue(next);
      }}
    >
      <SelectTrigger
        id={id}
        className="w-full"
        aria-labelledby={fieldHeadingId(id)}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
