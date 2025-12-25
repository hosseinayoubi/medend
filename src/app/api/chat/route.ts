import { ok, fail } from "@/lib/response";
import { AppError } from "@/lib/errors";
import { getAuthedUser } from "@/lib/auth";
import { chatSchema } from "@/validators/chat.schema";
import { runChat, listRecentMessages } from "@/services/chat.service";
import { rateLimitOrThrow } from "@/lib/rate-limit";

function getIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

function rateLimitedResponse(message: string) {
  // try to parse "Retry in Xs." to set Retry-After
  const m = message.match(/Retry in (\d+)s/);
  const retryAfter = m?.[1] ?? "60";

  return new Response(
    JSON.stringify({
      error: "RATE_LIMITED",
      message,
      retryAfterSec: Number(retryAfter),
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": retryAfter,
      },
    }
  );
}

export async function POST(req: Request) {
  try {
    const user = await getAuthedUser();

    const ip = getIp(req);
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
      if (e.code === "RATE_LIMITED") return rateLimitedResponse(e.message);
      return fail(e.code, e.message, e.status);
    }
    return fail("SERVER_ERROR", "Something went wrong", 500);
  }
}

export async function GET(req: Request) {
  try {
    const user = await getAuthedUser();

    const ip = getIp(req);
    // 60 req/min per user+ip (listing is cheaper)
    rateLimitOrThrow(`chat:list:${user.id}:${ip}`, 60, 60_000);

    const messages = await listRecentMessages(user.id, 30);
    return ok({ messages });
  } catch (e: any) {
    if (e instanceof AppError) {
      if (e.code === "RATE_LIMITED") return rateLimitedResponse(e.message);
      return fail(e.code, e.message, e.status);
    }
    return fail("SERVER_ERROR", "Something went wrong", 500);
  }
}
