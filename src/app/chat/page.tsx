"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { requireAuth } from "@/lib/clientAuth";

type Mode = "medical" | "therapy" | "recipe";
type Msg = { id: string; role: "user" | "assistant"; content: string; mode?: Mode };

function uid(prefix = "m") {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** Project's current 20 langs (based on /public/locales/*.js) */
type Lang =
  | "en"
  | "fa"
  | "ar"
  | "he"
  | "tr"
  | "de"
  | "fr"
  | "es"
  | "it"
  | "pt"
  | "ru"
  | "sv"
  | "fi"
  | "nl"
  | "ja"
  | "hi"
  | "pl"
  | "uk"
  | "ur"
  | "zh";

const DEFAULT_LANG: Lang = "en";
const RTL_LANGS = new Set<Lang>(["fa", "ar", "he", "ur"]);

function getCookie(name: string) {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(
    new RegExp("(?:^|; )" + name.replace(/[.$?*|{}()[\]\\/+^]/g, "\\$&") + "=([^;]*)")
  );
  return m ? decodeURIComponent(m[1]) : "";
}

function detectUiLang(): Lang {
  // priority: localStorage -> cookie -> default
  try {
    const v = (localStorage.getItem("language") || "").toLowerCase();
    if (v) return v as Lang;
  } catch {}
  const c = (getCookie("lang") || "").toLowerCase();
  if (c) return c as Lang;
  return DEFAULT_LANG;
}

export default function ChatPage() {
  const [mode, setMode] = useState<Mode>("medical");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // UI lang/dir (for fonts + overall direction)
  const [uiLang, setUiLang] = useState<Lang>(DEFAULT_LANG);
  const uiDir: "rtl" | "ltr" = RTL_LANGS.has(uiLang) ? "rtl" : "ltr";

  const bottomRef = useRef<HTMLDivElement | null>(null);

  const headerLabel = useMemo(() => {
    if (mode === "medical") return "Medical";
    if (mode === "therapy") return "Therapy";
    return "Recipe";
  }, [mode]);

  function appendToPending(pendingId: string, chunk: string) {
    setMessages((prev) =>
      prev.map((m) => (m.id === pendingId ? { ...m, content: (m.content || "") + chunk } : m))
    );
  }

  useEffect(() => {
    // Apply UI lang/dir to <html> so fonts (lang selectors) + direction behave consistently
    const l = detectUiLang();
    setUiLang(l);

    try {
      document.documentElement.lang = l;
      document.documentElement.dir = RTL_LANGS.has(l) ? "rtl" : "ltr";
    } catch {}

    (async () => {
      const ok = await requireAuth();
      if (!ok) return;

      try {
        const res = await fetch("/api/chat", { cache: "no-store" });
        const json = await res.json().catch(() => null);

        if (res.ok && json?.ok?.messages) {
          const serverMsgs = (json.ok.messages as any[]).map((m: any) => ({
            id: m.id || uid("srv"),
            role: m.role,
            content: m.content,
            mode: m.mode,
          })) as Msg[];
          setMessages(serverMsgs);
        }
      } catch {
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function send() {
    if (sending) return;

    const text = input.trim();
    if (!text) return;

    setError(null);

    const userMsg: Msg = { id: uid("u"), role: "user", content: text, mode };
    const pendingId = uid("a");
    const pendingMsg: Msg = { id: pendingId, role: "assistant", content: "", mode };

    setMessages((prev) => [...prev, userMsg, pendingMsg]);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({ message: text, mode, stream: true }),
      });

      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error?.message || `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // SSE messages separated by \n\n
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          const lines = part.split("\n").map((l) => l.trim());
          const ev =
            lines.find((l) => l.startsWith("event:"))?.replace("event:", "").trim() || "";
          const dataLines = lines
            .filter((l) => l.startsWith("data:"))
            .map((l) => l.replace("data:", "").trim());
          const data = dataLines.join("\n");

          if (!ev) continue;

          if (ev === "token") {
            // backend sends raw text chunk (not JSON)
            appendToPending(pendingId, data);
          } else if (ev === "meta") {
            // optional: backend may send {mode, lang, dir}
            // we don't need it for BIDI fix, but keep safe parsing:
            // const payload = JSON.parse(data);
            // console.log(payload);
          } else if (ev === "error") {
            throw new Error(data || "Stream error");
          }
        }
      }

      // If stream ended with empty output:
      setMessages((prev) =>
        prev.map((m) => (m.id === pendingId && !m.content ? { ...m, content: "No response." } : m))
      );
    } catch (e: any) {
      setMessages((prev) =>
        prev.map((m) => (m.id === pendingId ? { ...m, content: "" } : m))
      );

      const msg = String(e?.message || "");
      if (msg.toLowerCase().includes("timeout") || msg.toLowerCase().includes("timed out")) {
        setError("Model is taking too long. Please try again.");
      } else {
        setError(msg || "Could not send. Try again.");
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <Shell lang={uiLang} dir={uiDir}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a" }}>Chat</div>
          <div style={{ fontSize: 12, color: "#64748b" }}>{headerLabel} mode</div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as Mode)}
            style={select}
            disabled={sending}
            aria-label="mode"
          >
            <option value="medical">Medical</option>
            <option value="therapy">Therapy</option>
            <option value="recipe">Recipe</option>
          </select>

          <Link href="/account" style={linkBtn}>
            Account
          </Link>
        </div>
      </div>

      <div style={box}>
        {loading ? (
          <div style={{ color: "#64748b" }}>Loading…</div>
        ) : messages.length === 0 ? (
          <div style={{ color: "#64748b" }}>
            Say hi 👋 (Enter to send, Shift+Enter for a new line)
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {messages.map((m) => (
              <div
                key={m.id}
                style={{
                  alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                  maxWidth: "78%",
                  padding: "10px 12px",
                  borderRadius: 14,
                  border: "1px solid #e2e8f0",
                  background: "#fff",
                  color: "#0f172a",
                  lineHeight: 1.5,
                  minHeight: m.role === "assistant" && sending && m.content === "" ? 22 : undefined,

                  /* overflow fix even if CSS fails to load */
                  overflowWrap: "anywhere",
                  wordBreak: "break-word",
                  whiteSpace: "pre-wrap",
                  unicodeBidi: "plaintext",
                }}
                // THE KEY: let browser decide direction per message
                dir="auto"
                className="chatBubble"
              >
                {/* THE KEY: prevents bidi mixing (numbers/URLs/English inside Persian) */}
                <bdi>{m.content || (m.role === "assistant" && sending ? "…" : "")}</bdi>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {error ? <div style={alertError}>{error}</div> : null}

      <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginTop: 12 }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Write a message…"
          style={{
            ...textarea,
            unicodeBidi: "plaintext",
            overflowWrap: "anywhere",
            wordBreak: "break-word",
          }}
          dir="auto"
          lang={uiLang}
        />

        <button onClick={send} disabled={sending} style={button}>
          {sending ? "Sending…" : "Send"}
        </button>
      </div>
    </Shell>
  );
}

function Shell(props: { children: React.ReactNode; lang: string; dir: "rtl" | "ltr" }) {
  return (
    <div
      lang={props.lang}
      dir={props.dir}
      style={{
        maxWidth: 920,
        margin: "30px auto",
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {props.children}
    </div>
  );
}

const box: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  padding: 12,
  minHeight: 380,
  background: "#f8fafc",
  overflow: "hidden",
};

const textarea: React.CSSProperties = {
  flex: 1,
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  padding: "10px 12px",
  minHeight: 44,
  maxHeight: 180,
  resize: "vertical",
  outline: "none",
  background: "#fff",
  color: "#0f172a",
  lineHeight: 1.5,
};

const button: React.CSSProperties = {
  border: "1px solid #0f172a",
  background: "#0f172a",
  color: "#fff",
  borderRadius: 12,
  padding: "10px 14px",
  fontWeight: 700,
  cursor: "pointer",
};

const select: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  background: "#fff",
  color: "#0f172a",
  borderRadius: 12,
  padding: "8px 10px",
  outline: "none",
};

const linkBtn: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  background: "#fff",
  color: "#0f172a",
  borderRadius: 12,
  padding: "8px 10px",
  textDecoration: "none",
  fontWeight: 700,
};

const alertError: React.CSSProperties = {
  border: "1px solid #fecaca",
  background: "#fef2f2",
  color: "#7f1d1d",
  borderRadius: 12,
  padding: "10px 12px",
};
