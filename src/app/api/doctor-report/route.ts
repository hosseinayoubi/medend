import { ok, fail } from "@/lib/response";
import { AppError } from "@/lib/errors";
import { getAuthedUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rateLimitOrThrow } from "@/lib/rate-limit";
import { z } from "zod";

const bodySchema = z.object({
  language: z.string().min(2).max(16).default("en"),
});

export async function GET() {
  try {
    const user = await getAuthedUser();
    rateLimitOrThrow(`doctor-report:list:${user.id}`, 30, 60_000);

    const reports = await prisma.doctorReport.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, language: true, content: true, createdAt: true },
    });

    return ok({ reports });
  } catch (e: any) {
    if (e instanceof AppError) return fail(e.code, e.message, e.status, (e as any).extra);
    return fail("SERVER_ERROR", "Something went wrong", 500);
  }
}

export async function POST(req: Request) {
  try {
    const user = await getAuthedUser();
    rateLimitOrThrow(`doctor-report:create:${user.id}`, 10, 60_000);

    const body = bodySchema.parse(await req.json().catch(() => ({})));

    // نسخه ساده: یک گزارش placeholder ذخیره می‌کنیم تا build/flow درست شود
    const created = await prisma.doctorReport.create({
      data: {
        userId: user.id,
        language: body.language,
        content: "Report generation is temporarily in safe mode. Backend is healthy.",
      },
      select: { id: true, language: true, content: true, createdAt: true },
    });

    return ok({ report: created });
  } catch (e: any) {
    if (e?.name === "ZodError") return fail("INVALID_INPUT", "Invalid input", 400, e.flatten?.());
    if (e instanceof AppError) return fail(e.code, e.message, e.status, (e as any).extra);
    return fail("SERVER_ERROR", "Something went wrong", 500);
  }
}
