"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { requireAuth } from "@/lib/clientAuth";

type Mode = "medical" | "therapy" | "recipe";
type Msg = { id: string; role: "user" | "assistant"; content: string; mode?: Mode };

function uid(prefix = "m") {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function ChatPage() {
  const [mode, setMode] = useState<Mode>("medical");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  const headerLabel = useMemo(() => {
    if (mode === "medical") return "Medical";
    if (mode === "therapy") return "Therapy";
    return "Recipe";
  }, [mode]);

  useEffect(() => {
    (async () => {
      const ok = await requireAuth();
      if (!ok) return;

      try {
        const res = await fetch("/api/chat", { cache: "no-store" });
        const json = await res.json().catch(() => null);

        // ✅ درستش: response helper ما { ok: true, data: {...} } هست
        if (res.ok && json?.ok === true && json?.data?.messages) {
          const serverMsgs = (json.data.messages as any[]).map((m: any) => ({
            id: m.id || uid("srv"),
            role: m.role,
            content: m.content,
            mode: m.mode,
          })) as Msg[];
          setMessages(serverMsgs);
        }
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
          Accept: "application/json", // ✅ JSON-only
        },
        body: JSON.stringify({ message: text, mode, stream: false }), // ✅ stream off
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok !== true) {
        throw new Error(json?.error?.message || `HTTP ${res.status}`);
      }

      // backend: ok({ mode, answer, disclaimer, lang, dir })
      const answer = json?.data?.answer ?? "";

      setMessages((prev) =>
        prev.map((m) => (m.id === pendingId ? { ...m, content: answer || "No response." } : m))
      );
    } catch (e: any) {
      setMessages((prev) => prev.filter((m) => m.id !== pendingId));
      setError(String(e?.message || "Could not send. Try again."));
    } finally {
      setSending(false);
    }
  }

  return (
    <main style={shell}>
      <div style={topRow}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>Chat</div>
          <div style={{ fontSize: 12, color: "#64748b" }}>{headerLabel} mode</div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as Mode)}
            style={select}
            disabled={sending}
          >
            <option value="medical">Medical</option>
            <option value="therapy">Therapy</option>
            <option value="recipe">Recipe</option>
          </select>

          <Link href="/account" style={btn}>
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
            {messages.map((m) => {
              const isUser = m.role === "user";

              // ✅ مهم: در RTL، flex-start/end برعکس می‌شود. این را ثابت می‌کنیم.
              const rowStyle: React.CSSProperties = {
                direction: "ltr", // layout always LTR (left/right stable)
                display: "flex",
                width: "100%",
                justifyContent: isUser ? "flex-end" : "flex-start",
              };

              return (
                <div key={m.id} style={rowStyle}>
                  <div style={bubble}>
                    {/* ✅ متن bidi درست */}
                    <bdi
                      dir="auto"
                      style={{
                        unicodeBidi: "isolate",
                        whiteSpace: "pre-wrap",
                        overflowWrap: "anywhere",
                        wordBreak: "break-word",
                        textAlign: "start",
                        display: "block",
                      }}
                    >
                      {m.content || (m.role === "assistant" && sending ? "…" : "")}
                    </bdi>
                  </div>
                </div>
              );
            })}
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
          disabled={sending}
          placeholder="Type your message…"
          style={textarea}
          dir="auto"
        />

        <button onClick={send} disabled={sending || !input.trim()} style={button}>
          {sending ? "Sending…" : "Send"}
        </button>
      </div>
    </main>
  );
}

const shell: React.CSSProperties = {
  maxWidth: 920,
  margin: "30px auto",
  padding: 16,
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const topRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};

const box: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  padding: 12,
  minHeight: 420,
  background: "#f8fafc",
  overflow: "hidden",
};

const bubble: React.CSSProperties = {
  maxWidth: "78%",
  padding: "10px 12px",
  borderRadius: 14,
  border: "1px solid #e2e8f0",
  background: "#ffffff",
  color: "#0f172a",
  lineHeight: 1.5,
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
  overflowWrap: "anywhere",
  wordBreak: "break-word",
  whiteSpace: "pre-wrap",
};

const button: React.CSSProperties = {
  border: "1px solid #0f172a",
  background: "#0f172a",
  color: "#fff",
  borderRadius: 12,
  padding: "10px 14px",
  fontWeight: 800,
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

const btn: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  background: "#fff",
  color: "#0f172a",
  borderRadius: 12,
  padding: "8px 10px",
  textDecoration: "none",
  fontWeight: 800,
};

const alertError: React.CSSProperties = {
  border: "1px solid #fecaca",
  background: "#fef2f2",
  color: "#7f1d1d",
  borderRadius: 12,
  padding: "10px 12px",
};
