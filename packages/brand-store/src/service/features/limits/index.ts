/**
 * Rate limits (§24) — a backstop, not the primary defence. The 400 ms
 * client debounce on a slider drag is what normally keeps `saveDraft` calls
 * sparse; this is what protects the site when a client-side bug removes it.
 * Injectable, like everything else here that touches shared state — a
 * single-process in-memory limiter is the default so the service works
 * standalone, but a real deployment with more than one process needs a
 * shared one (Redis, or similar).
 */

export class RateLimitError extends Error {
  constructor(
    public readonly key: string,
    message: string,
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export interface RateLimiter {
  /** Records one attempt against `key` and reports whether it's within the limit. */
  consume: (key: string) => Promise<boolean>;
}

/**
 * A fixed-window counter, per key. Good enough for a backstop — this is
 * deliberately not trying to be a precise sliding-window limiter, since the
 * thing it's guarding against is a runaway client, not a determined abuser
 * (real abuse protection belongs at the platform's edge, not here).
 */
export class InMemoryRateLimiter implements RateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async consume(key: string): Promise<boolean> {
    const nowMs = this.now().getTime();
    const recent = (this.hits.get(key) ?? []).filter((t) => nowMs - t < this.windowMs);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(nowMs);
    this.hits.set(key, recent);
    return true;
  }
}

/** §24: 1 write/second per site — the `saveDraft` backstop. */
export function defaultDraftRateLimiter(now?: () => Date): RateLimiter {
  return new InMemoryRateLimiter(1, 1_000, now);
}

/** §24: 10 publishes / 5 minutes per site. */
export function defaultPublishSiteRateLimiter(now?: () => Date): RateLimiter {
  return new InMemoryRateLimiter(10, 5 * 60_000, now);
}

/**
 * §24, §38: a per-account ceiling *in addition to* the per-site one — §38
 * lets one agency account own ten sites, and the per-site limit alone would
 * let it publish ten times as fast in aggregate. Ten times the per-site
 * allowance across the whole account is a reasonable starting ceiling, not
 * a value the guideline pins down; a platform with real usage data should
 * tune it.
 */
export function defaultPublishAccountRateLimiter(now?: () => Date): RateLimiter {
  return new InMemoryRateLimiter(100, 5 * 60_000, now);
}
