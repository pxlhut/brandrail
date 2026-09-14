# Step 07 — Core: the value validator

| | |
|---|---|
| **Depends on** | 03 |
| **Unlocks** | 08, 13 |
| **Output** | `brand-core/src/features/validation/` |
| **Size** | one day. Do not compress it. |

## Why this step exists

**This is the security boundary of the entire product.**

`css_text` is built by concatenating token values into a `<style>` block
that is inlined into every visitor's page for that site. A Raw-tier field
accepts values from a tenant. Guideline §19 spotted this correctly and
then stopped at "accept legal CSS custom-property values (colors,
lengths, valid syntax), reject anything that isn't" — which isn't
implementable as written, and misses half the threat, because the output
lands in **HTML**, not only in CSS.

Get this wrong and you have stored XSS on every page of every tenant that
uses raw tier. `DECISIONS.md` D4 and D7 set the approach; this implements
it.

## Prerequisites

- Guideline §19 (the original note), §32 (raw risk applies to every field type, not just colour)
- `DECISIONS.md` D7 (hash-based CSP)

## Build

Four layers. All four, not the first that seems sufficient.

### 1. Type allowlist — never a blocklist

Every token declares its type. Validation asserts the value parses to
exactly that type, and rejects anything else. This is the layer that
actually works; the rest are defence in depth.

```ts
type TokenValueType = 'color' | 'length' | 'number' | 'duration' | 'font-stack';
export function validateTokenValue(
  value: string, type: TokenValueType
): { ok: true; normalized: string } | { ok: false; reason: string };
```

- **`color`** — parse with `culori`. If it doesn't parse to a colour,
  reject. Re-emit the *normalised* form, not the input string. Normalising
  is what makes this airtight: `#fff` in, `oklch(…)` out, and nothing the
  attacker wrote survives to the output.
- **`length`** — `/^-?\d+(\.\d+)?(px|rem|em|%)$/`. A regex is correct
  here precisely because the grammar is tiny. Don't reach for a parser.
- **`number`** — finite, in the declared range.
- **`font-stack`** — **not** string validation. Assert the value is one of
  the curated enum's exact values (§35). Fonts are the one token type that
  legitimately contains arbitrary-looking strings, which makes them the
  sharp edge. An enum lookup has no attack surface.

For anything genuinely free-form, use a real CSS tokenizer
(`@csstools/css-tokenizer`) and assert the parse yields exactly one token
of the expected type. If you find yourself needing this often, the type
list above is too small — extend it rather than loosening.

### 2. Hard-reject character set, regardless of parse

Belt and braces. Reject outright, before and after parsing:

```
;  {  }  <  >  @  \  and the substrings  url(   expression(   /*
```

Why each matters:

- `}` closes the current rule; the rest of the value then opens a new
  selector with attacker-controlled content.
- `<` and `>` are how you escape the `<style>` element.
- `@` admits `@import`, which fetches attacker-controlled CSS.
- `\` admits CSS escapes, which reconstruct any of the above past a naive
  string check.
- `url(` and `expression(` are the classic CSS execution vectors.

Also cap length — 512 bytes per value is generous — and reject any
non-ASCII beyond a small allowlist. Unbounded values are a denial-of-service
on the serializer and on every page that inlines the result.

### 3. HTML-escape at serialization

**CSS validation alone does not catch this**, and it is the failure mode
most likely to survive a careless review. A value containing
`</style><script>` is not invalid CSS — it's a string. It escapes the
style context when the block is inlined into HTML.

So when step 08 builds the final `css_text` string: escape `<` and `&`.
Unconditionally. Even for values that came from the generator and never
touched user input, because "this path is safe" is exactly the assumption
that stops being true after a refactor.

### 4. Hash-based CSP (D7)

`css_text` is computed once at publish time and never changes, so its
SHA-256 can be computed then and stored on the snapshot as `cssSha256`
(step 03 put it on the type). The server emits
`style-src 'sha256-<stored>'`.

This is the layer that turns a missed validation bug from stored XSS into
a blocked stylesheet. It costs one column and one header.

> The hash is computed at publish, in the service layer (step 13), not
> here — `brand-core` has no crypto (step 02's purity constraint). Export
> the exact byte string that must be hashed, so the hash is over what
> actually ships and not a re-serialisation of it.

### The hostile corpus

Write it as `packages/brand-core/fixtures/hostile-values.ts` now — at the
package root, not inside `src/`, because step 09's proofs live outside
`src/` too and both need it. Step 09 reuses it. At minimum:

```
#fff}                                  → reject (closes rule)
red; background: url(//evil)           → reject (semicolon)
</style><script>alert(1)</script>      → reject (HTML escape)
url(javascript:alert(1))               → reject (url)
expression(alert(1))                   → reject (legacy IE, still worth it)
@import url(//evil)                    → reject (at-rule)
\75 rl(//evil)                         → reject (CSS escape)
var(--x); color: red                   → reject (semicolon)
"><img src=x onerror=alert(1)>         → reject
(512+ char string)                     → reject (length)
rgb(0,0,0)                             → accept, normalize
0.5rem                                 → accept
Inter                                  → accept only if in the curated enum
```

Every one of these is a test case with an asserted reason string.

## Acceptance

- [ ] Every entry in the hostile corpus is rejected, each with its own assertion
- [ ] `color` values are re-emitted **normalised**, never echoed from input
- [ ] `font-stack` validates by enum membership, not by string inspection — passing an unlisted font name is rejected even at raw tier (§35)
- [ ] The hard-reject set is applied independently of the type parse, proven by a test where a value passes the type parse and is still rejected
- [ ] Escaping `<` and `&` is covered by a test asserting the exact output bytes
- [ ] Values over 512 bytes are rejected
- [ ] The validator is pure and has no dependency beyond `culori`

## Out of scope

Contrast checking — that's step 06, a different check that also runs. Tier
enforcement (*who may write this field at all*) — step 13. Computing the
CSP hash — step 13.

## Notes for reviewers

If you are reviewing this step, review it as security code. The
acceptance criteria above are a floor, not a ceiling. Specifically check
that no code path builds `css_text` by concatenating a value that didn't
come back from `validateTokenValue`.
