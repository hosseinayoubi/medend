// src/app/api/chat/route.ts
import { ok, fail } from "@/lib/response";
import { AppError } from "@/lib/errors";
import { getAuthedUser } from "@/lib/auth";
import { chatSchema } from "@/validators/chat.schema";
import { runChat, listRecentMessages } from "@/services/chat.service";
import { rateLimitOrThrow } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/ip";

function rateLimitedFail(e: AppError) {
  const retryAfterSec =
    (e as any)?.extra?.retryAfterSec && Number.isFinite((e as any).extra.retryAfterSec)
      ? String((e as any).extra.retryAfterSec)
      : "60";

  return fail("RATE_LIMITED", e.message, 429, (e as any).extra, {
    headers: { "Retry-After": retryAfterSec },
  });
}

export async function POST(req: Request) {
  try {
    const user = await getAuthedUser();

    const ip = getClientIp(req);
    // 30 req/min per user+ip
    rateLimitOrThrow(`chat:${user.id}:${ip}`, 30, 60_000);

    const body = chatSchema.parse(await req.json());
    const result = await runChat({
      userId: user.id,
      message: body.message,
      mode: body.mode,
    });

    return ok(result);
  } catch (e: any) {
    if (e?.name === "ZodError") return fail("INVALID_INPUT", "Invalid input", 400, e.flatten?.());
    if (e instanceof AppError) {
      if (e.code === "RATE_LIMITED") return rateLimitedFail(e);
      return fail(e.code, e.message, e.status, (e as any).extra);
    }
    return fail("SERVER_ERROR", "Something went wrong", 500);
  }
}

export async function GET(req: Request) {
  try {
    const user = await getAuthedUser();

    const ip = getClientIp(req);
    // 60 req/min per user+ip (listing is cheaper)
    rateLimitOrThrow(`chat:list:${user.id}:${ip}`, 60, 60_000);

    const messages = await listRecentMessages(user.id, 30);
    return ok({ messages });
  } catch (e: any) {
    if (e instanceof AppError) {
      if (e.code === "RATE_LIMITED") return rateLimitedFail(e);
      return fail(e.code, e.message, e.status, (e as any).extra);
    }
    return fail("SERVER_ERROR", "Something went wrong", 500);
  }
}
