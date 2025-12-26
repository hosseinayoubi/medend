import { ok, fail } from "@/lib/response";
import { AppError } from "@/lib/errors";
import { loginSchema } from "@/validators/auth.schema";
import { loginUser } from "@/services/auth.service";
import { createSession } from "@/lib/auth";
import { rateLimitOrThrow } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/ip";
import { failRateLimited } from "@/lib/http-errors";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);

    rateLimitOrThrow(`auth:login:ip:${ip}`, 10, 60_000);

    const body = loginSchema.parse(await req.json());
    const email = body.email.toLowerCase();

    rateLimitOrThrow(`auth:login:email:${email}`, 10, 60_000);

    const user = await loginUser(email, body.password);

    await createSession(user.id);
    return ok({ user: { id: user.id, email: user.email, name: user.name ?? null } });
  } catch (e: any) {
    if (e?.name === "ZodError") {
      return fail("INVALID_INPUT", "Invalid input", 400, e.flatten?.());
    }

    if (e instanceof AppError) {
      if (e.code === "RATE_LIMITED") return failRateLimited(e);

      // جلوگیری از user enumeration
      return fail("INVALID_CREDENTIALS", "Invalid email or password", 401);
    }

    return fail("SERVER_ERROR", "Something went wrong", 500);
  }
}
