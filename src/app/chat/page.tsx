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

  useEffect(() => {
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

  const headerLabel = useMemo(() => {
    if (mode === "therapy") return "Therapy";
    if (mode === "recipe") return "Recipe";
    return "Medical";
  }, [mode]);

  function appendToPending(pendingId: string, chunk: string) {
    setMessages((prev) =>
      prev.map((m) => (m.id === pendingId ? { ...m, content: (m.content || "") + chunk } : m))
    );
  }

  async function send() {
    if (!input.trim() || sending) return;

    setError(null);

    const text = input.trim();
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
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // SSE messages separated by \n\n
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          const lines = part.split("\n").map((l) => l.trim());
          const ev = lines.find((l) => l.startsWith("event:"))?.replace("event:", "").trim() || "";
          const dataLines = lines.filter((l) => l.startsWith("data:")).map((l) => l.replace("data:", "").trim());
          const data = dataLines.join("\n");

          if (!ev) continue;

          if (ev === "token") {
            appendToPending(pendingId, data);
          } else if (ev === "done") {
            // اگر خواستی disclaimer رو هم اضافه کنی:
            // const payload = JSON.parse(data);
            // if (payload?.disclaimer) appendToPending(pendingId, `\n\n${payload.disclaimer}`);
          } else if (ev === "error") {
            throw new Error(data || "Stream error");
          }
        }
      }

      // اگر استریم به هر دلیل خالی موند:
      setMessages((prev) =>
        prev.map((m) => (m.id === pendingId && !m.content ? { ...m, content: "No response." } : m))
      );
    } catch (e: any) {
      // pending رو حذف نکن، بهتره error بده یا خالی نمونه
      setMessages((prev) =>
        prev.map((m) => (m.id === pendingId ? { ...m, content: m.content || "" } : m))
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
    <Shell>
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
                  whiteSpace: "pre-wrap",
                  lineHeight: 1.5,
                  minHeight: m.role === "assistant" && sending && m.content === "" ? 22 : undefined,
                }}
              >
                {m.content || (m.role === "assistant" && sending ? "…" : "")}
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
          disabled={sending}
          placeholder="Type your message…"
          rows={2}
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid #e2e8f0",
            resize: "vertical",
            opacity: sending ? 0.7 : 1,
          }}
        />

        <button onClick={send} disabled={sending || !input.trim()} style={btnPrimary}>
          {sending ? "Sending…" : "Send"}
        </button>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ maxWidth: 920, margin: "0 auto", padding: "24px 16px" }}>
      <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 12 }}>
        <Link href="/" style={{ textDecoration: "none", color: "#0f172a", fontWeight: 700 }}>
          medend
        </Link>
        <Link href="/chat" style={{ textDecoration: "none", color: "#0f172a" }}>
          Chat
        </Link>
      </div>

      <div style={{ border: "1px solid #e2e8f0", borderRadius: 16, padding: 16, background: "#ffffff" }}>
        {children}
      </div>
    </main>
  );
}

const select: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #e2e8f0",
  background: "#fff",
};

const box: React.CSSProperties = {
  marginTop: 14,
  border: "1px solid #e2e8f0",
  borderRadius: 16,
  padding: 14,
  minHeight: 360,
  background: "#ffffff",
};

const btn: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  background: "#ffffff",
  textDecoration: "none",
  color: "#0f172a",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
};

const btnPrimary: React.CSSProperties = {
  ...btn,
  background: "#0f172a",
  borderColor: "#0f172a",
  color: "#ffffff",
  cursor: "pointer",
};

const alertError: React.CSSProperties = {
  marginTop: 12,
  padding: "10px 12px",
  borderRadius: 12,
  background: "#fef2f2",
  border: "1px solid #fecaca",
  color: "#991b1b",
};
