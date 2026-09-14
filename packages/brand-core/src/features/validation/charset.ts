/**
 * Layer 2 — hard-reject character set, regardless of parse (§19).
 *
 * Belt and braces. Layer 1 (`./color.ts`, `./length.ts`, etc.) is what
 * actually stops an attacker — this runs unconditionally, on every declared
 * type, so a bug or a future loosening of one type's grammar can't alone open
 * an injection path. See `charset.test.ts` for a value that legitimately
 * satisfies a type's grammar and is still rejected here.
 */

/**
 * `css_text` is inlined into every visitor's page; an unbounded value is a
 * denial-of-service on the serializer and on every request that follows.
 * 512 is generous for anything a real token value needs.
 */
export const MAX_VALUE_BYTES = 512;

/**
 * Each character and why it's forbidden:
 * - `;` ends the current declaration and starts another.
 * - `{` / `}` open or close a rule; the rest of the value becomes a new
 *   selector or declaration with attacker-controlled content.
 * - `<` / `>` are how you escape the `<style>` element.
 * - `@` admits `@import`, which fetches attacker-controlled CSS.
 * - `\` admits CSS escapes, which reconstruct any of the above past a naive
 *   string check.
 */
const FORBIDDEN_CHARS = /[;{}<>@\\]/;

/** CSS function and keyword names aren't case-sensitive. */
const FORBIDDEN_SUBSTRINGS: readonly RegExp[] = [/url\(/i, /expression\(/i, /\/\*/];

/**
 * Non-ASCII is rejected outright. None of `TokenValueType`'s members have a
 * legitimate use for it: colour, length, number and duration are all ASCII by
 * grammar, and font-stack is validated by enum membership, never by
 * inspecting the string. Extend this only for a type that genuinely needs a
 * specific character, deliberately — not by widening it to make one input pass.
 */
const ALLOWED_NON_ASCII = new Set<string>();

/** The hard-reject layer's own result — a gate, not a parser, so no `normalized`. */
export type GateResult = { ok: true } | { ok: false; reason: string };

/**
 * Checked in this order deliberately: the length cap runs first so a
 * pathologically large string is never walked character-by-character or fed
 * to a regex — the cap itself is what bounds that work.
 */
export function checkHardReject(value: string): GateResult {
  if (value.length > MAX_VALUE_BYTES) {
    return { ok: false, reason: `value exceeds ${MAX_VALUE_BYTES} bytes` };
  }

  for (const char of value) {
    if (char.charCodeAt(0) > 0x7e && !ALLOWED_NON_ASCII.has(char)) {
      return { ok: false, reason: 'value contains a non-ASCII character' };
    }
  }

  if (FORBIDDEN_CHARS.test(value)) {
    return { ok: false, reason: 'value contains a forbidden character (one of ; { } < > @ \\)' };
  }

  for (const pattern of FORBIDDEN_SUBSTRINGS) {
    if (pattern.test(value)) {
      return { ok: false, reason: `value contains a forbidden sequence (${pattern.source})` };
    }
  }

  return { ok: true };
}
