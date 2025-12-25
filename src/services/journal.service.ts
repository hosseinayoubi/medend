import { prisma } from "@/lib/db";

/**
 * Central user Journal:
 * - Stores stable, user-specific structured info we learn from questionnaire/chat.
 * - Kept as JSON so it can evolve without schema churn.
 */
export async function updateJournalFromQuestionnaire(userId: string, questionnaire: Record<string, any>) {
  const now = new Date().toISOString();

  // Minimal structured snapshot (you can extend any time)
  const snapshot = {
    updatedAt: now,
    source: "questionnaire",
    personal: {
      age: questionnaire.age ?? null,
      gender: questionnaire.gender ?? null,
      country: questionnaire.country ?? null,
      height_cm: questionnaire.height_cm ?? null,
      weight_kg: questionnaire.weight_kg ?? null,
    },
    conditions: {
      diabetes: questionnaire.diabetes ?? null,
      hypertension: questionnaire.hypertension ?? null,
      heart_disease: questionnaire.heart_disease ?? null,
      mental_health: questionnaire.mental_health_conditions ?? null,
    },
    raw: questionnaire, // keep raw in case legacy keys differ
  };

  await prisma.journal.upsert({
    where: { userId },
    create: { userId, data: snapshot },
    update: { data: snapshot },
  });
}
