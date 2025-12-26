export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);

    rateLimitOrThrow(`auth:register:ip:${ip}`, 5, 60_000);

    const body = registerSchema.parse(await req.json());
    const email = body.email.toLowerCase();

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

      // ✅ اگر دوست داری enumeration کمتر بشه:
      if (e.code === "EMAIL_TAKEN") {
        return fail("REGISTER_FAILED", "Unable to register", 400);
      }

      return fail(e.code, e.message, e.status, (e as any).extra);
    }
    return fail("SERVER_ERROR", "Something went wrong", 500);
  }
}
