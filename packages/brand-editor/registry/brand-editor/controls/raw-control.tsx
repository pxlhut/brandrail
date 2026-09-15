"use client";

import { useEffect, useState } from "react";
import type { GenerateResult } from "@pxlhut/brand-core";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import { fieldDescribedBy, fieldHeadingId } from "../field-row";
import { ColorViolations } from "./color-control";

type Violation = GenerateResult["violations"][number];

export interface RawControlProps {
  id: string;
  value: Record<string, string>;
  setValue: (value: Record<string, string>) => void;
  /** `advancedTokens` and a raw-tier `semanticColors` are both colour paths (§34) — a raw override can fail the same APCA floors a Direct one can. */
  violations: readonly Violation[];
  error: string | null;
  description: string | undefined;
}

function isStringRecord(input: unknown): input is Record<string, string> {
  return (
    typeof input === "object" &&
    input !== null &&
    !Array.isArray(input) &&
    Object.values(input as Record<string, unknown>).every((entry) => typeof entry === "string")
  );
}

/**
 * `raw` tier — "no guardrails beyond the syntax validator" (§33). This is
 * the one control in the registry that doesn't call `setValue` on every
 * keystroke: a half-typed JSON object is invalid JSON on every keystroke but
 * one, so edits apply on "Apply changes" instead, with a parse error shown
 * inline rather than silently discarded.
 */
export function RawControl({ id, value, setValue, violations, error, description }: RawControlProps) {
  const [text, setText] = useState(() => JSON.stringify(value, null, 2));
  const [parseError, setParseError] = useState<string | null>(null);

  // Reflects an external change (e.g. `reload()` after a conflict) without clobbering an in-progress, not-yet-applied edit.
  useEffect(() => setText(JSON.stringify(value, null, 2)), [value]);

  const apply = () => {
    try {
      const parsed: unknown = JSON.parse(text);
      if (!isStringRecord(parsed)) {
        setParseError("Must be a flat JSON object of string values, e.g. { \"color.primary\": \"#123456\" }.");
        return;
      }
      setParseError(null);
      setValue(parsed);
    } catch {
      setParseError("Not valid JSON.");
    }
  };

  return (
    <div className="grid gap-1.5">
      <Badge variant="destructive" className="w-fit">
        Raw · unguarded
      </Badge>
      <Textarea
        id={id}
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={6}
        spellCheck={false}
        className="font-mono text-xs"
        aria-labelledby={fieldHeadingId(id)}
        aria-invalid={error || parseError ? true : undefined}
        aria-describedby={fieldDescribedBy(id, { description, error: error ?? parseError })}
      />
      <Button type="button" size="sm" variant="outline" className="w-fit" onClick={apply}>
        Apply changes
      </Button>
      {parseError ? (
        <p role="alert" className="text-xs font-medium text-destructive">
          {parseError}
        </p>
      ) : null}
      <ColorViolations violations={violations} />
    </div>
  );
}
