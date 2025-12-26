import { prisma } from "@/lib/db";
import { getLlmProvider } from "@/lib/llm";
import type { ChatMode } from "@/lib/llm/provider";

/**
 * Core chat service (text-only MVP):
 * - stores user message
 * - calls LLM (medical/therapy/recipe)
 * - stores assistant message
 */
export async function runChat(opts: { userId: string; message: string; mode: ChatMode }) {
  const { userId, message, mode } = opts;

  await prisma.chatMessage.create({
    data: { userId, role: "user", mode, content: message },
  });

  const provider = getLlmProvider();

  try {
    const result = await provider.respond({ mode, message, userId });

    await prisma.chatMessage.create({
      data: { userId, role: "assistant", mode, content: result.answer },
    });

    return result;
  } catch (e) {
    const safe =
      mode === "medical"
        ? "I’m having trouble right now. I can’t provide medical advice in this state. If this is urgent, please contact a medical professional."
        : "I’m having trouble right now. Please try again in a moment.";

    await prisma.chatMessage.create({
      data: { userId, role: "assistant", mode, content: safe },
    });

    throw e;
  }
}

// ✅ اینو اضافه کن تا GET /api/chat درست build بشه
export async function listRecentMessages(userId: string, limit = 20) {
  const msgs = await prisma.chatMessage.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return msgs.reverse();
}
