import { ok, fail } from "@/lib/response";
import { AppError } from "@/lib/errors";
import { registerSchema } from "@/validators/auth.schema";
import { registerUser } from "@/services/auth.service";
import { createSession } from "@/lib/auth";
import { rateLimitOrThrow } from "@/lib/rate-limit";
import { failRateLimited } from "@/lib/http-errors";

export const dynamic = "force-dynamic";

// ✅ build-safe: بدون نیاز به import جدا
function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();

  const xrip = req.headers.get("x-real-ip");
  if (xrip) return xrip.trim();

  return "unknown";
}

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);

    // 5 req/min per IP (stricter to reduce sign-up spam)
    rateLimitOrThrow(`auth:register:ip:${ip}`, 5, 60_000);

    const body = registerSchema.parse(await req.json());
    const email = body.email.toLowerCase();

    // 5 req/min per email
    rateLimitOrThrow(`auth:register:email:${email}`, 5, 60_000);

    const user = await registerUser(email, body.password, body.name);

    await createSession(user.id);
    return ok({ user });
  } catch (e: any) {
    if (e?.name === "ZodError") {
      return fail("INVALID_INPUT", "Invalid input", 400, e.flatten?.());
    }

    if (e instanceof AppError) {
      if (e.code === "RATE_LIMITED") return failRateLimited(e);

      // ✅ کاهش enumeration:
      // اگر registerUser برای ایمیل تکراری EMAIL_TAKEN می‌دهد،
      // جواب را عمومی‌تر کنیم
      if (e.code === "EMAIL_TAKEN") {
        return fail("REGISTER_FAILED", "Unable to register", 400);
      }

      return fail(e.code, e.message, e.status, (e as any).extra);
    }

    return fail("SERVER_ERROR", "Something went wrong", 500);
  }
}
