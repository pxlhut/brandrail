# The SSR read path

Step 15's doc, shipped alongside `rules.md` (`contract/`) — the two files
together are the spec someone wiring this package into a real backend
reads. Guideline sections cited below: §3 (request lifecycle), §4 (scaling
tiers), §5 (visual isolation), §8 (cache invalidation), §39 (SSR and the
ISR gap). `DECISIONS.md` D7 (the CSP hash).

## The read path, in three steps

1. Resolve `site_id` from the Host header — the platform's existing
   routing, not this package's job.
2. `store.getActiveSnapshot(siteId)` — **the only query public traffic
   makes**. It never calls `generateTheme()`; the token tree was already
   computed and serialized at publish time (§7).
3. `renderThemeStyle(snapshot)` (`delivery/index.ts`) — inline `html` into
   `<head>`, and set `` `style-src ${cspSource}` `` on the response. The two
   are returned together so the safe thing — never inlining CSS without
   the header that matches it — is the default, not a second step to
   remember.

```ts
import { renderThemeStyle } from '@pxlhut/brand-store/service';

const siteId = resolveSiteIdFromHost(request.headers.host); // your routing
const snapshot = await store.getActiveSnapshot(siteId);
const { html, cspSource } = renderThemeStyle(snapshot);

response.setHeader('Content-Security-Policy', `style-src ${cspSource}`);
// `html` goes into <head>, before anything else renders.
```

## Scaling the read path — don't build ahead of need

§4's tiering, worth repeating here because the temptation to build for
50,000 sites on day one is strong. **Add a layer only when the previous
one is measurably the bottleneck** — for v0.1, tiers 2 and 3 are
documented, not implemented.

| Sites | Read path |
|---|---|
| ~5–50 | Direct query joining the active pointer to snapshots. Fine as-is. |
| ~500 | Cache in front (Redis or in-process LRU), keyed by `site_id`, short TTL — invalidated explicitly on publish rather than waiting for TTL expiry. |
| ~50,000 | Push `css_text` to edge KV (Cloudflare KV, Vercel Edge Config) keyed by domain; publish writes through; the origin DB leaves the read path entirely. |

The `checksum` column earns its keep at tiers 2 and 3: cache/edge
invalidation compares checksums rather than trusting timestamps, which is
robust against clock skew and against re-publishing identical content.

## The ISR gap — the one real fix

§39 names three situations for a site's pages; only one is a gap:

- **Rendered fresh every request** — already correct, nothing to add.
- **Rendered once and cached (ISR)** — the gap. Publishing doesn't reach a
  cached page until its own TTL expires, because nothing ties a publish to
  invalidating a *page* cache — only the token-lookup cache from §8.
- **Fully static export** — a different situation entirely: a live theme
  change there needs a rebuild, not an invalidation.

The fix: tag the **theme data fetch** with the site's id, not the page.
Revalidating that one tag on publish updates every page that reads the
theme, with no page inventory to track:

```ts
// the read — tagged so a publish can invalidate it precisely
async function getActiveSnapshot(siteId: string) {
  const res = await fetch(`${API_BASE}/sites/${siteId}/theme/active`, {
    next: { tags: [`theme:${siteId}`] },
  });
  return res.json();
}

// inside your publish endpoint, right after publishTheme()'s own
// invalidation event (§8) fires
import { revalidateTag } from 'next/cache';
revalidateTag(`theme:${siteId}`);
```

This is a documented snippet, not a dependency of this package — the
moment `@pxlhut/brand-store` imported `next/cache` it would stop being
framework-agnostic (§15).

## Visual isolation — only where it matters

§5 is worth restating because it's a genuine over-engineering trap. CSS
custom properties cascade to all descendants, but that only becomes a bug
in **one** place: your own admin dashboard, where a live preview renders
next to your product's own chrome. If both use `--primary`, the site's
brand colour leaks onto your UI.

Public-facing pages don't have this problem — each request renders exactly
one site. **Don't build isolation there.** Scope it only where two themes
are on screen at once: the step 08 serializer's `selector` option scopes
the preview block, or render the preview in a Shadow DOM / iframe if it
needs to show real page content rather than swatches.

## Instrumentation

See `../metrics/index.ts`'s module doc comment for the full list and which
of §26's six metrics this package's own `MetricsEmitter` wires today versus
which need a cache/edge layer that v0.1 deliberately doesn't build.
