/**
 * The value validator — guideline §19 (raw tier still needs a validator),
 * §32 (the same risk applies to every field type, not just colour).
 *
 * `css_text` is built by concatenating token values into a `<style>` block
 * that is inlined into every visitor's page for a site. A Raw-tier field
 * accepts a value straight from a site owner, unfiltered by any Guided/Direct
 * control shape. This is the security boundary of the whole product: get it
 * wrong and it is stored XSS on every page of every site on raw tier.
 */

/** Every shape a token value can take. Fonts are `'font-stack'`, never plain text (§35). */
export type TokenValueType = 'color' | 'length' | 'number' | 'duration' | 'font-stack';

/**
 * `normalized` is never the raw input echoed back — it is what the type's own
 * parser produced. That is what makes this airtight for `color`: whatever an
 * attacker wrote does not survive to the output, only what culori understood
 * it to mean.
 */
export type ValidationResult = { ok: true; normalized: string } | { ok: false; reason: string };
