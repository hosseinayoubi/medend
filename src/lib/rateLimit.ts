// src/lib/rateLimit.ts
type RateLimitResult = { ok: true } | { ok: false; retryAfterSec: number };

const buckets = new Map<string, { count: number; resetAt: number }>();

function nowMs() {
  return Date.now();
}

export function getClientIp(req: Request) {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

export function rateLimitFixedWindow(opts: {
  key: string;
  limit: number;
  windowSec: number;
}): RateLimitResult {
  const t = nowMs();
  const windowMs = opts.windowSec * 1000;

  const hit = buckets.get(opts.key);
  if (!hit || t >= hit.resetAt) {
    buckets.set(opts.key, { count: 1, resetAt: t + windowMs });
    return { ok: true };
  }

  if (hit.count >= opts.limit) {
    const retryAfterSec = Math.max(1, Math.ceil((hit.resetAt - t) / 1000));
    return { ok: false, retryAfterSec };
  }

  hit.count += 1;
  buckets.set(opts.key, hit);
  return { ok: true };
}

export function rateLimitResponse(retryAfterSec: number) {
  return new Response(
    JSON.stringify({
      error: "RATE_LIMITED",
      message: "Too many requests. Please try again later.",
      retryAfterSec,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfterSec),
      },
    }
  );
}
