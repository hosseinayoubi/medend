import { AppError } from "@/lib/errors";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

/**
 * Simple in-memory rate limiter.
 * Note: On serverless (Vercel), this is best-effort because instances can scale.
 * For strict rate limiting, replace with Redis/Upstash/Vercel KV.
 */
export function rateLimitOrThrow(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key);

  // new window
  if (!b || now > b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  // already at/over limit
  if (b.count >= limit) {
    const retrySec = Math.max(1, Math.ceil((b.resetAt - now) / 1000));
    throw new AppError("RATE_LIMITED", `Too many requests. Retry in ${retrySec}s.`, 429);
  }

  // consume 1 token
  b.count += 1;
}
