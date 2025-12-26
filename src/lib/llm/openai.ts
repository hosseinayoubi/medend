import type { LlmProvider, ChatMode } from "./provider";
import { AppError } from "@/lib/errors";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5-mini";

// پیش‌فرض 20 ثانیه (قابل تنظیم در env)
const LLM_TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS || 20_000);

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function isRetriableStatus(status: number) {
  return status === 429 || (status >= 500 && status <= 599);
}

function systemPrompt(mode: ChatMode) {
  if (mode === "therapy") {
    return [
      "You are a supportive, non-judgmental therapy-style assistant.",
      "Do not claim to be a licensed clinician.",
      "Encourage safe, practical next steps. If self-harm or crisis is mentioned, recommend contacting local emergency services or a trusted person.",
      "Keep it empathetic and concise.",
    ].join("\n");
  }

  if (mode === "recipe") {
    return [
      "You are a helpful cooking assistant.",
      "Return clear steps, ingredients, and time estimates.",
      "If allergies/diet restrictions are mentioned, adapt accordingly.",
      "Be concise and practical.",
    ].join("\n");
  }

  // medical
  return [
    "You are a medical information assistant.",
    "Do NOT provide a diagnosis. Ask clarifying questions when needed.",
    "Provide safe, general guidance and red-flag symptoms that require urgent care.",
    "Keep it concise and structured.",
  ].join("\n");
}

function disclaimer(mode: ChatMode) {
  if (mode === "therapy") {
    return "I’m not a licensed therapist. If you’re in danger or thinking about self-harm, please contact local emergency services or a trusted person right now.";
  }
  if (mode === "medical") {
    return "I’m not a doctor. This is general information, not a diagnosis. If symptoms are severe, worsening, or you’re worried, seek medical care.";
  }
  return "";
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

        // retry فقط یک‌بار برای خطای شبکه‌ای/نامعلوم
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
