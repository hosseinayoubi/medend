import { ok, fail } from "@/lib/response";
import { AppError } from "@/lib/errors";
import { registerSchema } from "@/validators/auth.schema";
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
      rateLimitOrThrow(`register:${ip}`, 10, 60_000);
    } catch (e: any) {
      if (e instanceof AppError && e.code === "RATE_LIMITED") return failRateLimited(e);
      throw e;
    }

    const body = await req.json().catch(() => ({}));
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return fail("INVALID_INPUT", "Invalid input", 400, parsed.error.flatten?.());
    }

    const { email, password } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return fail("EMAIL_TAKEN", "Email already in use", 409);

    const bcrypt = await import("bcryptjs");
    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        status: "active",
      },
      select: { id: true, email: true },
    });

    await setSessionCookie(user.id);

    return ok({ user });
  } catch (e: any) {
    if (e?.name === "ZodError") return fail("INVALID_INPUT", "Invalid input", 400, e.flatten?.());
    if (e instanceof AppError) return fail(e.code, e.message, e.status, (e as any).extra);
    return fail("SERVER_ERROR", "Register failed", 500);
  }
}
