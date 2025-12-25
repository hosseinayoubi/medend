import { ok, fail } from "@/lib/response";
import { AppError } from "@/lib/errors";
import { getAuthedUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getAuthedUser();
    return ok({ user: { id: user.id, email: user.email, name: user.name ?? null } });
  } catch (e: any) {
    if (e instanceof AppError) return fail(e.code, e.message, e.status);
    return fail("SERVER_ERROR", "Something went wrong", 500);
  }
}
