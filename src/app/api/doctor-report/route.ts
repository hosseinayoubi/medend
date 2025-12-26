import { ok, fail } from "@/lib/response";
import { AppError } from "@/lib/errors";
import { getAuthedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { doctorReportSchema } from "@/validators/doctor-report.schema";
import { buildDoctorReport } from "@/services/doctor-report.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = await getAuthedUser(); // ✅ FIX
    if (!user) return fail("UNAUTHENTICATED", "Please login", 401);

    const body = await req.json().catch(() => ({}));
    const parsed = doctorReportSchema.safeParse(body);
    if (!parsed.success) {
      return fail("INVALID_INPUT", "Invalid input", 400, parsed.error.flatten?.());
    }

    // داده‌های لازم برای report
    const intake = await prisma.intake.findUnique({ where: { userId: user.id } });

    const lastMessages = await prisma.chatMessage.findMany({
      where: { userId: user.id, mode: "medical" },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { role: true, content: true, createdAt: true },
    });

    const report = await buildDoctorReport({
      userId: user.id,
      language: parsed.data.language,
      intake,
      messages: lastMessages,
    });

    return ok({ reportMarkdown: report });
  } catch (e: any) {
    if (e?.name === "ZodError") return fail("INVALID_INPUT", "Invalid input", 400, e.flatten?.());
    if (e instanceof AppError) return fail(e.code, e.message, e.status, (e as any).extra);
    return fail("SERVER_ERROR", "Something went wrong", 500);
  }
}
