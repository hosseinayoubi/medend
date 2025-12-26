import { ok, fail } from "@/lib/response";
import { AppError } from "@/lib/errors";
import { getAuthedUser } from "@/lib/auth";
import { chatSchema } from "@/validators/chat.schema";
import { listRecentMessages } from "@/services/chat.service";
import { rateLimitOrThrow } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/ip";
import { failRateLimited } from "@/lib/http-errors";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5-mini";

const LLM_TIMEOUT_MS = 30_000;
const LLM_TIMEOUT_RECIPE_MS = 45_000;

const MAX_TOKENS_DEFAULT = 600;
const MAX_TOKENS_RECIPE = 900;

type ChatMode = "medical" | "therapy" | "recipe";
type Lang = "en" | "fa" | "ar" | "he";

function isRtl(lang: Lang) {
  return lang === "fa" || lang === "ar" || lang === "he";
}

function appFail(e: AppError, init?: ResponseInit) {
  return fail(e.code, e.message, e.status, e.extra, init);
}

/**
 * Heuristic:
 * - Hebrew range => he
 * - Arabic-script => fa by default (to satisfy Persian users)
 *   unless we see Arabic-specific letters/diacritics => ar
 */
function detectLang(text: string): Lang {
  // Hebrew
  if (/[\u0590-\u05FF]/.test(text)) return "he";

  // Arabic script (includes Persian/Urdu, etc)
  if (/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(text)) {
    const arabicOnly = /[ةؤئأإءًٌٍَُِّٰ]/;
    if (arabicOnly.test(text)) return "ar";
    return "fa";
  }

  return "en";
}

function normalizeFa(s: string) {
  return s
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/([،؛:!?؟])(?=\S)/g, "$1 ")
    .replace(/\s{2,}/g, " ");
}

function disclaimer(mode: ChatMode, lang: Lang) {
  if (mode === "therapy") {
    return lang === "fa"
      ? "یادآوری: من درمانگر یا متخصص مجاز نیستم. اگر احساس خطر فوری داری با اورژانس/خدمات اضطراری تماس بگیر."
      : "Reminder: I’m not a licensed clinician. If you’re in immediate danger, contact emergency services.";
  }
  if (mode === "medical") {
    return lang === "fa"
      ? "یادآوری: این اطلاعات جایگزین نظر پزشک نیست. اگر وضعیت اورژانسی است فوراً به اورژانس مراجعه کن."
      : "Reminder: This isn’t medical advice. If this is an emergency, seek urgent care.";
  }
  return "";
}

function systemPrompt(mode: ChatMode, lang: Lang) {
  const base =
    lang === "fa"
      ? "پاسخ را به فارسی روان بده. مختصر، دقیق، و کاربردی."
      : lang === "ar"
      ? "أجب باللغة العربية. كن موجزًا ودقيقًا وعمليًا."
      : lang === "he"
      ? "ענה בעברית. היה/י תמציתי/ת, מדויק/ת ומעשי/ת."
      : "Answer in English. Be concise, accurate, and practical.";

  if (mode === "therapy") {
    return [
      base,
      "You are a supportive, non-judgmental therapy-style assistant.",
      "Do not claim to be a licensed clinician.",
      "Ask 1-2 gentle follow-up questions when helpful.",
      "Include a brief safety disclaimer if relevant.",
    ].join(" ");
  }

  if (mode === "recipe") {
    return [
      base,
      "You are a nutrition-minded recipe assistant.",
      "Return 3 recipe options with: ingredients, steps, estimated calories, protein/carbs/fat.",
      "Ask for allergies/diet preference if missing.",
      "Keep formatting clean with line breaks and bullets.",
    ].join(" ");
  }

  return [
    base,
    "You are a careful medical information assistant.",
    "Do not diagnose. Provide possible explanations and safe next steps.",
    "Include red flags that require urgent care.",
  ].join(" ");
}

function sseEvent(event: string, data: string) {
  return `event: ${event}\ndata: ${data}\n\n`;
}

async function fetchOpenAiJson(opts: {
  mode: ChatMode;
  lang: Lang;
  message: string;
  signal: AbortSignal;
}) {
  const { mode, lang, message, signal } = opts;

  if (!OPENAI_API_KEY) throw new AppError("LLM_MISCONFIG", "OPENAI_API_KEY missing", 500);

  const timeoutMs = mode === "recipe" ? LLM_TIMEOUT_RECIPE_MS : LLM_TIMEOUT_MS;
  const maxTokens = mode === "recipe" ? MAX_TOKENS_RECIPE : MAX_TOKENS_DEFAULT;

  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener("abort", abort);

  const t = setTimeout(() => controller.abort(), timeoutMs);

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
        stream: false,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: systemPrompt(mode, lang) },
          { role: "user", content: message },
        ],
      }),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new AppError("LLM_ERROR", `OpenAI error: ${res.status} ${txt}`.slice(0, 700), 502);
    }

    const json: any = await res.json();
    const content = json?.choices?.[0]?.message?.content ?? "";

    const final = lang === "fa" ? normalizeFa(String(content)) : String(content).trim();
    return { answer: final, disclaimer: disclaimer(mode, lang) };
  } catch (e: any) {
    if (e?.name === "AbortError") throw new AppError("LLM_TIMEOUT", "LLM request timed out", 504);
    if (e instanceof AppError) throw e;
    throw new AppError("LLM_ERROR", "LLM request failed", 502);
  } finally {
    clearTimeout(t);
    signal.removeEventListener("abort", abort);
  }
}

async function fetchOpenAiStream(opts: {
  mode: ChatMode;
  lang: Lang;
  message: string;
  onToken: (t: string) => void;
  signal: AbortSignal;
}) {
  const { mode, lang, message, onToken, signal } = opts;

  if (!OPENAI_API_KEY) throw new AppError("LLM_MISCONFIG", "OPENAI_API_KEY missing", 500);

  const timeoutMs = mode === "recipe" ? LLM_TIMEOUT_RECIPE_MS : LLM_TIMEOUT_MS;
  const maxTokens = mode === "recipe" ? MAX_TOKENS_RECIPE : MAX_TOKENS_DEFAULT;

  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener("abort", abort);

  const t = setTimeout(() => controller.abort(), timeoutMs);

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
        stream: true,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: systemPrompt(mode, lang) },
          { role: "user", content: message },
        ],
      }),
    });

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      throw new AppError("LLM_ERROR", `OpenAI error: ${res.status} ${text}`.slice(0, 700), 502);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    let buffer = "";
    let full = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const parts = buffer.split("\n\n");
      buffer = parts.pop() || "";

      for (const block of parts) {
        const dataLine = block.split("\n").find((l) => l.startsWith("data:"));
        if (!dataLine) continue;

        const payload = dataLine.replace(/^data:\s*/, "");
        if (payload === "[DONE]") {
          const final = lang === "fa" ? normalizeFa(full) : full.trim();
          return { answer: final, disclaimer: disclaimer(mode, lang) };
        }

        try {
          const json = JSON.parse(payload);
          const delta = json?.choices?.[0]?.delta?.content ?? "";
          if (delta) {
            full += delta;
            onToken(delta);
          }
        } catch {
          // ignore
        }
      }
    }

    const final = lang === "fa" ? normalizeFa(full) : full.trim();
    return { answer: final, disclaimer: disclaimer(mode, lang) };
  } catch (e: any) {
    if (e?.name === "AbortError") throw new AppError("LLM_TIMEOUT", "LLM request timed out", 504);
    if (e instanceof AppError) throw e;
    throw new AppError("LLM_ERROR", "LLM request failed", 502);
  } finally {
    clearTimeout(t);
    signal.removeEventListener("abort", abort);
  }
}

export async function GET() {
  try {
    const user = await getAuthedUser();
    const messages = await listRecentMessages(user.id, 50);
    return ok({ messages });
  } catch (e: any) {
    // ✅ fail() signature fix
    if (e?.code === "UNAUTHENTICATED") {
      return fail("UNAUTHENTICATED", "Please login", 401);
    }
    return fail("SERVER_ERROR", "Failed to load messages", 500);
  }
}

export async function POST(req: Request) {
  try {
    const user = await getAuthedUser();
    const ip = getClientIp(req);
    rateLimitOrThrow(`chat:${user.id}:${ip}`, 30, 60_000);

    const rawBody: any = await req.json();
    const body = chatSchema.parse(rawBody);

    const mode = body.mode as ChatMode;
    const message = body.message as string;

    const lang = detectLang(message);

    const wantStream =
      rawBody?.stream === true ||
      req.headers.get("accept")?.includes("text/event-stream") === true;

    if (!wantStream) {
      await prisma.chatMessage.create({
        data: { userId: user.id, role: "user", mode, content: message },
      });

      const result = await fetchOpenAiJson({
        mode,
        lang,
        message,
        signal: req.signal, // ✅ respects client abort
      });

      await prisma.chatMessage.create({
        data: { userId: user.id, role: "assistant", mode, content: result.answer },
      });

      return ok({
        mode,
        answer: result.answer,
        disclaimer: result.disclaimer,
        lang,
        dir: isRtl(lang) ? "rtl" : "ltr",
      });
    }

    const encoder = new TextEncoder();
    const aborter = new AbortController();

    await prisma.chatMessage.create({
      data: { userId: user.id, role: "user", mode, content: message },
    });

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        (async () => {
          let fullAnswer = "";

          try {
            controller.enqueue(
              encoder.encode(
                sseEvent("meta", JSON.stringify({ mode, lang, dir: isRtl(lang) ? "rtl" : "ltr" }))
              )
            );

            const result = await fetchOpenAiStream({
              mode,
              lang,
              message,
              signal: aborter.signal,
              onToken: (t) => {
                if (!t) return;
                fullAnswer += t;
                controller.enqueue(encoder.encode(sseEvent("token", t)));
              },
            });

            const final = lang === "fa" ? normalizeFa(fullAnswer) : fullAnswer.trim();

            await prisma.chatMessage.create({
              data: { userId: user.id, role: "assistant", mode, content: final },
            });

            controller.enqueue(
              encoder.encode(
                sseEvent(
                  "done",
                  JSON.stringify({
                    mode,
                    lang,
                    dir: isRtl(lang) ? "rtl" : "ltr",
                    answer: final,
                    disclaimer: result.disclaimer || "",
                  })
                )
              )
            );
          } catch (e: any) {
            const msg = e?.message ? String(e.message) : "Stream error";
            controller.enqueue(encoder.encode(sseEvent("error", msg)));
          } finally {
            controller.close();
          }
        })();
      },
      cancel() {
        aborter.abort();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (e: any) {
    if (e instanceof AppError) {
      if (e.code === "RATE_LIMIT") return failRateLimited(e);
      return appFail(e); // ✅ fail() signature fix
    }
    return fail("SERVER_ERROR", "Unexpected error", 500);
  }
}
