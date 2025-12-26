import { ok, fail } from "@/lib/response";
import { AppError } from "@/lib/errors";
import { getAuthedUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rateLimitOrThrow } from "@/lib/rate-limit";

export async function GET() {
  try {
    const user = await getAuthedUser();
    rateLimitOrThrow(`journal:get:${user.id}`, 60, 60_000);

    const j = await prisma.journal.findUnique({ where: { userId: user.id } });
    return ok({ journal: j?.data ?? {} });
  } catch (e: any) {
    if (e instanceof AppError) return fail(e.code, e.message, e.status);
    return fail("SERVER_ERROR", "Something went wrong", 500);
  }
}
