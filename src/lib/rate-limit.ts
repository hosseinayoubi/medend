import { AppError } from "@/lib/errors";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

/**
 * Simple in-memory rate limiter.
 * For production-grade multi-region rate limiting, replace with Redis/Upstash.
 */
export function rateLimitOrThrow(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key);

  if (!b || now > b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  b.count += 1;
  if (b.count > limit) {
    const retrySec = Math.ceil((b.resetAt - now) / 1000);
    throw new AppError("RATE_LIMITED", `Too many requests. Retry in ${retrySec}s.`, 429);
  }
}
