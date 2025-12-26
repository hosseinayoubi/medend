import { ok, fail } from "@/lib/response";
import { AppError } from "@/lib/errors";
import { getAuthedUser } from "@/lib/auth";
import { rateLimitOrThrow } from "@/lib/rate-limit";
import { z } from "zod";
import { generateDoctorReport } from "@/services/doctorReport.service";
import { listDoctorReports } from "@/services/doctorReport.service";

const bodySchema = z.object({
  language: z.string().min(2).max(16).default("en"),
});

export async function POST(req: Request) {
  try {
    const user = await getAuthedUser();
    rateLimitOrThrow(`doctor-report:${user.id}`, 10, 60_000);

    const body = bodySchema.parse(await req.json().catch(() => ({})));
    const report = await generateDoctorReport({ userId: user.id, language: body.language });
    return ok({ report });
  } catch (e: any) {
    if (e?.name === "ZodError") return fail("INVALID_INPUT", "Invalid input", 400, e.flatten?.());
    if (e instanceof AppError) return fail(e.code, e.message, e.status);
    return fail("SERVER_ERROR", "Something went wrong", 500);
  }
}

export async function GET() {
  try {
    const user = await getAuthedUser();
    rateLimitOrThrow(`doctor-report:list:${user.id}`, 30, 60_000);

    const reports = await listDoctorReports(user.id);
    return ok({ reports });
  } catch (e: any) {
    if (e instanceof AppError) return fail(e.code, e.message, e.status);
    return fail("SERVER_ERROR", "Something went wrong", 500);
  }
}
