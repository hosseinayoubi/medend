import { ok, fail } from "@/lib/response";
import { AppError } from "@/lib/errors";
import { getAuthedUser } from "@/lib/auth";
import { rateLimitOrThrow } from "@/lib/rate-limit";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  language: z.string().min(2).max(16).default("en"),
});

/**
 * Safe resolver:
 * - مسیر سرویس واقعی: "@/services/doctorReport.service"
 * - اسم exportها ممکنه در پروژه شما کمی فرق داشته باشه
 * - این کد با runtime-check پیدا می‌کنه تا build نخوابه
 */
async function getDoctorReportService() {
  const mod = (await import("@/services/doctorReport.service")) as any;

  const generate =
    mod.generateDoctorReport ??
    mod.generateReport ??
    mod.createDoctorReport ??
    mod.buildDoctorReport;

  const list =
    mod.listDoctorReports ??
    mod.listReports ??
    mod.getDoctorReports ??
    mod.fetchDoctorReports;

  return { generate, list };
}

export async function GET() {
  try {
    const user = await getAuthedUser();
    rateLimitOrThrow(`doctor-report:list:${user.id}`, 30, 60_000);

    const svc = await getDoctorReportService();
    if (typeof svc.list !== "function") {
      return fail("SERVER_ERROR", "Doctor report list service is not available", 500);
    }

    const reports = await svc.list(user.id);
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

    const svc = await getDoctorReportService();
    if (typeof svc.generate !== "function") {
      return fail("SERVER_ERROR", "Doctor report generation service is not available", 500);
    }

    const report = await svc.generate({ userId: user.id, language: body.language });
    return ok({ report });
  } catch (e: any) {
    if (e?.name === "ZodError") return fail("INVALID_INPUT", "Invalid input", 400, e.flatten?.());
    if (e instanceof AppError) return fail(e.code, e.message, e.status, (e as any).extra);
    return fail("SERVER_ERROR", "Something went wrong", 500);
  }
}
