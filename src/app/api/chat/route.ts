import { ok, fail } from "@/lib/response";
import { AppError } from "@/lib/errors";
import { getAuthedUser } from "@/lib/auth";
import { chatSchema } from "@/validators/chat.schema";
import { listRecentMessages } from "@/services/chat.service";
import { rateLimitOrThrow } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/ip";
import { failRateLimited } from "@/lib/http-errors";
import { prisma } from "@/lib/db";

// برای استریم روی Next/Vercel
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5-mini";

const LLM_TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS || 20_000);
const LLM_TIMEOUT_RECIPE_MS = Number(process.env.LLM_TIMEOUT_RECIPE_MS || 35_000);

const MAX_TOKENS_DEFAULT = Number(process.env.LLM_MAX_TOKENS || 550);
const MAX_TOKENS_RECIPE = Number(process.env.LLM_MAX_TOKENS_RECIPE || 700);

type ChatMode = "medical" | "therapy" | "recipe";

function systemPrompt(mode: ChatMode) {
  if (mode === "therapy") {
    return [
      "You are a supportive, non-judgmental therapy-style assistant.",
      "Do not claim to be a licensed clinician.",
      "Be empathetic and concise.",
      "Ask 1-2 gentle follow-up questions when helpful.",
      "If self-harm/crisis is mentioned, advise contacting local emergency services or a trusted person.",
    ].join("\n");
  }

  if (mode === "recipe") {
    return [
      "You are a practical recipe assistant.",
      "Return ONE best recipe tailored to the user’s message.",
      "Format strictly as:",
      "1) Title",
      "2) Ingredients (bullets)",
      "3) Steps (numbered, max 7 steps)",
      "4) Time (prep/cook/total)",
      "5) Estimated calories (rough)",
      "Keep it short. Do not provide multiple recipe options unless the user asks.",
    ].join("\n");
  }

  return [
    "You are a medical information assistant.",
    "Do NOT provide a diagnosis.",
    "Ask clarifying questions when needed.",
    "Provide safe, general guidance and red-flag symptoms that require urgent care.",
    "Keep it concise and structured.",
  ].join("\n");
}

function disclaimer(mode: ChatMode) {
  if (mode === "therapy") {
    return "I’m not a licensed therapist. If you’re in danger or thinking about self-harm, contact local emergency services or someone you trust right now.";
  }
  if (mode === "medical") {
    return "I’m not a doctor. This is general information, not a diagnosis. If symptoms are severe, worsening, or you’re worried, seek medical care.";
  }
  return "";
}

function sseEvent(event: string, data: string) {
  const safe = data
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => `data: ${l}`)
    .join("\n");
  return `event: ${event}\n${safe}\n\n`;
}

async function openaiStream(opts: {
  mode: ChatMode;
  message: string;
  onToken: (t: string) => void;
  signal: AbortSignal;
}) {
  const { mode, message, onToken, signal } = opts;

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
          { role: "system", content: systemPrompt(mode) },
          { role: "user", content: message },
        ],
      }),
    });

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      throw new AppError("LLM_ERROR", `OpenAI error: ${res.status} ${text}`.slice(0, 500), 502);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    let buffer = "";
    let full = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // OpenAI stream chunks separated by \n\n
      const parts = buffer.split("\n\n");
      buffer = parts.pop() || "";

      for (const part of parts) {
        const block = part.trim();
        if (!block) continue;

        const dataLine = block
          .split("\n")
          .find((l) => l.startsWith("data:"));

        if (!dataLine) continue;

        const payload = dataLine.replace(/^data:\s*/, "");
        if (payload === "[DONE]") {
          return { answer: full, disclaimer: disclaimer(mode) };
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

    return { answer: full, disclaimer: disclaimer(mode) };
  } catch (e: any) {
    if (e?.name === "AbortError") {
      throw new AppError("LLM_TIMEOUT", "LLM request timed out", 504);
    }
    if (e instanceof AppError) throw e;
    throw new AppError("LLM_ERROR", "LLM request failed", 502);
  } finally {
    clearTimeout(t);
    signal.removeEventListener("abort", abort);
  }
}

export async function POST(req: Request) {
  try {
    const user = await getAuthedUser();
    const ip = getClientIp(req);

    // 30 req/min per user+ip
    rateLimitOrThrow(`chat:${user.id}:${ip}`, 30, 60_000);

    // ✅ rawBody رو any نگه می‌داریم تا stream تایپ‌اسکریپت خطا نده
    const rawBody: any = await req.json();
    const body = chatSchema.parse(rawBody);

    const mode = body.mode as ChatMode;
    const message = body.message as string;

    // ✅ stream رو از rawBody یا Accept header تشخیص می‌دیم
    const wantStream =
      rawBody?.stream === true ||
      req.headers.get("accept")?.includes("text/event-stream") === true;

    if (!wantStream) {
      // حالت JSON یک‌جا (غیر استریم) — ذخیره + یک‌باره جواب
      await prisma.chatMessage.create({
        data: { userId: user.id, role: "user", mode, content: message },
      });

      // برای حالت non-stream هم از همان openaiStream استفاده می‌کنیم ولی بدون onToken
      const result = await openaiStream({
        mode,
        message,
        onToken: () => {},
        signal: new AbortController().signal,
      });

      await prisma.chatMessage.create({
        data: { userId: user.id, role: "assistant", mode, content: result.answer },
      });

      return ok({ mode, answer: result.answer, disclaimer: result.disclaimer });
    }

    // ✅ STREAMING (SSE)
    await prisma.chatMessage.create({
      data: { userId: user.id, role: "user", mode, content: message },
    });

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        const aborter = new AbortController();

        const onAbort = () => {
          try {
            controller.enqueue(encoder.encode(sseEvent("error", "Client disconnected")));
          } catch {}
          try {
            controller.close();
          } catch {}
          aborter.abort();
        };

        req.signal.addEventListener("abort", onAbort);

        (async () => {
          let fullAnswer = "";

          try {
            controller.enqueue(encoder.encode(sseEvent("meta", JSON.stringify({ mode }))));

            const result = await openaiStream({
              mode,
              message,
              signal: aborter.signal,
              onToken: (t) => {
                fullAnswer += t;
                controller.enqueue(encoder.encode(sseEvent("token", t)));
              },
            });

            await prisma.chatMessage.create({
              data: { userId: user.id, role: "assistant", mode, content: fullAnswer },
            });

            controller.enqueue(
              encoder.encode(
                sseEvent(
                  "done",
                  JSON.stringify({
                    mode,
                    answer: fullAnswer,
                    disclaimer: result.disclaimer || "",
                  })
                )
              )
            );
            controller.close();
          } catch (e: any) {
            const msg = e instanceof AppError ? `${e.code}: ${e.message}` : "SERVER_ERROR: Something went wrong";

            const safe =
              mode === "medical"
                ? "I’m having trouble right now. If this is urgent, please contact a medical professional."
                : "I’m having trouble right now. Please try again in a moment.";

            try {
              await prisma.chatMessage.create({
                data: { userId: user.id, role: "assistant", mode, content: safe },
              });
            } catch {}

            controller.enqueue(encoder.encode(sseEvent("error", msg)));
            controller.close();
          } finally {
            req.signal.removeEventListener("abort", onAbort);
          }
        })();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-store, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (e: any) {
    if (e?.name === "ZodError") {
      return fail("INVALID_INPUT", "Invalid input", 400, e.flatten?.());
    }
    if (e instanceof AppError) {
      if (e.code === "RATE_LIMITED") return failRateLimited(e);
      return fail(e.code, e.message, e.status, (e as any).extra);
    }
    return fail("SERVER_ERROR", "Something went wrong", 500);
  }
}

export async function GET(req: Request) {
  try {
    const user = await getAuthedUser();
    const ip = getClientIp(req);

    // 60 req/min per user+ip (listing is cheaper)
    rateLimitOrThrow(`chat:list:${user.id}:${ip}`, 60, 60_000);

    const messages = await listRecentMessages(user.id, 30);
    return ok({ messages });
  } catch (e: any) {
    if (e instanceof AppError) {
      if (e.code === "RATE_LIMITED") return failRateLimited(e);
      return fail(e.code, e.message, e.status, (e as any).extra);
    }
    return fail("SERVER_ERROR", "Something went wrong", 500);
  }
}
