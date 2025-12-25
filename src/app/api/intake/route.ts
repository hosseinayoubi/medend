import { ok, fail } from "@/lib/response";
import { AppError } from "@/lib/errors";
import { getAuthedUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rateLimitOrThrow } from "@/lib/rate-limit";
import { z } from "zod";
import { updateJournalFromQuestionnaire } from "@/services/journal.service";

const intakeSchema = z.record(z.string(), z.any());

export async function GET() {
  try {
    const user = await getAuthedUser();
    rateLimitOrThrow(`intake:get:${user.id}`, 60, 60_000);

    const existing = await prisma.questionnaireResponse.findUnique({ where: { userId: user.id } });
    return ok({ data: existing?.data ?? null });
  } catch (e: any) {
    if (e instanceof AppError) return fail(e.code, e.message, e.status);
    return fail("SERVER_ERROR", "Something went wrong", 500);
  }
}

export async function POST(req: Request) {
  try {
    const user = await getAuthedUser();
    rateLimitOrThrow(`intake:post:${user.id}`, 30, 60_000);

    const data = intakeSchema.parse(await req.json());

    const saved = await prisma.questionnaireResponse.upsert({
      where: { userId: user.id },
      update: { data },
      create: { userId: user.id, data },
    });

    // Keep journal in sync for better chat/report context
    await updateJournalFromQuestionnaire(user.id, data as any);

    return ok({ saved: true, updatedAt: saved.updatedAt });
  } catch (e: any) {
    if (e?.name === "ZodError") return fail("INVALID_INPUT", "Invalid input", 400, e.flatten?.());
    if (e instanceof AppError) return fail(e.code, e.message, e.status);
    return fail("SERVER_ERROR", "Something went wrong", 500);
  }
}
