'use client';

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { requireAuth } from "@/lib/clientAuth";

type Msg = { id?: string; role: "user" | "assistant"; content: string; mode?: string; createdAt?: string };

export default function ChatPage() {
  const [mode, setMode] = useState<"medical" | "therapy" | "recipe">("medical");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const ok = await requireAuth();
      if (!ok) return;
      try {
        const res = await fetch("/api/chat");
        const json = await res.json();
        if (json?.ok?.messages) setMessages(json.ok.messages);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function send() {
    if (!input.trim() || sending) return;
    setError(null);
    const userMsg: Msg = { role: "user", content: input.trim(), mode };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg.content, mode }),
      });
      const json = await res.json();
      if (!json?.ok) throw new Error(json?.message || "Chat failed");
      setMessages(prev => [...prev, { role: "assistant", content: json.ok.reply, mode }]);
    } catch (e: any) {
      setError("Could not send. Try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Shell>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: "0 0 4px", fontSize: 26 }}>Chat</h1>
          <p style={{ margin: 0, color: "#64748b" }}>Text-only assistant. For emergencies, seek urgent care.</p>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label style={{ fontSize: 13, color: "#475569" }}>Mode</label>
          <select value={mode} onChange={(e) => setMode(e.target.value as any)} style={select}>
            <option value="medical">Medical</option>
            <option value="therapy">Therapy</option>
            <option value="recipe">Recipe</option>
          </select>
          <Link href="/report" style={btn}>Doctor report</Link>
        </div>
      </div>

      <div style={box}>
        {loading ? (
          <p style={{ color: "#64748b" }}>Loading…</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {messages.length === 0 && <p style={{ color: "#64748b" }}>No messages yet. Start by describing your symptoms or goal.</p>}
            {messages.map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{ maxWidth: 640, padding: "10px 12px", borderRadius: 14, border: "1px solid #e2e8f0", background: m.role === "user" ? "#0f172a" : "#ffffff", color: m.role === "user" ? "#ffffff" : "#0f172a", whiteSpace: "pre-wrap" }}>
                  {m.content}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && <div style={alertError}>{error}</div>}

      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message…"
          rows={2}
          style={{ flex: 1, padding: "10px 12px", borderRadius: 12, border: "1px solid #e2e8f0", resize: "vertical" }}
        />
        <button onClick={send} disabled={sending} style={btnPrimary}>
          {sending ? "Sending…" : "Send"}
        </button>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: 24 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14 }}>
        <Link href="/" style={{ textDecoration: "none", color: "#0f172a", fontWeight: 700 }}>MedEnd</Link>
        <span style={{ color: "#cbd5e1" }}>•</span>
        <Link href="/intake" style={{ textDecoration: "none", color: "#0f172a" }}>Intake</Link>
        <Link href="/chat" style={{ textDecoration: "none", color: "#0f172a" }}>Chat</Link>
      </div>
      <div style={{ border: "1px solid #e2e8f0", borderRadius: 16, padding: 16 }}>
        {children}
      </div>
    </main>
  );
}

const select: React.CSSProperties = { padding: "10px 12px", borderRadius: 10, border: "1px solid #e2e8f0" };
const box: React.CSSProperties = { marginTop: 14, border: "1px solid #e2e8f0", borderRadius: 16, padding: 14, minHeight: 360, background: "#ffffff" };
const btn: React.CSSProperties = { padding: "10px 14px", borderRadius: 10, border: "1px solid #e2e8f0", background: "#ffffff", textDecoration: "none", color: "#0f172a" };
const btnPrimary: React.CSSProperties = { ...btn, background: "#0f172a", borderColor: "#0f172a", color: "#ffffff", cursor: "pointer" };
const alertError: React.CSSProperties = { marginTop: 12, padding: 10, borderRadius: 12, background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b" };
