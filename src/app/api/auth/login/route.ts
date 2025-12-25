import { ok, fail } from "@/lib/response";
import { AppError } from "@/lib/errors";
import { loginSchema } from "@/validators/auth.schema";
import { loginUser } from "@/services/auth.service";
import { createSession } from "@/lib/auth";
import { rateLimitOrThrow } from "@/lib/rate-limit";

export async function POST(req: Request) {
  try {
    rateLimitOrThrow("auth:login", 10, 60_000);

    const body = loginSchema.parse(await req.json());
    const user = await loginUser(body.email.toLowerCase(), body.password);

    await createSession(user.id);
    return ok({ user: { id: user.id, email: user.email, name: user.name ?? null } });
  } catch (e: any) {
    if (e?.name === "ZodError") return fail("INVALID_INPUT", "Invalid input", 400, e.flatten?.());
    if (e instanceof AppError) return fail(e.code, e.message, e.status);
    return fail("SERVER_ERROR", "Something went wrong", 500);
  }
}
