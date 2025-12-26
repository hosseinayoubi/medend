import { ok, fail } from "@/lib/response";
import { AppError } from "@/lib/errors";
import { loginSchema } from "@/validators/auth.schema";
import { prisma } from "@/lib/prisma";
import { rateLimitOrThrow } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/ip";
import { failRateLimited } from "@/lib/http-errors";
import { setSessionCookie } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);

    try {
      rateLimitOrThrow(`login:${ip}`, 10, 60_000);
    } catch (e: any) {
      if (e instanceof AppError && e.code === "RATE_LIMITED") return failRateLimited(e);
      throw e;
    }

    const body = await req.json().catch(() => ({}));
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return fail("INVALID_INPUT", "Invalid input", 400, parsed.error.flatten?.());
    }

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return fail("INVALID_CREDENTIALS", "Invalid email or password", 401);

    // اگر پروژه‌ات bcryptjs دارد (طبق deps)، احتمالاً verify این شکلیه:
    const bcrypt = await import("bcryptjs");
    const okPass = await bcrypt.compare(password, user.passwordHash ?? user.password ?? "");
    if (!okPass) return fail("INVALID_CREDENTIALS", "Invalid email or password", 401);

    // ✅ سشن/کوکی
    await setSessionCookie(user.id);

    return ok({ user: { id: user.id, email: user.email } });
  } catch (e: any) {
    if (e?.name === "ZodError") return fail("INVALID_INPUT", "Invalid input", 400, e.flatten?.());
    if (e instanceof AppError) return fail(e.code, e.message, e.status, (e as any).extra);
    return fail("SERVER_ERROR", "Login failed", 500);
  }
}
