import { ok, fail } from "@/lib/response";
import { AppError } from "@/lib/errors";
import { registerSchema } from "@/validators/auth.schema";
import { registerUser } from "@/services/auth.service";
import { createSession } from "@/lib/auth";
import { rateLimitOrThrow } from "@/lib/rate-limit";

export async function POST(req: Request) {
  try {
    rateLimitOrThrow("auth:register", 10, 60_000);

    const body = registerSchema.parse(await req.json());
    const user = await registerUser(body.email.toLowerCase(), body.password, body.name);

    await createSession(user.id);
    return ok({ user });
  } catch (e: any) {
    if (e?.name === "ZodError") return fail("INVALID_INPUT", "Invalid input", 400, e.flatten?.());
    if (e instanceof AppError) return fail(e.code, e.message, e.status);
    return fail("SERVER_ERROR", "Something went wrong", 500);
  }
}
