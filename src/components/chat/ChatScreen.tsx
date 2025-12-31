"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type ChatMode = "medical" | "therapy" | "recipe" | "dental";

type Msg = {
  id?: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
};

function bubbleClass(role: Msg["role"]) {
  return role === "user"
    ? "ml-auto bg-white text-black"
    : "mr-auto bg-white/10 text-white border border-white/10";
}

export default function ChatScreen(props: { mode: ChatMode; title: string; subtitle: string }) {
  const { mode, title, subtitle } = props;

  const [items, setItems] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const endRef = useRef<HTMLDivElement | null>(null);

  const canSend = useMemo(() => input.trim().length > 0 && !loading, [input, loading]);

  function scrollToBottom() {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  async function load() {
    setErr(null);
    try {
      const res = await fetch(`/api/chat?mode=${mode}`, { method: "GET" });
      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json?.ok) {
        setErr(json?.error?.message || json?.message || "Failed to load messages");
        return;
      }

      const msgs = (json?.data?.messages ?? json?.messages ?? []) as any[];
      const mapped: Msg[] = msgs.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      }));

      setItems(mapped);
      setTimeout(scrollToBottom, 50);
    } catch (e: any) {
      setErr(e?.message || "Failed to load messages");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  async function send() {
    if (!canSend) return;

    const message = input.trim();
    setInput("");
    setErr(null);
    setLoading(true);

    // optimistic
    const optimisticUser: Msg = { role: "user", content: message };
    setItems((prev) => [...prev, optimisticUser]);
    setTimeout(scrollToBottom, 10);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, message }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json?.ok) {
        const m = json?.error?.message || json?.message || "Send failed";
        setErr(m);
        setLoading(false);
        return;
      }

      const answerText =
        json?.data?.answer ?? json?.answer ?? json?.data?.result?.answer ?? json?.result?.answer ?? "";

      if (answerText) {
        setItems((prev) => [...prev, { role: "assistant", content: String(answerText) }]);
      }
      setLoading(false);
      setTimeout(scrollToBottom, 10);
    } catch (e: any) {
      setErr(e?.message || "Send failed");
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="text-lg font-semibold">{title}</div>
        <div className="text-white/70 text-sm mt-1">{subtitle}</div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={load}
            className="rounded-xl bg-white/10 hover:bg-white/15 px-3 py-2 text-sm"
          >
            Reload
          </button>
        </div>
      </div>

      {err && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm">
          {err}
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-[#0f1930] p-4">
        <div className="h-[55vh] overflow-y-auto pr-1">
          <div className="grid gap-3">
            {items.map((m, idx) => (
              <div
                key={m.id ?? idx}
                className={[
                  "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap",
                  bubbleClass(m.role),
                ].join(" ")}
              >
                {m.content}
              </div>
            ))}

            {loading && (
              <div className="max-w-[85%] mr-auto rounded-2xl px-4 py-3 text-sm bg-white/10 text-white border border-white/10">
                Typing…
              </div>
            )}

            <div ref={endRef} />
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <input
            className="flex-1 rounded-2xl bg-[#0b1220] border border-white/10 px-4 py-3 outline-none"
            placeholder="Type your message…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            disabled={loading}
          />
          <button
            onClick={send}
            disabled={!canSend}
            className={[
              "rounded-2xl px-4 py-3 font-semibold",
              canSend ? "bg-white text-black hover:bg-white/90" : "bg-white/10 text-white/60",
            ].join(" ")}
          >
            Send
          </button>
        </div>
        <div className="text-xs text-white/50 mt-2">
          Tip: press Enter to send (Shift+Enter for newline)
        </div>
      </div>
    </div>
  );
}
