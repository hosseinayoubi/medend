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

const LLM_TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS || 20_000);
const LLM_TIMEOUT_RECIPE_MS = Number(process.env.LLM_TIMEOUT_RECIPE_MS || 35_000);

// gpt-5-mini: use max_completion_tokens (NOT max_tokens)
const MAX_TOKENS_DEFAULT = Number(process.env.LLM_MAX_TOKENS || 550);
const MAX_TOKENS_RECIPE = Number(process.env.LLM_MAX_TOKENS_RECIPE || 700);

type ChatMode = "medical" | "therapy" | "recipe";
type Lang = "fa" | "ar" | "he" | "en";

function detectLang(text: string): Lang {
  // Hebrew
  if (/[\u0590-\u05FF]/.test(text)) return "he";
  // Arabic script (includes Persian/Urdu, etc)
  if (/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(text)) {
    // Persian-specific letters: پ چ ژ گ ک ی (Arabic yeh/keheh variants included)
    if (/[پچژگ]/.test(text) || /[\u06A9\u06CC]/.test(text)) return "fa";
    return "ar";
  }
  return "en";
}

function isRtl(lang: Lang) {
  return lang === "fa" || lang === "ar" || lang === "he";
}

/**
 * "Smart enough" Persian normalization:
 * - normalize Arabic variants to Persian where helpful
 * - add spaces after punctuation
 * - insert ZWNJ for common patterns: می + verb, ها/های, ترین/تر
 * NOTE: This is heuristic (won’t be perfect), but fixes the “چسبیدن” problem a lot.
 */
function normalizeFa(text: string) {
  let s = text;

  // normalize Arabic chars to Persian
  s = s.replace(/ي/g, "ی").replace(/ك/g, "ک");

  // standardize punctuation spacing (very conservative)
  s = s
    .replace(/([،؛:!?؟])(?=\S)/g, "$1 ")
    .replace(/\s{2,}/g, " ");

  // ZWNJ rules (heuristics)
  // می‌روم / نمی‌روم
  s = s.replace(/\b(ن?می)\s+([اآبپتثجچحخدذرزژسشصضطظعغفقکگلمنوهی])/g, "$1\u200C$2");

  // ها / های
  s = s.replace(/(\S)\s+(ها|های)\b/g, "$1\u200C$2");

  // تر / ترین
  s = s.replace(/(\S)\s+(تر|ترین)\b/g, "$1\u200C$2");

  return s.trim();
}

function disclaimer(mode: ChatMode, lang: Lang) {
  if (mode === "therapy") {
    if (lang === "fa") return "من درمانگر نیستم. اگر در خطر هستید یا به خودآسیبی فکر می‌کنید، فوراً با اورژانس یا یک فرد مورد اعتماد تماس بگیرید.";
    if (lang === "ar") return "أنا لستُ معالجًا. إذا كنتَ في خطر أو تفكّر بإيذاء نفسك، اتصل بالطوارئ أو بشخص موثوق فورًا.";
    if (lang === "he") return "אני לא מטפל מוסמך. אם אתה בסכנה או חושב על פגיעה בעצמך, פנה מיד לשירותי חירום או לאדם מהימן.";
    return "I’m not a licensed therapist. If you’re in danger or thinking about self-harm, contact local emergency services or a trusted person right now.";
  }

  if (mode === "medical") {
    if (lang === "fa") return "من پزشک نیستم. این اطلاعات عمومی است و جایگزین تشخیص پزشکی نیست. اگر علائم شدید/بدترشونده دارید، به پزشک مراجعه کنید.";
    if (lang === "ar") return "أنا لستُ طبيبًا. هذه معلومات عامة وليست تشخيصًا. إذا كانت الأعراض شديدة أو تتفاقم، راجع طبيبًا.";
    if (lang === "he") return "אני לא רופא. זהו מידע כללי ולא אבחנה. אם התסמינים חמורים/מחמירים, פנה לרופא.";
    return "I’m not a doctor. This is general information, not a diagnosis. If symptoms are severe, worsening, or you’re worried, seek medical care.";
  }

  return "";
}

function systemPrompt(mode: ChatMode, lang: Lang) {
  const rtlLine = isRtl(lang)
    ? "IMPORTANT: The user writes in a right-to-left language. Respond in the user's language and keep correct spacing. Do not remove spaces between words."
    : "";

  if (mode === "recipe") {
    if (lang === "fa") {
      return [
        rtlLine,
        "در تمام پاسخ‌های فارسی، فاصله‌گذاری و نیم‌فاصله را خوانا و استاندارد رعایت کن.",
        "شما یک دستیار رسپیِ عملی هستید.",
        "فقط «یک» رسپیِ مناسبِ پیام کاربر بده (نه چند گزینه).",
        "قالب دقیق:",
        "1) عنوان",
        "2) مواد لازم (بولت)",
        "3) مراحل (شماره‌دار، حداکثر ۷ مرحله)",
        "4) زمان (آماده‌سازی/پخت/کل)",
        "5) کالری تقریبی",
        "کوتاه و کاربردی بنویس.",
      ].join("\n");
    }
    if (lang === "ar") {
      return [
        rtlLine,
        "اكتب بالعربية وبمسافات صحيحة بين الكلمات.",
        "أنت مساعد وصفات عملي.",
        "قدّم وصفة واحدة مناسبة لرسالة المستخدم.",
        "التنسيق:",
        "1) العنوان",
        "2) المكوّنات (نقاط)",
        "3) الخطوات (مرقّمة، بحد أقصى 7)",
        "4) الوقت",
        "5) السعرات التقريبية",
        "اجعلها قصيرة وعملية.",
      ].join("\n");
    }
    if (lang === "he") {
      return [
        rtlLine,
        "כתוב בעברית עם ריווח תקין בין מילים.",
        "אתה עוזר מתכונים פרקטי.",
        "תן מתכון אחד שמתאים להודעת המשתמש.",
        "פורמט:",
        "1) כותרת",
        "2) מרכיבים (נקודות)",
        "3) שלבים (ממוספרים, עד 7)",
        "4) זמן",
        "5) קלוריות משוערות",
        "קצר ומעשי.",
      ].join("\n");
    }
    return [
      "You are a practical recipe assistant.",
      "Return ONE best recipe tailored to the user’s message.",
      "Format:",
      "1) Title",
      "2) Ingredients (bullets)",
      "3) Steps (numbered, max 7)",
      "4) Time (prep/cook/total)",
      "5) Estimated calories",
      "Keep it short and practical.",
    ].join("\n");
  }

  if (mode === "therapy") {
    if (lang === "fa") {
      return [
        rtlLine,
        "در تمام پاسخ‌های فارسی، فاصله‌گذاری و نیم‌فاصله را خوانا و استاندارد رعایت کن.",
        "تو یک دستیار حمایتی با لحن درمانی هستی.",
        "ادعای درمانگر/روانشناس بودن نکن.",
        "همدل، کوتاه، و در صورت نیاز ۱–۲ سؤال پیگیری بپرس.",
        "اگر نشانه‌های بحران/خودآسیبی بود، توصیه کن با اورژانس یا فرد مورد اعتماد تماس بگیرند.",
      ].join("\n");
    }
    if (lang === "ar") {
      return [
        rtlLine,
        "اكتب بالعربية وبمسافات صحيحة بين الكلمات.",
        "أنت مساعد داعم بأسلوب علاجي.",
        "لا تدّعِ أنك معالج مرخّص.",
        "كن متعاطفًا ومختصرًا، واسأل 1–2 سؤال متابعة عند الحاجة.",
        "عند إشارات الأزمة/إيذاء النفس: أوصِ بالطوارئ أو شخص موثوق.",
      ].join("\n");
    }
    if (lang === "he") {
      return [
        rtlLine,
        "כתוב בעברית עם ריווח תקין בין מילים.",
        "אתה עוזר תומך בסגנון טיפולי.",
        "אל תטען שאתה מטפל מוסמך.",
        "היה אמפתי וקצר, ושאל 1–2 שאלות המשך כשצריך.",
        "אם יש סימני משבר/פגיעה עצמית: המלץ לפנות לחירום או לאדם מהימן.",
      ].join("\n");
    }
    return [
      "You are a supportive, non-judgmental therapy-style assistant.",
      "Do not claim to be a licensed clinician.",
      "Keep it empathetic and concise. Ask 1-2 gentle follow-ups when useful.",
      "If self-harm/crisis is mentioned, recommend contacting local emergency services or a trusted person.",
    ].join("\n");
  }

  // medical
  if (lang === "fa") {
    return [
      rtlLine,
      "در تمام پاسخ‌های فارسی، فاصله‌گذاری و نیم‌فاصله را خوانا و استاندارد رعایت کن.",
      "درود! چطور می‌توانم کمکتان کنم؟",
      "",
      "اگر سؤال پزشکی دارید، لطفاً بگویید:",
      "- چه علائمی دارید و از کی شروع شده؟",
      "- سن و هر سابقه پزشکی یا دارویی مهمی دارید؟",
      "",
      "قوانین: تشخیص قطعی نده. سؤال‌های کوتاه برای روشن شدن وضعیت بپرس. علائم هشدار را بگو.",
    ].join("\n");
  }
  if (lang === "ar") {
    return [
      rtlLine,
      "اكتب بالعربية وبمسافات صحيحة بين الكلمات.",
      "مرحبًا! كيف يمكنني مساعدتك؟",
      "إذا كان لديك سؤال طبي، اذكر:",
      "- ما الأعراض ومتى بدأت؟",
      "- العمر وأي تاريخ مرضي/أدوية مهمة؟",
      "قواعد: لا تقدّم تشخيصًا قاطعًا. اسأل أسئلة توضيحية قصيرة واذكر علامات الخطر.",
    ].join("\n");
  }
  if (lang === "he") {
    return [
      rtlLine,
      "כתוב בעברית עם ריווח תקין בין מילים.",
      "שלום! איך אפשר לעזור?",
      "אם יש שאלה רפואית, ציין:",
      "- מה התסמינים וממתי התחילו?",
      "- גיל והיסטוריה רפואית/תרופות חשובות?",
      "כללים: אל תיתן אבחנה חד-משמעית. שאל שאלות הבהרה קצרות וציין דגלים אדומים.",
    ].join("\n");
  }

  return [
    "You are a medical information assistant.",
    "Do NOT provide a diagnosis. Ask short clarifying questions.",
    "Provide safe, general guidance and red-flag symptoms requiring urgent care.",
  ].join("\n");
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
        max_completion_tokens: maxTokens,
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

      for (const part of parts) {
        const block = part.trim();
        if (!block) continue;

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
            // NOTE: stream tokens raw to avoid breaking incremental rendering
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

      const result = await openaiStream({
        mode,
        lang,
        message,
        onToken: () => {},
        signal: new AbortController().signal,
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
            controller.enqueue(
              encoder.encode(
                sseEvent("meta", JSON.stringify({ mode, lang, dir: isRtl(lang) ? "rtl" : "ltr" }))
              )
            );

            const result = await openaiStream({
              mode,
              lang,
              message,
              signal: aborter.signal,
              onToken: (t) => {
                fullAnswer += t;
                controller.enqueue(encoder.encode(sseEvent("token", t)));
              },
            });

            // Save normalized final answer (especially for fa)
            await prisma.chatMessage.create({
              data: { userId: user.id, role: "assistant", mode, content: result.answer },
            });

            controller.enqueue(
              encoder.encode(
                sseEvent(
                  "done",
                  JSON.stringify({
                    mode,
                    lang,
                    dir: isRtl(lang) ? "rtl" : "ltr",
                    answer: result.answer,
                    disclaimer: result.disclaimer || "",
                  })
                )
              )
            );
            controller.close();
          } catch (e: any) {
            const msg =
              e instanceof AppError ? `${e.code}: ${e.message}` : "SERVER_ERROR: Something went wrong";

            const safe =
              mode === "medical"
                ? (lang === "fa"
                    ? "الان مشکل دارم. اگر وضعیت اورژانسی است، لطفاً با اورژانس/پزشک تماس بگیرید."
                    : lang === "ar"
                      ? "أواجه مشكلة الآن. إذا كانت الحالة طارئة، تواصل مع الطوارئ/طبيب."
                      : lang === "he"
                        ? "יש בעיה כרגע. אם זה דחוף, פנה לחירום/רופא."
                        : "I’m having trouble right now. If this is urgent, contact emergency services or a clinician.")
                : (lang === "fa"
                    ? "الان مشکل دارم. لطفاً کمی بعد دوباره امتحان کنید."
                    : lang === "ar"
                      ? "هناك مشكلة الآن. حاول مرة أخرى بعد قليل."
                      : lang === "he"
                        ? "יש בעיה כרגע. נסה שוב בעוד רגע."
                        : "I’m having trouble right now. Please try again in a moment.");

            try {
              await prisma.chatMessage.create({
                data: { userId: user.id, role: "assistant", mode, content: safe },
              });
            } catch {}

            try {
              controller.enqueue(encoder.encode(sseEvent("error", msg)));
            } catch {}
            try {
              controller.close();
            } catch {}
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
