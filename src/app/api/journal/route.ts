import { ok, fail } from "@/lib/response";
import { AppError } from "@/lib/errors";
import { getAuthedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { journalSchema } from "@/validators/journal.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = await getAuthedUser(); // ✅ FIX
    if (!user) return fail("UNAUTHENTICATED", "Please login", 401);

    const url = new URL(req.url);
    const take = Math.min(Number(url.searchParams.get("take") || 50), 200);

    const items = await prisma.journalEntry.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take,
    });

    return ok({ items });
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
    const parsed = journalSchema.safeParse(body);
    if (!parsed.success) {
      return fail("INVALID_INPUT", "Invalid input", 400, parsed.error.flatten?.());
    }

    const created = await prisma.journalEntry.create({
      data: {
        userId: user.id,
        ...parsed.data,
      },
    });

    return ok({ entry: created });
  } catch (e: any) {
    if (e?.name === "ZodError") return fail("INVALID_INPUT", "Invalid input", 400, e.flatten?.());
    if (e instanceof AppError) return fail(e.code, e.message, e.status, (e as any).extra);
    return fail("SERVER_ERROR", "Something went wrong", 500);
  }
}
