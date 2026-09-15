"use client";

import { useMemo, useState } from "react";
import type { BrandConfig, ControlConfig, FieldId, GenerateResult } from "@pxlhut/brand-core";
import { PublishAbortedError, useBrandEditor, type LogoVariant } from "@pxlhut/brand-editor";
import type { DraftPatch, PublishResult } from "@pxlhut/brand-store/service";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import { FieldControl } from "./field-control";
import { PreviewPane } from "./preview-pane";
import { PublishBar } from "./publish-bar";

export interface BrandEditorProps {
  /** The vendor's live tier authority (§9, §31) — see `useBrandEditor`'s own doc comment on why it's a separate input from `initial.controlConfig`. */
  controlConfig: ControlConfig;
  initial: BrandConfig;
  onSave: (patch: DraftPatch) => Promise<BrandConfig>;
  onPublish: () => Promise<PublishResult>;
  onUploadLogo?: (file: File, variant: LogoVariant) => Promise<string>;
  /** Refetches the site's current config after a conflict (§22). The "Reload latest" button is hidden without it — see `PublishBar`. */
  onReloadRequested?: () => Promise<BrandConfig>;
  /** @default 400 (§3) */
  debounceMs?: number;
  /** @default '[data-site-theme]' (§5) — keep `PreviewPane`'s own container in sync if this changes. */
  previewSelector?: string;
  className?: string;
}

type Violation = GenerateResult["violations"][number];

const SECTIONS: readonly { key: string; label: string; fields: readonly FieldId[] }[] = [
  { key: "identity", label: "Identity", fields: ["companyName", "logo", "supportUrl", "emailSenderName"] },
  { key: "brand", label: "Brand", fields: ["brandColor", "semanticColors"] },
  {
    key: "style",
    label: "Typography & shape",
    fields: ["headingFont", "bodyFont", "radius", "density", "neutralTone", "buttonStyle", "elevation"],
  },
  { key: "advanced", label: "Advanced", fields: ["advancedTokens"] },
];

/**
 * The one exported component (§17's own framing): renders entirely from
 * `controlConfig` via `useBrandEditor` (`@pxlhut/brand-editor`, a real npm
 * dependency, not copied). Everything below is copied source — restyle
 * freely, none of it is guarded by a stable prop contract the way the hook
 * is.
 */
export function BrandEditor({
  controlConfig,
  initial,
  onSave,
  onPublish,
  onUploadLogo,
  onReloadRequested,
  debounceMs,
  previewSelector,
  className,
}: BrandEditorProps) {
  const state = useBrandEditor({
    controlConfig,
    initial,
    onSave,
    onPublish,
    ...(onUploadLogo !== undefined ? { onUploadLogo } : {}),
    ...(debounceMs !== undefined ? { debounceMs } : {}),
    ...(previewSelector !== undefined ? { previewSelector } : {}),
  });

  const [tab, setTab] = useState<string>(SECTIONS[0]!.key);
  const [reloading, setReloading] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  const violationsByField = useMemo(() => {
    const out: Partial<Record<FieldId, Violation[]>> = {};
    for (const violation of state.preview.violations) {
      const field = state.preview.fieldForViolation(violation);
      out[field] = [...(out[field] ?? []), violation];
    }
    return out;
  }, [state.preview]);

  const dirty = useMemo(() => Object.values(state.fields).some((field) => field.dirty), [state.fields]);

  const handlePublish = () => {
    setPublishError(null);
    state.publish().catch((err: unknown) => {
      // A conflict abort is already surfaced via `state.conflict`; a contrast rejection resolves normally into per-field errors instead of throwing. Anything else reaching here is the consumer's own `onPublish` failing (a network error, a thrown 500) and needs its own visible state — an unhandled rejection is not a publish failure UI.
      if (err instanceof PublishAbortedError) return;
      setPublishError(err instanceof Error ? err.message : String(err));
    });
  };

  const handleReload = onReloadRequested
    ? () => {
        setReloading(true);
        onReloadRequested()
          .then((config) => state.reload(config))
          .finally(() => setReloading(false));
      }
    : undefined;

  return (
    <div className={cn("grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]", className)}>
      <div className="grid gap-4">
        <PublishBar
          dirty={dirty}
          saving={state.saving}
          saveError={state.saveError}
          publishError={publishError}
          conflict={state.conflict}
          canPublish={state.canPublish}
          publishing={state.publishing}
          onPublish={handlePublish}
          onReloadRequested={reloading ? undefined : handleReload}
        />

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            {SECTIONS.map((section) => (
              <TabsTrigger key={section.key} value={section.key}>
                {section.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {SECTIONS.map((section) => (
            <TabsContent key={section.key} value={section.key} className="grid gap-4">
              {section.fields.map((id) => (
                <FieldControl
                  key={id}
                  state={state.fields[id]}
                  violations={violationsByField[id] ?? []}
                  logo={id === "logo" ? state.logo : undefined}
                />
              ))}
            </TabsContent>
          ))}
        </Tabs>
      </div>

      <PreviewPane
        preview={state.preview}
        companyName={state.fields.companyName.value}
        logoUrl={state.logo.light.url}
        className="lg:sticky lg:top-4 lg:self-start"
      />
    </div>
  );
}
