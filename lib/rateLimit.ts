export interface RateLimiter {
  check(key: string): Promise<{ ok: boolean; retryAfterSec: number }>;
}

/** In-memory fixed window. На Vercel состояние живёт в рамках инстанса — для прода заменить на Redis-реализацию интерфейса. */
export class MemoryRateLimiter implements RateLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>();
  constructor(
    private limit: number,
    private windowMs = 60_000,
  ) {}

  async check(key: string) {
    const now = Date.now();
    if (this.hits.size > 5000) {
      for (const [k, v] of this.hits) if (v.resetAt <= now) this.hits.delete(k);
    }
    const cur = this.hits.get(key);
    if (!cur || cur.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      return { ok: true, retryAfterSec: 0 };
    }
    cur.count++;
    if (cur.count > this.limit) return { ok: false, retryAfterSec: Math.ceil((cur.resetAt - now) / 1000) };
    return { ok: true, retryAfterSec: 0 };
  }
}

const g = globalThis as unknown as { __limiter?: RateLimiter };
export function getLimiter(): RateLimiter {
  g.__limiter ??= new MemoryRateLimiter(Number(process.env.RATE_LIMIT_PER_MIN) || 10);
  return g.__limiter;
}

export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  return xff?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}
