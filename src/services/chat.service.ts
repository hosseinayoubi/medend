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
    // fallback امن (خصوصاً اگر provider خراب شد)
    const safe =
      mode === "medical"
        ? "I’m having trouble right now. I can’t provide medical advice in this state. If this is urgent, please contact a medical professional."
        : "I’m having trouble right now. Please try again in a moment.";

    await prisma.chatMessage.create({
      data: { userId, role: "assistant", mode, content: safe },
    });

    throw e; // یا اگر دوست داری به جای throw، همین safe رو ok برگردونی
  }
}
