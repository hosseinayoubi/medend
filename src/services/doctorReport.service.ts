import { prisma } from "@/lib/db";
import { getLlmProvider } from "@/lib/llm";
import type { ChatMode } from "@/lib/llm/provider";

/**
 * Generates a clinician-friendly report (SOAP-style) from text-only data:
 * - Intake questionnaire (questionnaireResponse)
 * - Journal snapshot
 * - Recent chat messages
 *
 * Output: Markdown.
 */
export async function generateDoctorReport(opts: { userId: string; language: string }) {
  const user = await prisma.user.findUnique({
    where: { id: opts.userId },
    select: { email: true, name: true },
  });

  const [journal, questionnaire, recent] = await Promise.all([
    prisma.journal.findUnique({ where: { userId: opts.userId } }),
    prisma.questionnaireResponse.findUnique({ where: { userId: opts.userId } }),
    prisma.chatMessage.findMany({
      where: { userId: opts.userId },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: { createdAt: true, role: true, mode: true, content: true },
    }),
  ]);

  const payload = {
    user: { name: user?.name ?? null },
    questionnaire: questionnaire?.data ?? {},
    journal: journal?.data ?? {},
    recentMessages: recent.reverse().map((m) => ({
      ts: m.createdAt,
      role: m.role,
      mode: m.mode,
      content: m.content,
    })),
  };

  const language = (opts.language || "English").trim();

  // If OpenAI is configured, generate a proper clinical note.
  if (process.env.OPENAI_API_KEY) {
    const provider = getLlmProvider();

    const prompt = [
      "You are a clinical documentation assistant.",
      "Write a doctor-friendly clinical note in SOAP style.",
      "",
      "Output MUST be Markdown, with these exact section headers in this exact order:",
      "1) Chief Complaint (CC)",
      "2) History of Present Illness (HPI)",
      "3) Symptom Timeline",
      "4) Medications",
      "5) Allergies",
      "6) Past Medical/Surgical History",
      "7) Review of Systems (ROS)",
      "8) Objective (if available)",
      "9) Assessment (Differential Diagnosis)",
      "10) Plan (Next steps)",
      "11) Red Flags (When to seek urgent care)",
      "12) Disclaimer",
      "",
      "Rules:",
      "- Write in the target language exactly.",
      "- Be factual; separate patient-reported vs suggestions.",
      "- If information is missing, write 'Not provided' (do NOT invent).",
      "- Keep it concise and skimmable; use bullet points where helpful.",
      "- Do not include private identifiers (no email).",
      "- This is not a diagnosis; do not claim certainty.",
      "",
      `Target language: ${language}`,
      "",
      "Patient context (JSON):",
      JSON.stringify(payload, null, 2),
    ].join("\n");

    const res = await provider.respond({
      mode: "medical" as ChatMode,
      message: prompt,
      userId: opts.userId,
    });

    const content = res.answer.trim();
    const saved = await prisma.doctorReport.create({
      data: { userId: opts.userId, language, content },
    });

    return { id: saved.id, content };
  }

  // Fallback if no LLM configured: minimal structured note.
  const q: any = questionnaire?.data ?? {};
  const j: any = journal?.data ?? {};
  const recentLines = payload.recentMessages.slice(-12).map((m) => `- [${m.mode}] ${m.role}: ${m.content}`);

  const content =
    `# Chief Complaint (CC)\n` +
    `${q.chief_complaint ?? "Not provided"}\n\n` +
    `# History of Present Illness (HPI)\n` +
    `${q.health_concerns ?? "Not provided"}\n\n` +
    `# Symptom Timeline\n` +
    `${q.symptom_onset ? `- Onset: ${q.symptom_onset}` : "- Not provided"}\n\n` +
    `# Medications\n` +
    `${q.current_medications ?? j?.conditions?.medications ?? "Not provided"}\n\n` +
    `# Allergies\n` +
    `${q.allergies ?? "Not provided"}\n\n` +
    `# Past Medical/Surgical History\n` +
    `- Conditions: ${q.previous_illnesses ?? "Not provided"}\n` +
    `- Surgeries: ${q.previous_surgeries ?? "Not provided"}\n\n` +
    `# Review of Systems (ROS)\n` +
    `Not provided\n\n` +
    `# Objective (if available)\n` +
    `Not provided\n\n` +
    `# Assessment (Differential Diagnosis)\n` +
    `Not provided\n\n` +
    `# Plan (Next steps)\n` +
    `Not provided\n\n` +
    `# Red Flags (When to seek urgent care)\n` +
    `- If chest pain, severe shortness of breath, confusion, fainting, severe bleeding, or worsening severe symptoms, seek urgent care.\n\n` +
    `# Disclaimer\n` +
    `AI-generated summary for discussion with a clinician. Not a diagnosis.\n\n` +
    `---\n` +
    `Recent chat (for context):\n` +
    recentLines.join("\n");

  const saved = await prisma.doctorReport.create({
    data: { userId: opts.userId, language, content },
  });

  return { id: saved.id, content };
}

export async function listDoctorReports(userId: string) {
  return prisma.doctorReport.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
}
