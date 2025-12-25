import type { LlmProvider, ChatMode } from "./provider";
import { AppError } from "@/lib/errors";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

/**
 * Minimal OpenAI Chat Completions request via fetch.
 * You can swap to the Responses API later without changing your app surface.
 */
function systemPrompt(mode: ChatMode) {
  if (mode === "therapy") {
    return [
      "You are a supportive, non-judgmental therapy-style assistant.",
      "Do not claim to be a licensed clinician.",
      "Encourage safe, practical next steps, and suggest professional help if crisis signals appear.",
      "Keep responses concise, warm, and ask 1-2 gentle follow-up questions.",
      "Add a brief disclaimer at the end."
    ].join(" ");
  }
  if (mode === "recipe") {
    return [
      "You are a nutrition-minded recipe assistant.",
      "Return 3 recipe options with: ingredients, steps, estimated calories, protein/carbs/fat.",
      "Ask for allergies/diet preference if missing.",
      "Keep it practical and fast (15-30 min) unless user asks otherwise."
    ].join(" ");
  }
  return [
    "You are a medical information assistant.",
    "You must not provide definitive diagnosis.",
    "Ask clarifying questions, flag red-flag symptoms, advise seeking professional care when appropriate.",
    "Keep it safe and include a disclaimer."
  ].join(" ");
}

function disclaimer(mode: ChatMode) {
  if (mode === "therapy") return "Not a substitute for professional mental health care.";
  if (mode === "medical") return "This is not medical advice and does not replace a doctor.";
  return undefined;
}

export const openaiProvider: LlmProvider = {
  async respond({ mode, message }) {
    if (!OPENAI_API_KEY) throw new AppError("LLM_NOT_CONFIGURED", "OPENAI_API_KEY is missing", 500);

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0.4,
        messages: [
          { role: "system", content: systemPrompt(mode) },
          { role: "user", content: message }
        ]
      })
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new AppError("LLM_ERROR", `OpenAI error: ${res.status} ${text}`.slice(0, 500), 502);
    }

    const data = await res.json() as any;
    const answer = data?.choices?.[0]?.message?.content ?? "";
    return { mode, answer, disclaimer: disclaimer(mode) };
  }
};
