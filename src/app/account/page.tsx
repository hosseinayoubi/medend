"use client";

import Link from "next/link";
import { useState } from "react";

export default function AccountPage() {
  const [msg, setMsg] = useState<string | null>(null);

  async function logout() {
    setMsg(null);
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      const j = await res.json().catch(() => null);
      if (!res.ok) throw new Error(j?.error?.message || `HTTP ${res.status}`);
      window.location.href = "/login";
    } catch (e: any) {
      setMsg(String(e?.message || "Logout failed"));
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: "30px auto", padding: 16 }}>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#0f172a" }}>Account</h1>
      <p style={{ color: "#64748b", marginTop: 8 }}>Account page placeholder (fixes /account 404).</p>

      <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
        <Link href="/chat" style={btnOutline}>
          Back to Chat
        </Link>

        <button onClick={logout} style={btnDanger}>
          Logout
        </button>
      </div>

      {msg ? (
        <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 12, border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b" }}>
          {msg}
        </div>
      ) : null}
    </main>
  );
}

const btnOutline: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  background: "#fff",
  color: "#0f172a",
  borderRadius: 12,
  padding: "10px 12px",
  textDecoration: "none",
  fontWeight: 800,
};

const btnDanger: React.CSSProperties = {
  border: "1px solid #991b1b",
  background: "#991b1b",
  color: "#fff",
  borderRadius: 12,
  padding: "10px 12px",
  fontWeight: 800,
  cursor: "pointer",
};
