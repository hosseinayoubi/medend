import { ok, fail } from "@/lib/response";
import { AppError } from "@/lib/errors";
import { getAuthedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { intakeSchema } from "@/validators/intake.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getAuthedUser(); // ✅ FIX
    if (!user) return fail("UNAUTHENTICATED", "Please login", 401);

    // اگر مدل Intake در پروژه‌ات اسمش فرق دارد، اینجا را اصلاح کن
    const intake = await prisma.intake.findUnique({
      where: { userId: user.id },
    });

    return ok({ intake });
  } catch (e: any) {
    if (e instanceof AppError) return fail(e.code, e.message, e.status, (e as any).extra);
    return fail("SERVER_ERROR", "Something went wrong", 500);
  }
}

export async function POST(req: Request) {
  try {
    const user = await getAuthedUser(); // ✅ FIX
    if (!user) return fail("UNAUTHENTICATED", "Please login", 401);

    const body = await req.json().catch(() => ({}));
    const parsed = intakeSchema.safeParse(body);
    if (!parsed.success) {
      return fail("INVALID_INPUT", "Invalid input", 400, parsed.error.flatten?.());
    }

    const saved = await prisma.intake.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...parsed.data },
      update: { ...parsed.data },
    });

    return ok({ intake: saved });
  } catch (e: any) {
    if (e?.name === "ZodError") return fail("INVALID_INPUT", "Invalid input", 400, e.flatten?.());
    if (e instanceof AppError) return fail(e.code, e.message, e.status, (e as any).extra);
    return fail("SERVER_ERROR", "Something went wrong", 500);
  }
}
