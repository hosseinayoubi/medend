import { ok, fail } from "@/lib/response";
import { AppError } from "@/lib/errors";
import { getAuthedUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getAuthedUser(); // ✅ FIX: no args
    if (!user) return fail("UNAUTHENTICATED", "Please login", 401);

    // معمولاً getAuthedUser خودش اطلاعات کافی می‌ده
    return ok({ user });
  } catch (e: any) {
    if (e instanceof AppError) return fail(e.code, e.message, e.status, (e as any).extra);
    return fail("SERVER_ERROR", "Something went wrong", 500);
  }
}
