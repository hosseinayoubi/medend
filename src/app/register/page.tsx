"use client";

import { useState } from "react";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setMsg(data?.message || "Register failed");
    else window.location.href = "/login";
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif", background: "#0b1220", minHeight: "100vh", color: "#e5e7eb" }}>
      <h1 style={{ margin: 0 }}>Create account</h1>
      <p style={{ color: "#94a3b8" }}>Then login and fill the questionnaire.</p>

      <form onSubmit={onSubmit} style={{ maxWidth: 420, display: "grid", gap: 10 }}>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" style={input} />
        <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" style={input} />
        <button type="submit" style={primary}>Create</button>
        <a href="/login" style={link}>Back to login</a>
        {msg && <div style={{ color: "#fca5a5" }}>{msg}</div>}
      </form>
    </main>
  );
}

const input: React.CSSProperties = { background:"#111827", color:"#e5e7eb", border:"1px solid #374151", borderRadius:12, padding:"12px 12px" };
const primary: React.CSSProperties = { background:"#16a34a", color:"white", border:"0", borderRadius:12, padding:"12px 12px", fontWeight:700, cursor:"pointer" };
const link: React.CSSProperties = { color:"#60a5fa", textDecoration:"none", fontSize: 13 };
