"use client";

import { Input } from "@/components/ui/input";

import { fieldDescribedBy, fieldHeadingId } from "../field-row";

export interface TextControlProps {
  id: string;
  value: string;
  setValue: (value: string) => void;
  error: string | null;
  description: string | undefined;
  placeholder?: string;
  /** Free text (`direct: text`) vs. a constrained value the owner still types by hand (`direct: length`, `direct: number`). */
  type?: "text" | "url" | "number";
  inputMode?: "text" | "numeric" | "decimal";
}

/** `direct: text`, `direct: length` and `direct: number` all read as a single validated input — the value validator (step 07) is the enforcement boundary, not this control (§9). */
export function TextControl({ id, value, setValue, error, description, placeholder, type = "text", inputMode }: TextControlProps) {
  return (
    <Input
      id={id}
      type={type}
      inputMode={inputMode}
      value={value}
      onChange={(event) => setValue(event.target.value)}
      placeholder={placeholder}
      aria-invalid={error ? true : undefined}
      aria-labelledby={fieldHeadingId(id)}
      aria-describedby={fieldDescribedBy(id, { description, error })}
    />
  );
}
