# Step 15 — Delivery: the SSR read path

| | |
|---|---|
| **Depends on** | 13 (14 for a real end-to-end test) |
| **Unlocks** | 18 |
| **Output** | docs + a small `brand-store/service` helper |
| **Size** | one day |

## Why this step exists

Guideline §3's read path is the scaling argument for the whole design:
production requests do a **lookup, not a computation**. `generateTheme()`
runs only at publish time, which happens orders of magnitude less often
than page views.

§39 already designed this SSR-first — theme resolved server-side per
request, inlined before the page renders, zero client JS. Most of it needs
no new code. Two things do: the CSP header from D7, and the one real gap
§39 identifies around cached pages.

## Prerequisites

- Guideline §3 (read path), §4 (scaling tiers), §5 (visual isolation), §8
  (invalidation), §39 (SSR and the ISR gap)
- `DECISIONS.md` D7

## Build

### The read path, in three steps

1. Resolve `site_id` from the Host header — the platform's existing
   routing, not this package's job.
2. Look up the active snapshot's `css_text`. **This is the only query
   public traffic makes**, and it never calls `generateTheme()`.
3. Inline into `<head>`, with the CSP header from the stored `css_sha256`.

Ship a `renderThemeStyle(snapshot)` helper returning
`{ html: string; cspSource: string }` so consumers can't accidentally
inline the CSS without setting the matching header. Coupling them in one
return value is the cheapest way to make the safe thing the default.

### Scaling — do not build ahead of need

§4's tiering is good advice and worth repeating in the docs, because the
temptation to build for 50,000 sites on day one is strong:

| Sites | Read path |
|---|---|
| ~5–50 | Direct query joining active pointer to snapshots. Fine as-is. |
| ~500 | Cache in front (Redis or in-process LRU) keyed by `site_id`, short TTL, invalidated explicitly on publish rather than waiting for expiry |
| ~50,000 | Push `css_text` to edge KV keyed by domain; publish write-throughs; origin DB leaves the read path entirely |

**Add a layer only when the previous one is measurably the bottleneck.**
For v0.1, document tiers 2 and 3 and implement neither. The `checksum`
column earns its keep here (§4) — cache invalidation compares checksums
rather than trusting timestamps, which is robust against clock skew and
against re-publishing identical content.

### The ISR gap — the one real fix

§39 identifies three situations and only one is a gap:

- **Rendered fresh every request** — already correct, nothing to add.
- **Rendered once and cached (ISR)** — the gap. Publishing doesn't reach a
  cached page until its own TTL expires, because nothing ties a publish to
  invalidating a *page* cache — only the token-lookup cache from §8.
- **Fully static export** — a different situation entirely: live theme
  changes need a rebuild, not an invalidation. Worth knowing which of the
  three each site actually is.

The fix, per §39: tag the **theme data fetch** with the site's id, not the
page. Then revalidating that one tag on publish updates every page that
reads the theme, with no page inventory to track.

```ts
async function getActiveSnapshot(siteId: string) {
  const res = await fetch(`${API_BASE}/sites/${siteId}/theme/active`, {
    next: { tags: [`theme:${siteId}`] },
  });
  return res.json();
}

// inside publishTheme(), right after §8's invalidation event
revalidateTag(`theme:${siteId}`);
```

Ship this as a documented Next.js snippet, not a dependency — the moment
this package imports `next/cache` it stops being framework-agnostic (§15).

### Visual isolation — only where it matters

§1 is worth restating because it's a genuine over-engineering trap. CSS
custom properties cascade to all descendants, but that only becomes a bug
in **one** place: your own admin dashboard, where a live preview renders
next to your product's own chrome. If both use `--primary`, the site's
brand colour leaks onto your UI.

Public-facing pages don't have this problem — each request renders exactly
one site. **Don't build isolation there.** Solve it only where two themes
are on screen at once: the step 08 serializer's `selector` option scopes
the preview block, or render the preview in a Shadow DOM or iframe if it
needs to show real page content rather than swatches.

### Instrumentation

§26's list, worth having before production rather than after:
`publish_latency_ms` (catches a slow adapter or lock contention),
`apca_rejection_rate` (a rising rate is an owner-facing UX problem, not
validation doing its job), `edge_cache_hit_ratio`,
`snapshot_row_count` per site, `publish_rate_limit_hits`,
`store_adapter_error_rate` tagged by adapter.

For v0.1 emit them through an injectable metrics callback. Don't pick a
metrics vendor for your consumers.

## Acceptance

- [ ] `renderThemeStyle` returns the HTML and the CSP source together
- [ ] The CSP source matches the stored `css_sha256` — tested against real published bytes
- [ ] Documented read path makes exactly one query and never calls `generateTheme`
- [ ] Escaping from step 07 is applied on the inline path (regression test)
- [ ] The Next.js tag-revalidation snippet is documented with its `publishTheme` counterpart
- [ ] §4's scaling tiers are documented; neither cache layer is implemented
- [ ] Metrics emit through an injectable callback with a no-op default
- [ ] End-to-end against the step 14 Lucid adapter: Host header → branded first paint, no flash of unbranded content

## Out of scope

Edge KV (§4 tier 3), multi-region (§30 — deliberately deferred; revisit
only on a concrete trigger like a data-residency contract or a measured
write-latency problem, and document the trigger rather than guessing a
solution).
