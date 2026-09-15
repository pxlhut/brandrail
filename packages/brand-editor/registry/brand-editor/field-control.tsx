"use client";

import type { ReactNode } from "react";
import type { FieldId, GenerateResult } from "@pxlhut/brand-core";
import type { FieldStates, LogoAssetsState } from "@pxlhut/brand-editor";
import type { SemanticColorRole } from "@pxlhut/brand-store/service";

import { AssetControl } from "./controls/asset-control";
import { ColorControl, SemanticColorsControl } from "./controls/color-control";
import { LockedControl } from "./controls/locked-control";
import { RawControl } from "./controls/raw-control";
import { SelectControl } from "./controls/select-control";
import { SliderControl } from "./controls/slider-control";
import { TextControl } from "./controls/text-control";
import { FIELD_COPY } from "./field-copy";
import { FieldRow } from "./field-row";

type Violation = GenerateResult["violations"][number];

export interface FieldControlProps {
  /**
   * `FieldStates[FieldId]` rather than `FieldState<FieldId>` — indexing the
   * mapped `FieldStates` type with the full `FieldId` union produces a union
   * of each field's own narrowly-typed `FieldState<K>`, which is what
   * `state.fields[id]` actually is at the call site. `FieldState<FieldId>`
   * (the generic instantiated directly with the wide union) looks similar
   * but isn't the same type: its `setValue` would accept *any* field's
   * value, which no real per-field `setValue` does.
   */
  state: FieldStates[FieldId];
  /** Pre-filtered to this field by `preview.fieldForViolation` — only `brandColor` and `semanticColors` ever get any (§34: everything else is either not a colour or locked). */
  violations: readonly Violation[];
  /** `undefined` for every field but `logo` itself, and for `logo` when `onUploadLogo` wasn't passed to `useBrandEditor` — see `AssetControl`'s own fallback. */
  logo: LogoAssetsState | undefined;
}

function assertNever(value: never): never {
  throw new Error(`unreachable field-control branch: ${JSON.stringify(value)}`);
}

/**
 * The switch step 16's own doc comment describes: `control` is `FieldConfig`
 * (step 03's discriminated union), so `{ tier: 'guided', type: 'select' }`
 * and `{ tier: 'guided', type: 'slider' }` are different renders (§31), and
 * every `DirectValueType` gets its own control. `assertNever` turns a
 * forgotten branch into a compile error instead of a silent blank field.
 */
function renderControl(state: FieldStates[FieldId], violations: readonly Violation[], logo: LogoAssetsState | undefined): ReactNode {
  const { id, control, value, setValue, error } = state;
  const description = FIELD_COPY[id].description;

  switch (control.tier) {
    case "locked":
      return <LockedControl id={id} value={typeof value === "string" ? value : undefined} />;

    case "guided":
      if (control.type === "select") {
        return (
          <SelectControl
            id={id}
            value={value as string}
            setValue={setValue as (next: string) => void}
            options={control.options}
            error={error}
            description={description}
          />
        );
      }
      if (control.type === "slider") {
        return (
          <SliderControl
            id={id}
            value={value as string}
            setValue={setValue as (next: string) => void}
            min={control.min}
            max={control.max}
            step={control.step}
            error={error}
            description={description}
          />
        );
      }
      return assertNever(control);

    case "direct":
      switch (control.type) {
        case "color":
          return id === "semanticColors" ? (
            <SemanticColorsControl
              id={id}
              value={value as Partial<Record<SemanticColorRole, string>>}
              setValue={setValue as (next: Partial<Record<SemanticColorRole, string>>) => void}
              violations={violations}
              error={error}
              description={description}
            />
          ) : (
            <ColorControl
              id={id}
              value={value as string}
              setValue={setValue as (next: string) => void}
              violations={violations}
              error={error}
              description={description}
            />
          );

        case "text":
          return (
            <TextControl id={id} value={value as string} setValue={setValue as (next: string) => void} error={error} description={description} />
          );

        case "length":
          return (
            <TextControl
              id={id}
              value={value as string}
              setValue={setValue as (next: string) => void}
              error={error}
              description={description}
              placeholder="0.5rem"
            />
          );

        case "number":
          return (
            <TextControl
              id={id}
              type="number"
              inputMode="numeric"
              value={value as string}
              setValue={setValue as (next: string) => void}
              error={error}
              description={description}
            />
          );

        case "asset":
          return logo === undefined ? (
            <p className="text-xs text-muted-foreground">Pass `onUploadLogo` to `useBrandEditor` to enable uploads.</p>
          ) : (
            <AssetControl id={id} light={logo.light} dark={logo.dark} error={error} description={description} />
          );

        default:
          return assertNever(control);
      }

    case "raw":
      return (
        <RawControl
          id={id}
          value={value as Record<string, string>}
          setValue={setValue as (next: Record<string, string>) => void}
          violations={violations}
          error={error}
          description={description}
        />
      );

    default:
      return assertNever(control);
  }
}

export function FieldControl({ state, violations, logo }: FieldControlProps) {
  const copy = FIELD_COPY[state.id];
  return (
    <FieldRow id={state.id} label={copy.label} description={copy.description} error={state.error} dirty={state.dirty}>
      {renderControl(state, violations, logo)}
    </FieldRow>
  );
}
