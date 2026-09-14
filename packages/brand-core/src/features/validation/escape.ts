/**
 * Layer 3 — HTML-escape at serialisation (§19).
 *
 * CSS validation alone does not catch this, and it's the failure mode most
 * likely to survive a careless review: a value containing `</style><script>`
 * is not invalid CSS — it's a string. It escapes the style context when the
 * block is inlined into HTML.
 *
 * Step 08 calls this on every value going into `css_text`, unconditionally —
 * even a value that came from the generator and never touched user input,
 * because "this path is safe" is exactly the assumption that stops being true
 * after a refactor.
 *
 * `&` first, then `<` — in that order, on two separate passes, so the `&` a
 * `<` replacement introduces is never re-escaped.
 */
export function escapeForHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;');
}
