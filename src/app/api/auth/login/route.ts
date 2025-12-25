import { ok, fail } from "@/lib/response";
import { AppError } from "@/lib/errors";
import { loginSchema } from "@/validators/auth.schema";
import { loginUser } from "@/services/auth.service";
import { createSession } from "@/lib/auth";
import { rateLimitOrThrow } from "@/lib/rate-limit";

export async function POST(req: Request) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";

    // 10 req/min per IP
    rateLimitOrThrow(`auth:login:ip:${ip}`, 10, 60_000);

    const body = loginSchema.parse(await req.json());
    const email = body.email.toLowerCase();

    // 10 req/min per email
    rateLimitOrThrow(`auth:login:email:${email}`, 10, 60_000);

    const user = await loginUser(email, body.password);

    await createSession(user.id);
    return ok({ user: { id: user.id, email: user.email, name: user.name ?? null } });
  } catch (e: any) {
    if (e?.name === "ZodError") return fail("INVALID_INPUT", "Invalid input", 400, e.flatten?.());
    if (e instanceof AppError) return fail(e.code, e.message, e.status);
    return fail("SERVER_ERROR", "Something went wrong", 500);
  }
}
