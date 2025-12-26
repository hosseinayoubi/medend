// src/lib/http-errors.ts
import { fail } from "@/lib/response";
import { AppError } from "@/lib/errors";

export function failRateLimited(e: AppError) {
  const retryAfterSec =
    (e as any)?.extra?.retryAfterSec && Number.isFinite((e as any).extra.retryAfterSec)
      ? String((e as any).extra.retryAfterSec)
      : "60";

  return fail("RATE_LIMITED", e.message, 429, (e as any).extra, {
    headers: { "Retry-After": retryAfterSec },
  });
}
