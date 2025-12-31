import { ok, fail } from "@/lib/response";
import { AppError } from "@/lib/errors";
import { getAuthedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimitOrThrow } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/ip";
import { runChat } from "@/services/chat.service";
import { chatSchema } from "@/validators/chat.schema";
import { failRateLimited } from "@/lib/http-errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChatMode = "medical" | "therapy" | "recipe" | "dental";

/** fail() در پروژه شما AppError نمی‌گیرد؛ این helper تبدیل می‌کند */
function appFail(e: AppError, init?: ResponseInit) {
  return fail(e.code, e.message, e.status, e.extra, init);
}

function parseModeOrThrow(raw: string | null): ChatMode {
  const m = (raw ?? "medical") as string;
  if (m === "medical" || m === "therapy" || m === "recipe" || m === "dental") return m;
  throw new AppError("INVALID_INPUT", "Invalid mode", 400, { mode: m });
}

export async function GET(req: Request) {
  try {
    const user = await getAuthedUser();
    if (!user) return fail("UNAUTHENTICATED", "Please login", 401);

    const ip = getClientIp(req);

    // rate limit GET هم (سبک‌تر): 60 req/min
    try {
      rateLimitOrThrow(`chat_get:${user.id}:${ip}`, 60, 60_000);
    } catch (e: any) {
      if (e instanceof AppError && e.code === "RATE_LIMITED") return failRateLimited(e);
      throw e;
    }

    const url = new URL(req.url);
    const mode = parseModeOrThrow(url.searchParams.get("mode"));

    const messages = await prisma.chatMessage.findMany({
      where: { userId: user.id, mode },
      orderBy: { createdAt: "asc" },
      take: 200,
      select: {
        id: true,
        role: true,
        content: true,
        mode: true,
        createdAt: true,
      },
    });

    return ok({ messages });
  } catch (e: any) {
    if (e instanceof AppError) return appFail(e);
    return fail("SERVER_ERROR", "Failed to load messages", 500);
  }
}

export async function POST(req: Request) {
  try {
    const user = await getAuthedUser();
    if (!user) return fail("UNAUTHENTICATED", "Please login", 401);

    const ip = getClientIp(req);

    // rate limit: 30 req/min
    try {
      rateLimitOrThrow(`chat:${user.id}:${ip}`, 30, 60_000);
    } catch (e: any) {
      if (e instanceof AppError && e.code === "RATE_LIMITED") return failRateLimited(e);
      throw e;
    }

    const body = await req.json().catch(() => ({}));

    // chatSchema باید dental رو هم قبول کند:
    // z.enum(["medical","therapy","recipe","dental"])
    const parsed = chatSchema.safeParse(body);
    if (!parsed.success) {
      return fail("INVALID_INPUT", "Invalid input", 400, parsed.error.flatten?.());
    }

    const { message, mode } = parsed.data as { message: string; mode: ChatMode };

    // safety: اگر کسی schema رو دور زد
    const safeMode = parseModeOrThrow(mode);

    const result = await runChat({
      userId: user.id,
      message,
      mode: safeMode,
    });

    return ok(result);
  } catch (e: any) {
    if (e?.name === "ZodError") return fail("INVALID_INPUT", "Invalid input", 400, e.flatten?.());
    if (e instanceof AppError) return appFail(e);
    return fail("SERVER_ERROR", "Something went wrong", 500);
  }
}
