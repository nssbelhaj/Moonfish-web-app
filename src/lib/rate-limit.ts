/**
 * Limiteur de débit à fenêtre glissante, en mémoire.
 *
 * Volontairement minimal, et volontairement documenté comme insuffisant :
 * l'état vit dans le processus. Avec plusieurs instances ou en serverless, il
 * ne protège plus rien. C'est acceptable pour un MVP sans base ; ça ne l'est
 * plus le jour où l'inscription vaut quelque chose. Le remplaçant naturel est
 * un compteur Redis ou une contrainte d'unicité côté Supabase.
 */
export interface RateLimitDecision {
  allowed: boolean;
  /** Nombre de requêtes restantes dans la fenêtre. */
  remaining: number;
  /** Instant, en ms epoch, où la fenêtre se libère. */
  resetAt: number;
}

export class SlidingWindowRateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  check(key: string, now: number = Date.now()): RateLimitDecision {
    const cutoff = now - this.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((timestamp) => timestamp > cutoff);

    if (recent.length >= this.limit) {
      const oldest = recent[0] ?? now;
      this.hits.set(key, recent);
      return { allowed: false, remaining: 0, resetAt: oldest + this.windowMs };
    }

    recent.push(now);
    this.hits.set(key, recent);

    // Purge opportuniste : sans elle, la Map grossit indéfiniment.
    if (this.hits.size > 5_000) this.evictExpired(cutoff);

    return {
      allowed: true,
      remaining: this.limit - recent.length,
      resetAt: now + this.windowMs,
    };
  }

  private evictExpired(cutoff: number): void {
    for (const [key, timestamps] of this.hits) {
      const kept = timestamps.filter((timestamp) => timestamp > cutoff);
      if (kept.length === 0) this.hits.delete(key);
      else this.hits.set(key, kept);
    }
  }
}
