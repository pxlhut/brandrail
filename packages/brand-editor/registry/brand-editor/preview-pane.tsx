"use client";

import type { PreviewResult } from "@pxlhut/brand-editor";

export interface PreviewPaneProps {
  preview: PreviewResult;
  companyName: string;
  logoUrl: string | undefined;
  className?: string;
}

/**
 * §5's one place visual isolation genuinely matters: `preview.css` is
 * already scoped to `[data-site-theme]` (the hook's default `previewSelector`,
 * step 08's `selector` option) so it can sit right next to this dashboard's
 * own chrome without a bare `--primary` leaking onto it. Everything below
 * `<style>` reads its colours from `var(--…)`, never from `preview.tokens`
 * directly — the injected stylesheet is the one source of truth for both.
 *
 * If `useBrandEditor` is given a non-default `previewSelector`, keep this
 * container's own selector in sync — swap the `data-site-theme` attribute
 * below for whatever `previewSelector` resolves to.
 */
export function PreviewPane({ preview, companyName, logoUrl, className }: PreviewPaneProps) {
  return (
    <div className={className}>
      <style>{preview.css}</style>
      <div
        data-site-theme
        style={{
          background: "var(--background)",
          color: "var(--foreground)",
          borderColor: "var(--border)",
        }}
        className="grid gap-4 rounded-[var(--radius)] border p-4"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {logoUrl ? <img src={logoUrl} alt="" className="h-6 w-auto object-contain" /> : null}
            <span style={{ fontFamily: "var(--font-heading)" }} className="text-sm font-semibold">
              {companyName || "Your company"}
            </span>
          </div>
          <div className="flex gap-2">
            {(["success", "warning", "info", "destructive"] as const).map((role) => (
              <span
                key={role}
                aria-hidden="true"
                title={role}
                className="size-3 rounded-full"
                style={{ background: `var(--${role})` }}
              />
            ))}
          </div>
        </div>

        <p style={{ fontFamily: "var(--font-body)" }} className="text-sm">
          This is body text, set in the body font, on the generated background colour.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            style={{
              background: "var(--primary)",
              color: "var(--primary-foreground)",
              borderRadius: "var(--radius)",
              borderWidth: "var(--border-width)",
              borderColor: "var(--primary)",
              borderStyle: "solid",
            }}
            className="px-3 py-1.5 text-sm font-medium"
          >
            Primary action
          </button>
          <button
            type="button"
            style={
              // Not a token (§32) — the component library branches on it directly, same as `toShadcnCss`'s own `buttonStyle` option.
              preview.buttonStyle === "outline"
                ? {
                    background: "transparent",
                    color: "var(--primary)",
                    borderRadius: "var(--radius)",
                    borderWidth: "var(--border-width)",
                    borderColor: "var(--primary)",
                    borderStyle: "solid",
                  }
                : {
                    background: "var(--secondary)",
                    color: "var(--secondary-foreground)",
                    borderRadius: "var(--radius)",
                    borderWidth: "var(--border-width)",
                    borderColor: "var(--secondary)",
                    borderStyle: "solid",
                  }
            }
            className="px-3 py-1.5 text-sm font-medium"
          >
            Secondary action
          </button>
          <div
            style={{
              background: "var(--card)",
              color: "var(--card-foreground)",
              borderColor: "var(--border)",
              borderRadius: "var(--radius)",
            }}
            className="border px-3 py-1.5 text-sm"
          >
            Card surface
          </div>
        </div>

        {preview.violations.length > 0 ? (
          <p className="text-xs" style={{ color: "var(--destructive)" }}>
            {preview.violations.length} colour {preview.violations.length === 1 ? "pairing needs" : "pairings need"} more contrast before this can
            publish.
          </p>
        ) : null}
      </div>
    </div>
  );
}
