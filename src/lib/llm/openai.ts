import type { LlmProvider, ChatMode } from "./provider";
import { AppError } from "@/lib/errors";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5-mini";

// پیش‌فرض 20 ثانیه
const LLM_TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS || 20_000);

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function isRetriableStatus(status: number) {
  return status === 429 || (status >= 500 && status <= 599);
}

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
      "Add a brief disclaimer at the end.",
    ].join(" ");
  }
  if (mode === "recipe") {
    return [
      "You are a nutrition-minded recipe assistant.",
      "Return 3 recipe options with: ingredients, steps, estimated calories, protein/carbs/fat.",
      "Ask for allergies/diet preference if missing.",
      "Keep it practical and fast (15-30 min) unless user asks otherwise.",
    ].join(" ");
  }
  return [
    "You are a medical information assistant.",
    "You must not provide definitive diagnosis.",
    "Ask clarifying questions, flag red-flag symptoms, advise seeking professional care when appropriate.",
    "Keep it safe and include a disclaimer.",
  ].join(" ");
}

function disclaimer(mode: ChatMode) {
  if (mode === "therapy") return "Not a substitute for professional mental health care.";
  if (mode === "medical") return "This is not medical advice and does not replace a doctor.";
  return undefined;
}

export const openaiProvider: LlmProvider = {
  async respond({ mode, message }) {
    if (!OPENAI_API_KEY) {
      throw new AppError("LLM_MISCONFIG", "OPENAI_API_KEY missing", 500);
    }

    // 1 retry سبک برای خطاهای transient
    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

      try {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: OPENAI_MODEL,
            // NOTE: Do NOT send temperature for gpt-5-mini here.
            messages: [
              { role: "system", content: systemPrompt(mode) },
              { role: "user", content: message },
            ],
          }),
        });

        clearTimeout(timeout);

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          if (attempt === 0 && isRetriableStatus(res.status)) {
            await sleep(250);
            continue;
          }
          throw new AppError(
            "LLM_ERROR",
            `OpenAI error: ${res.status} ${text}`.slice(0, 500),
            502
          );
        }

        const data = (await res.json()) as any;
        const answer = data?.choices?.[0]?.message?.content ?? "";

        return { mode, answer, disclaimer: disclaimer(mode) };
      } catch (e: any) {
        clearTimeout(timeout);

        if (e?.name === "AbortError") {
          throw new AppError("LLM_TIMEOUT", "LLM request timed out", 504);
        }

        if (attempt === 0) {
          await sleep(250);
          continue;
        }

        if (e instanceof AppError) throw e;
        throw new AppError("LLM_ERROR", "LLM request failed", 502);
      }
    }

    throw new AppError("LLM_ERROR", "LLM failed", 502);
  },
};
