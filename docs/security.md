# Security

The one part of this system that inlines tenant-authored strings into
every visitor's page is the theme's CSS. This document is the two layers
that make that safe: what the value validator rejects before anything is
stored, and what the CSP header does if a bug in the first layer ever
lets something through anyway.

## Layer 1 — the value validator (`@pxlhut/brand-core`, step 07)

`validateTokenValue(value, type)` is on the path of **every** write to a
`direct` or `raw` tier field — regardless of tier, per the tier model's own
framing: "raw" means no *curation*, not no *validation*. It runs in two
passes:

1. **A hard-reject character-set gate** (`checkHardReject`,
   `MAX_VALUE_BYTES = 512`) — runs on the raw input, and again on the
   normalised output. Running it twice means a bug in one type's own
   normalisation logic can never hand back something the character gate
   would itself have refused; the gate isn't trusting the parser it just
   ran.
2. **A type-specific parser** — `color`, `length`, `number`, `duration`,
   `font-stack` each have their own grammar. A value has to parse as a
   *real* instance of its declared type, not just pass a character
   blocklist.

`escapeForHtml` is the last-resort backstop: even a value that
somehow cleared both passes above is still escaped when it's serialised
into CSS text, so no literal `<`/`>` reaches the output regardless of what
validation missed. The core proof suite tests this claim directly — a
hostile string (`</style><script>alert(1)</script>`) run through the
*entire* pipeline, checked byte-for-byte for zero unescaped occurrences in
what a browser would actually receive.

**This runs at the write boundary, not in the editor UI.** The headless
`@pxlhut/brand-editor` hook runs the same checks client-side for instant
feedback, but a request that skips the rendered form and calls
`saveDraft`/`publishTheme` directly is checked by the identical validator
server-side — the UI is a courtesy, never the enforcement.

## Layer 2 — a hash-based Content-Security-Policy

Layer 1 should never fail. Layer 2 is what happens if it does anyway.

The published CSS is inlined into `<head>` for zero-flicker first paint
(no external stylesheet round trip), which normally forces a choice
between `'unsafe-inline'` in your CSP — weakening the whole page's
script/style policy — or a hash. This package always takes the hash:

- `cssSha256` is computed **once**, at publish time, over the exact bytes
  of the finished CSS (`css_text`) — never recomputed or re-derived from
  anything else.
- `renderThemeStyle()` (`@pxlhut/brand-store/service`) returns the inline
  `html` and its matching `cspSource` (`'sha256-<the stored hash>'`)
  **together**, so inlining CSS without setting the matching header isn't
  a step you can forget — it's not a separate call.

```ts
const { html, cspSource } = renderThemeStyle(snapshot);
response.setHeader("Content-Security-Policy", `style-src ${cspSource}`);
```

If a validation bug ever did let something malicious through, this is the
layer that turns it into a blocked stylesheet the browser refuses to
apply, not stored XSS running on every visitor's page. It costs one
column (`css_sha256`, distinct from `checksum` — see
[versioning.md](./versioning.md) and the read path doc for why those two
hashes are not interchangeable) and one response header.

## What this does *not* cover

- **Authorization** — who is allowed to call `saveDraft`/`publishTheme`
  for a given site is your platform's own concern
  (`AccessContext.authorize`), not something this package can decide for
  you. The tier model (see [tier-model.md](./tier-model.md)) governs *what*
  an authorized caller can change, not *who* is authorized.
- **Rate limiting** — §21's publish rate limits are enforced in the
  service layer (`@pxlhut/brand-store/service`), but transport-level abuse
  protection (DDoS, auth brute-forcing) is your infrastructure's job.
- **The database connection itself** — credentials, network access, and
  encryption at rest are your adapter's/database's responsibility; the
  store contract has no opinion on transport security.
