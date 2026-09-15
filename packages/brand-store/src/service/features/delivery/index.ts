/**
 * The SSR read path helper (step 15; guideline §3, §39; `DECISIONS.md` D7).
 *
 * All the real work happened upstream of this file: `toShadcnCss` (step 08)
 * HTML-escapes every value going into `cssText`, unconditionally, and
 * `hashCssText` (`publishing/hash.ts`) hashes those exact bytes into
 * `Snapshot.cssSha256` at publish time. This helper's only job is to keep
 * the two paired at the point of use — the inline `<style>` block and the
 * CSP source that authorises it are returned together, so a consumer can't
 * inline one without setting the matching header. Coupling them in one
 * return value is the cheapest way to make the safe thing the default.
 *
 * The read path itself (§3) is three steps; this covers only the third —
 * the first two are the platform's own job, not this package's:
 *
 * 1. Resolve `site_id` from the Host header — the platform's existing
 *    routing.
 * 2. `store.getActiveSnapshot(siteId)` — the one query production traffic
 *    makes. It never calls `generateTheme()`.
 * 3. `renderThemeStyle(snapshot)`, inlined into `<head>` with a `style-src`
 *    directive built from `cspSource`.
 *
 * See `read-path.md` (shipped alongside `rules.md`) for the full read path,
 * §4's scaling tiers, and the Next.js ISR revalidation snippet.
 */

export interface ThemeStyleSource {
  cssText: string;
  cssSha256: string;
}

export interface RenderedThemeStyle {
  /**
   * `<style>...</style>`, ready to inline into `<head>`. `cssText` is
   * already HTML-escaped (step 08) — this wraps it verbatim, it does not
   * re-escape or otherwise transform it.
   */
  html: string;
  /**
   * A complete CSP hash-source expression — e.g. `'sha256-<this>'` — ready
   * to drop into a `style-src` directive: `` `style-src ${cspSource}` ``.
   * Computed once at publish time (D7) from the exact bytes inlined above;
   * never re-hashed here.
   */
  cspSource: string;
}

/**
 * Inline a published snapshot's CSS and its matching CSP hash source.
 *
 * Takes the narrow `ThemeStyleSource` shape rather than the full
 * `Snapshot` so a consumer can call this straight off whatever their cache
 * layer (§4 tier 2/3) actually holds, without needing the rest of the row.
 */
export function renderThemeStyle(snapshot: ThemeStyleSource): RenderedThemeStyle {
  return {
    html: `<style>${snapshot.cssText}</style>`,
    cspSource: `'sha256-${snapshot.cssSha256}'`,
  };
}
